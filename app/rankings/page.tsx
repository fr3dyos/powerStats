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

// Server-side data prep. Aggregates per-tournament and league-wide totals
// (games played, goals, assists, defenses, averages, power/MVP) then hands
// plain row objects to the client for filtering, sorting and CSV export.
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

  // --- Team rows: aggregate wins / losses / PF / PA / games played.
  type TeamAcc = {
    id: number;
    name: string;
    wins: number;
    losses: number;
    ties: number;
    pf: number;
    pa: number;
    power: number;
    streak: number;
    tournamentIds: number[];
  };
  const teamAgg = new Map<number, TeamAcc>();
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
            ties: 0,
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
      if (game.home_score === game.away_score) {
        homeRow.ties += 1;
        awayRow.ties += 1;
        continue;
      }
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

  // --- Player rows: aggregate games played / goals / assists / defenses via
  // per-player stats, and remember each team's top player for the MVP column.
  type PlayerAcc = {
    id: number;
    name: string;
    team: string | null;
    teamId: number | null;
    gamesPlayed: number;
    goals: number;
    assists: number;
    defenses: number;
    goalsAvg: number;
    assistsAvg: number;
    defensesAvg: number;
    power: number;
    streak: number;
    tournamentIds: number[];
  };
  const playerRows = new Map<number, PlayerAcc>();
  const teamTopPlayer = new Map<number, { name: string; power: number }>();

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
          playerRows.get(p.id) ??
          ({
            id: p.id,
            name: `${p.first_name} ${p.last_name}`.trim(),
            team: team.name,
            teamId: team.id,
            gamesPlayed: 0,
            goals: 0,
            assists: 0,
            defenses: 0,
            goalsAvg: 0,
            assistsAvg: 0,
            defensesAvg: 0,
            power: 0,
            streak: 0,
            tournamentIds: [],
          } satisfies PlayerAcc);
        cur.gamesPlayed += stats.totals.games_played;
        cur.goals += stats.totals.goals;
        cur.assists += stats.totals.assists;
        cur.defenses += stats.totals.defenses;
        for (const row of stats.per_tournament) {
          if (!cur.tournamentIds.includes(row.tournament_id)) {
            cur.tournamentIds.push(row.tournament_id);
          }
        }
        cur.power = cur.goals + cur.assists * 0.7 + cur.defenses * 0.5;
        cur.goalsAvg = cur.gamesPlayed > 0 ? cur.goals / cur.gamesPlayed : 0;
        cur.assistsAvg = cur.gamesPlayed > 0 ? cur.assists / cur.gamesPlayed : 0;
        cur.defensesAvg = cur.gamesPlayed > 0 ? cur.defenses / cur.gamesPlayed : 0;
        cur.streak = computeStreakFromGames(perTournament, p.id, "player");
        playerRows.set(p.id, cur);

        // Track the team's most valuable player (highest power score).
        const top = teamTopPlayer.get(team.id);
        if (!top || cur.power > top.power) {
          teamTopPlayer.set(team.id, { name: cur.name, power: cur.power });
        }
      });
    },
  );

  const teamRows: RankingRow[] = [...teamAgg.values()].map((r) => {
    const gamesPlayed = r.wins + r.losses + r.ties;
    const mvp = teamTopPlayer.get(r.id)?.name ?? null;
    return {
      id: r.id,
      subject: r.name,
      team: null,
      gamesPlayed,
      wins: r.wins,
      losses: r.losses,
      goals: r.pf,
      goalsAgainst: r.pa,
      assists: 0,
      defenses: 0,
      goalsAvg: gamesPlayed > 0 ? round2(r.pf / gamesPlayed) : 0,
      assistsAvg: 0,
      defensesAvg: 0,
      power: round1(r.power),
      streak: r.streak,
      mvp,
      tournamentIds: r.tournamentIds,
    };
  });
  const playerRankingRows: RankingRow[] = [...playerRows.values()].map((r) => ({
    id: r.id,
    subject: r.name,
    team: r.team,
    gamesPlayed: r.gamesPlayed,
    wins: 0,
    losses: 0,
    goals: r.goals,
    goalsAgainst: 0,
    assists: r.assists,
    defenses: r.defenses,
    goalsAvg: round2(r.goalsAvg),
    assistsAvg: round2(r.assistsAvg),
    defensesAvg: round2(r.defensesAvg),
    power: round1(r.power),
    streak: r.streak,
    mvp: null,
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
          filterTeam: common.team,
          allTeams: common.all,
          team: common.team,
          player: common.player,
          power: dict.publicStats.power,
          goals: dict.publicStats.goals,
          assists: dict.publicStats.assists,
          defenses: dict.publicStats.defenses,
          goalsAvg: dict.publicStats.goalAverage,
          assistsAvg: dict.publicStats.assistAverage,
          defensesAvg: dict.publicStats.defenseAverage,
          mvp: dict.publicStats.mvp,
          gamesPlayed: common.gamesPlayed,
          gamesPlayedShort: common.gamesPlayedShort,
          sortToggle: dict.publicStats.sortToggle,
          wins: common.wins,
          losses: common.lossesShort,
          pf: common.pf,
          pa: common.pa,
          streak: dict.publicStats.streak,
        }}
      />
    </AppShell>
  );
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
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
