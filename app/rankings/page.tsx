import {
  gamesApi,
  playersApi,
  teamsApi,
  tournamentsApi,
  type Game,
  type Player,
  type Team,
  type Tournament,
} from "@/utils/api";
import { getServerLocale } from "@/utils/i18n-server";
import { mapWithConcurrency } from "@/utils/async";
import { AppShell } from "@/app/_components/AppShell";

import { RankingsClient, type RankingRow } from "./_components/RankingsClient";

export const dynamic = "force-dynamic";

// Server-side data prep. Aggregates per-tournament and league-wide totals,
// then hands plain data to the client component for filter + CSV export.
export default async function RankingsPage() {
  const { dict } = await getServerLocale();
  const common = dict.common;

  const tournaments = await tournamentsApi.list(50).catch(() => []);

  // Pull every team + every game per tournament so we can compute
  // league-wide aggregates without N+1 in the client.
  const perTournament = await mapWithConcurrency(tournaments, 4, async (t) => {
    const [teams, games] = await Promise.all([
      teamsApi.listByTournament(t.id).catch(() => [] as Team[]),
      gamesApi.listByTournament(t.id).catch(() => [] as Game[]),
    ]);
    return { tournament: t, teams, games };
  });

  // --- Team rows: aggregate wins / losses / PF / PA across tournaments.
  const teamAgg = new Map<
    number,
    {
      id: number;
      name: string;
      wins: number;
      losses: number;
      pf: number;
      pa: number;
      power: number;
      streak: number;
      tournamentIds: number[];
    }
  >();
  for (const { tournament, teams, games } of perTournament) {
    const byId = new Map(teams.map((t) => [t.id, t]));
    for (const game of games) {
      const home = byId.get(game.home_team_id);
      const away = byId.get(game.away_team_id);
      if (!home || !away) continue;
      for (const side of [home, away]) {
        if (!teamAgg.has(side.id)) {
          teamAgg.set(side.id, {
            id: side.id,
            name: side.name,
            wins: 0,
            losses: 0,
            pf: 0,
            pa: 0,
            power: 0,
            streak: 0,
            tournamentIds: [],
          });
        }
      }
      const homeRow = teamAgg.get(home.id)!;
      const awayRow = teamAgg.get(away.id)!;
      homeRow.pf += game.home_score;
      homeRow.pa += game.away_score;
      awayRow.pf += game.away_score;
      awayRow.pa += game.home_score;
      if (!homeRow.tournamentIds.includes(tournament.id)) {
        homeRow.tournamentIds.push(tournament.id);
        awayRow.tournamentIds.push(tournament.id);
      }
      if (game.home_score === game.away_score) continue;
      if (game.home_score > game.away_score) {
        homeRow.wins += 1;
        awayRow.losses += 1;
      } else {
        awayRow.wins += 1;
        homeRow.losses += 1;
      }
    }
  }
  // Streak = max consecutive wins from the most recent games (per side).
  // Power score = wins*2 + (pf-pa)/10 — a stand-in until the backend ships
  // a real metric.
  for (const row of teamAgg.values()) {
    row.power = row.wins * 2 + (row.pf - row.pa) / 10;
    row.streak = computeStreakFromGames(perTournament, row.id, "team");
  }

  // --- Player rows: aggregate goals/assists/defenses via per-player stats.
  const playerRows = new Map<
    number,
    {
      id: number;
      name: string;
      team: string | null;
      goals: number;
      assists: number;
      defenses: number;
      power: number;
      streak: number;
      tournamentIds: number[];
    }
  >();
  await mapWithConcurrency(
    perTournament.flatMap(({ teams }) => teams),
    4,
    async (team) => {
      const players = await playersApi
        .listByTeam(team.id)
        .catch(() => [] as Player[]);
      await mapWithConcurrency(players, 4, async (p) => {
        const stats = await playersApi.stats(p.id).catch(() => null);
        if (!stats) return;
        const cur =
          playerRows.get(p.id) ?? {
            id: p.id,
            name: `${p.first_name} ${p.last_name}`.trim(),
            team: team.name,
            goals: 0,
            assists: 0,
            defenses: 0,
            power: 0,
            streak: 0,
            tournamentIds: [],
          };
        for (const row of stats.per_tournament) {
          cur.goals += row.goals;
          cur.assists += row.assists;
          cur.defenses += row.defenses;
          if (!cur.tournamentIds.includes(row.tournament_id)) {
            cur.tournamentIds.push(row.tournament_id);
          }
        }
        cur.power = cur.goals + cur.assists * 0.7 + cur.defenses * 0.5;
        cur.streak = computeStreakFromGames(perTournament, p.id, "player");
        playerRows.set(p.id, cur);
      });
    },
  );

  const teamRows: RankingRow[] = [...teamAgg.values()].map((r) => ({
    id: r.id,
    subject: r.name,
    team: null,
    points: r.wins,
    power: round1(r.power),
    streak: r.streak,
    tournamentIds: r.tournamentIds,
  }));
  const playerRankingRows: RankingRow[] = [...playerRows.values()].map((r) => ({
    id: r.id,
    subject: r.name,
    team: r.team,
    points: r.goals + r.assists + r.defenses,
    power: round1(r.power),
    streak: r.streak,
    tournamentIds: r.tournamentIds,
  }));

  const tournamentOptions = tournaments.map((t: Tournament) => ({
    id: t.id,
    name: t.name,
  }));

  return (
    <AppShell footerText={common.footer}>
      <RankingsClient
        tournaments={tournamentOptions}
        teams={teamRows}
        players={playerRankingRows}
        labels={{
          title: dict.rankings.title,
          filterTournament: dict.rankings.allTournaments,
          allTournaments: dict.rankings.allTournaments,
          typeTeams: dict.rankings.topTeams,
          typePlayers: dict.rankings.topScorers,
          exportCsv: dict.publicStats.exportCsv,
          noData: common.noData,
        }}
      />
    </AppShell>
  );
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// Streak = max consecutive wins derived from a chronological sweep of
// the games that include this subject. `kind` distinguishes the lookup
// key (team id vs player id).
function computeStreakFromGames(
  perTournament: Array<{ tournament: Tournament; teams: Team[]; games: Game[] }>,
  id: number,
  kind: "team" | "player",
): number {
  const events: Array<{ ts: number; win: boolean }> = [];
  for (const { games } of perTournament) {
    for (const g of games) {
      if (!g.end_time) continue;
      const ts = Date.parse(g.end_time);
      if (!Number.isFinite(ts)) continue;
      if (kind === "team") {
        if (g.home_team_id !== id && g.away_team_id !== id) continue;
        const isHome = g.home_team_id === id;
        const win =
          g.home_score === g.away_score
            ? false
            : (g.home_score > g.away_score) === isHome;
        events.push({ ts, win });
      }
      // Player-level streak requires event detail; skip for now.
    }
  }
  events.sort((a, b) => a.ts - b.ts);
  let best = 0;
  let run = 0;
  for (const e of events) {
    run = e.win ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}