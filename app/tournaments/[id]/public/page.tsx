import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import {
  formatPlayerName,
  gamesApi,
  playersApi,
  teamsApi,
  teamColor,
  tournamentsApi,
  type Player,
  type Team,
} from "@/utils/api";

export const dynamic = "force-dynamic";

type Params = { id: string };

type StatRow = {
  player: Player & { team: Team | undefined };
  value: number;
};

export default async function TournamentPublicStatsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();

  const [tournament, teams] = await Promise.all([
    tournamentsApi.get(id).catch(() => null),
    teamsApi.listByTournament(id).catch(() => []),
  ]);
  if (!tournament) notFound();

  // Gather every player + their tournament stats in parallel.
  const playersByTeam = await Promise.all(
    teams.map(async (t) => ({
      team: t,
      players: await playersApi.listByTeam(t.id).catch(() => []),
    })),
  );

  const allPlayers: Array<Player & { team: Team | undefined }> = [];
  for (const { team, players } of playersByTeam) {
    for (const p of players) allPlayers.push({ ...p, team });
  }

  // Fetch every player's stats in parallel.
  const statsRows = await Promise.all(
    allPlayers.map(async (p) => {
      const res = await playersApi.stats(p.id).catch(() => null);
      const row = res?.per_tournament.find((s) => s.tournament_id === id);
      return { player: p, stats: row ?? null };
    }),
  );

  const goalLeaders: StatRow[] = statsRows
    .filter((r) => r.stats && r.stats.goals > 0)
    .sort((a, b) => (b.stats!.goals - a.stats!.goals))
    .slice(0, 5)
    .map((r) => ({ player: r.player, value: r.stats!.goals }));

  const assistLeaders: StatRow[] = statsRows
    .filter((r) => r.stats && r.stats.assists > 0)
    .sort((a, b) => (b.stats!.assists - a.stats!.assists))
    .slice(0, 5)
    .map((r) => ({ player: r.player, value: r.stats!.assists }));

  const defenseLeaders: StatRow[] = statsRows
    .filter((r) => r.stats && r.stats.defenses > 0)
    .sort((a, b) => (b.stats!.defenses - a.stats!.defenses))
    .slice(0, 5)
    .map((r) => ({ player: r.player, value: r.stats!.defenses }));

  const games = await gamesApi.listByTournament(id).catch(() => []);
  const totalGoals = games.reduce((acc, g) => acc + g.home_score + g.away_score, 0);
  const completed = games.filter((g) => g.is_completed).length;

  return (
    <AppShell
      brandSubtitle={`${tournament.name} · Stats`}
      authLinks={[
        { label: "← Tournament hub", href: `/tournaments/${id}`, variant: "ghost" },
        { label: "Bracket", href: `/tournaments/${id}/bracket`, variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <div className="ps-section">
          <span className="ps-section__eyebrow">Public stats</span>
          <h1>Player &amp; team leaderboards</h1>
          <p>
            Top performers from the tournament — scorers, playmakers, and
            defenders. Click any player to see their full profile.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value">{totalGoals}</span>
            <span className="ps-stat-tile__label">Goals scored</span>
          </div>
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value">{teams.length}</span>
            <span className="ps-stat-tile__label">Teams</span>
          </div>
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value">{allPlayers.length}</span>
            <span className="ps-stat-tile__label">Players</span>
          </div>
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value ps-stat-tile__value--accent">
              {completed}
            </span>
            <span className="ps-stat-tile__label">Games played</span>
          </div>
        </div>

        <div className="ps-split ps-split--2-1">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            <Leaderboard
              title="Top scorers"
              rows={goalLeaders}
              valueSuffix="goals"
            />
            <Leaderboard
              title="Top assists"
              rows={assistLeaders}
              valueSuffix="assists"
            />
            <Leaderboard
              title="Top defenses"
              rows={defenseLeaders}
              valueSuffix="defenses"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="ps-card">
              <span className="ps-section__eyebrow">Spirit of the Game</span>
              <h3 style={{ marginTop: 4 }}>SOTG standings</h3>
              <p style={{ color: "var(--ps-text-muted)", fontSize: 13 }}>
                Spirit scores are not yet collected for this tournament. They
                will appear here once the tournament director enables SOTG
                ratings after each game.
              </p>
            </div>
            <div className="ps-card">
              <span className="ps-section__eyebrow">Top teams</span>
              <h3 style={{ marginTop: 4 }}>By goals scored</h3>
              <ol
                style={{
                  paddingLeft: 0,
                  listStyle: "none",
                  margin: "12px 0 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {teams
                  .map((t) => ({
                    team: t,
                    gf: games
                      .filter((g) => g.home_team_id === t.id || g.away_team_id === t.id)
                      .reduce(
                        (acc, g) =>
                          acc +
                          (g.home_team_id === t.id ? g.home_score : g.away_score),
                        0,
                      ),
                  }))
                  .sort((a, b) => b.gf - a.gf)
                  .slice(0, 5)
                  .map((row, i) => (
                    <li
                      key={row.team.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          className={
                            i === 0
                              ? "ps-table__rank ps-table__rank--top"
                              : "ps-table__rank"
                          }
                        >
                          {i + 1}
                        </span>
                        <span
                          className="ps-disc ps-disc--sm"
                          style={{
                            background:
                              teamColor(row.team.name) ?? undefined,
                            color: "#fff",
                            borderColor:
                              teamColor(row.team.name) ?? undefined,
                          }}
                        >
                          {row.team.name.slice(0, 2).toUpperCase()}
                        </span>
                        <Link
                          href={`/teams/${row.team.id}`}
                          style={{ color: "var(--ps-text)", fontWeight: 600 }}
                        >
                          {row.team.name}
                        </Link>
                      </span>
                      <span className="ps-table__num">{row.gf}</span>
                    </li>
                  ))}
              </ol>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function Leaderboard({
  title,
  rows,
  valueSuffix,
}: {
  title: string;
  rows: StatRow[];
  valueSuffix: string;
}) {
  return (
    <div className="ps-card">
      <div className="ps-leaderboard">
        <h3 className="ps-leaderboard__title">{title}</h3>
        {rows.length === 0 ? (
          <p style={{ color: "var(--ps-text-muted)", fontSize: 13, margin: 0 }}>
            No {valueSuffix} recorded yet.
          </p>
        ) : (
          rows.map((row, i) => (
            <Link
              key={row.player.id}
              href={`/players/${row.player.id}`}
              className="ps-leaderboard-row"
              style={{ textDecoration: "none" }}
            >
              <span
                className={
                  i === 0
                    ? "ps-leaderboard-row__rank ps-leaderboard-row__rank--top"
                    : "ps-leaderboard-row__rank"
                }
              >
                {i + 1}
              </span>
              <span
                className="ps-disc ps-disc--sm"
                style={{
                  background:
                    teamColor(row.player.team?.name) ?? undefined,
                  color: "#fff",
                  borderColor:
                    teamColor(row.player.team?.name) ?? undefined,
                }}
              >
                {row.player.team?.name.slice(0, 2).toUpperCase() ?? "—"}
              </span>
              <span>
                <span className="ps-leaderboard-row__name">
                  {formatPlayerName(row.player)}
                </span>
                <span className="ps-leaderboard-row__meta">
                  {" "}
                  · {row.player.team?.name ?? "—"}
                </span>
              </span>
              <span
                className={
                  i === 0
                    ? "ps-leaderboard-row__value ps-leaderboard-row__value--accent"
                    : "ps-leaderboard-row__value"
                }
              >
                {row.value}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
