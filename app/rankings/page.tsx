import Link from "next/link";

import { AppShell } from "@/app/_components/AppShell";
import {
  computeStandings,
  formatPlayerName,
  gamesApi,
  playersApi,
  teamsApi,
  teamColor,
  tournamentsApi,
  type Player,
  type Team,
  type Tournament,
} from "@/utils/api";
import { getServerLocale } from "@/utils/i18n-server";

export const revalidate = 60;

type SearchParams = Promise<{ year?: string }>;

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { dict } = await getServerLocale();
  const common = dict.common;
  const rk = dict.rankings;
  const nav = dict.navigation;

  const { year } = await searchParams;

  const tournaments = await tournamentsApi.list(50).catch(() => []);

  // Derive the set of years from tournament start dates (for the filter UI).
  const years = Array.from(
    new Set(
      tournaments
        .map((t) => new Date(t.start_date).getFullYear())
        .filter((y) => Number.isFinite(y)),
    ),
  ).sort((a, b) => b - a);

  const selectedYear = year ? Number(year) : null;
  const activeFilter =
    selectedYear !== null && Number.isFinite(selectedYear) && years.includes(selectedYear)
      ? selectedYear
      : null;
  const filteredTournaments = activeFilter === null
    ? tournaments
    : tournaments.filter((t) => new Date(t.start_date).getFullYear() === activeFilter);

// For every tournament, compute its standings. We do this in parallel
  // and only fetch games per tournament.
  const perTournament = await Promise.all(
    filteredTournaments.map(async (t) => {
      const [teams, games] = await Promise.all([
        teamsApi.listByTournament(t.id).catch(() => []),
        gamesApi.listByTournament(t.id).catch(() => []),
      ]);
      return {
        tournament: t,
        standings: computeStandings(teams, games),
        totalGames: games.length,
      };
    }),
  );

  // League-wide team ranking by wins (across all tournaments).
  const teamTotals = new Map<
    number,
    { team: Team; wins: number; losses: number; gf: number; ga: number; games: number }
  >();
  // League-wide player ranking by goals (sum across every tournament we
  // can reach via the per-player stats endpoint).
  const playerGoalTotals = new Map<number, { player: Player & { team?: Team }; goals: number; assists: number; defenses: number }>();

  for (const { tournament, standings } of perTournament) {
    for (const row of standings) {
      const cur =
        teamTotals.get(row.team.id) ?? {
          team: row.team,
          wins: 0,
          losses: 0,
          gf: 0,
          ga: 0,
          games: 0,
        };
      cur.wins += row.wins;
      cur.losses += row.losses;
      cur.gf += row.gf;
      cur.ga += row.ga;
      cur.games += row.played;
      teamTotals.set(row.team.id, cur);
    }
  }

  // Pull every player's per-tournament stats in parallel (best effort).
  const allTeams = perTournament.flatMap((p) => p.standings.map((s) => s.team));
  const allPlayersNested = await Promise.all(
    allTeams.map(async (t) => playersApi.listByTeam(t.id).catch(() => [])),
  );
  const allPlayers = allPlayersNested.flat();
  const teamById = new Map(allTeams.map((t) => [t.id, t]));

  await Promise.all(
    allPlayers.map(async (p) => {
      const stats = await playersApi.stats(p.id).catch(() => null);
      if (!stats) return;
      const cur =
        playerGoalTotals.get(p.id) ?? {
          player: { ...p, team: teamById.get(p.team_id) },
          goals: 0,
          assists: 0,
          defenses: 0,
        };
      for (const row of stats.per_tournament) {
        cur.goals += row.goals;
        cur.assists += row.assists;
        cur.defenses += row.defenses;
      }
      playerGoalTotals.set(p.id, cur);
    }),
  );

  const teamRanking = [...teamTotals.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.gf - b.ga - (a.gf - a.ga);
  });
  const goalRanking = [...playerGoalTotals.values()]
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 10);
const assistRanking = [...playerGoalTotals.values()]
    .sort((a, b) => b.assists - a.assists)
    .slice(0, 10);
  const defenseRanking = [...playerGoalTotals.values()]
    .sort((a, b) => b.defenses - a.defenses)
    .slice(0, 10);

  return (
<AppShell
      brandSubtitle={rk.title}
      footerText={common.footer}
      authLinks={[
        { label: nav.tournaments, href: "/tournaments", variant: "ghost" },
        { label: nav.admin, href: "/admin/login", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
<div className="ps-section">
          <span className="ps-section__eyebrow">{rk.eyebrow}</span>
          <h1>{rk.title}</h1>
          <p>{rk.subtitle}</p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <span
            className="ps-section__eyebrow"
            style={{ marginRight: 4 }}
          >
            {rk.filterYear}
          </span>
          <Link
            href="/rankings"
            className={
              activeFilter === null
                ? "ps-status-badge ps-status-badge--active"
                : "ps-status-badge ps-status-badge--pending"
            }
            style={{ textDecoration: "none" }}
          >
            {rk.filterAllEvents}
          </Link>
          {years.map((y) => (
            <Link
              key={y}
              href={`/rankings?year=${y}`}
              className={
                activeFilter === y
                  ? "ps-status-badge ps-status-badge--active"
                  : "ps-status-badge ps-status-badge--pending"
              }
              style={{ textDecoration: "none" }}
            >
              {y}
            </Link>
          ))}
        </div>

        <div className="ps-split ps-split--1-2">
          <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
            <header
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--ps-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2 style={{ fontSize: 18 }}>{rk.topTeams}</h2>
              <span className="ps-pill">{teamRanking.length} {common.teams}</span>
            </header>
            {teamRanking.length === 0 ? (
              <p
                style={{
                  color: "var(--ps-text-muted)",
                  padding: 16,
                  fontSize: 13,
                }}
              >
                {common.noData}
              </p>
            ) : (
              <table className="ps-table">
                <thead>
                  <tr>
                  <th style={{ width: 40 }}>#</th>
                    <th>{common.team}</th>
                    <th style={{ textAlign: "right" }}>{common.wins}</th>
                    <th style={{ textAlign: "right" }}>{common.lossesShort}</th>
                    <th style={{ textAlign: "right" }}>{common.pf}</th>
                    <th style={{ textAlign: "right" }}>{common.pa}</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRanking.map((row, i) => (
                    <tr key={row.team.id}>
                      <td>
                        <span
                          className={
                            i === 0
                              ? "ps-table__rank ps-table__rank--top"
                              : "ps-table__rank"
                          }
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/teams/${row.team.id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            color: "var(--ps-text)",
                            fontWeight: 600,
                          }}
                        >
                          <span
                            className="ps-disc ps-disc--sm"
                            style={{
                              background: teamColor(row.team.name) ?? undefined,
                              color: "#fff",
                              borderColor:
                                teamColor(row.team.name) ?? undefined,
                            }}
                          >
                            {row.team.name.slice(0, 2).toUpperCase()}
                          </span>
                          {row.team.name}
                        </Link>
                      </td>
                      <td
                        className="ps-table__num"
                        style={{ textAlign: "right" }}
                      >
                        {row.wins}
                      </td>
                      <td
                        className="ps-table__num"
                        style={{ textAlign: "right" }}
                      >
                        {row.losses}
                      </td>
                      <td
                        className="ps-table__num"
                        style={{ textAlign: "right" }}
                      >
                        {row.gf}
                      </td>
                      <td
                        className="ps-table__num"
                        style={{ textAlign: "right" }}
                      >
                        {row.ga}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
<Leaderboard
              title={rk.topScorers}
              noData={common.noData}
              rows={goalRanking.map((r) => ({
                href: `/players/${r.player.id}`,
                rank: iFromId(playerGoalTotals, r.player.id, "goals"),
                discLabel: r.player.team?.name.slice(0, 2).toUpperCase() ?? "—",
                discColor: teamColor(r.player.team?.name),
                name: formatPlayerName(r.player),
                meta: r.player.team?.name ?? "—",
                value: r.goals,
              }))}
            />
<Leaderboard
              title={rk.topAssists}
              noData={common.noData}
              rows={assistRanking.map((r) => ({
                href: `/players/${r.player.id}`,
                rank: iFromId(playerGoalTotals, r.player.id, "assists"),
                discLabel: r.player.team?.name.slice(0, 2).toUpperCase() ?? "—",
                discColor: teamColor(r.player.team?.name),
                name: formatPlayerName(r.player),
                meta: r.player.team?.name ?? "—",
                value: r.assists,
              }))}
            />
<Leaderboard
              title={rk.topDefenses}
              noData={common.noData}
              rows={defenseRanking.map((r) => ({
                href: `/players/${r.player.id}`,
                rank: iFromId(playerGoalTotals, r.player.id, "defenses"),
                discLabel: r.player.team?.name.slice(0, 2).toUpperCase() ?? "—",
                discColor: teamColor(r.player.team?.name),
                name: formatPlayerName(r.player),
                meta: r.player.team?.name ?? "—",
                value: r.defenses,
              }))}
            />
          </div>
        </div>

<div style={{ marginTop: 32 }}>
          <div className="ps-section">
            <h2>{rk.allTournaments}</h2>
            <p>{rk.perTournamentStandings}</p>
          </div>
          <div
            className="ps-card-list"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            {perTournament.map(({ tournament, standings }) => (
              <div key={tournament.id} className="ps-card">
                <header
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <h3 style={{ fontSize: 16 }}>{tournament.name}</h3>
                  <Link
                    href={`/tournaments/${tournament.id}`}
className="ps-pill"
                    style={{ textDecoration: "none" }}
                  >
                    {common.open} →
                  </Link>
                </header>
                <ol
                  style={{
                    padding: 0,
                    listStyle: "none",
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {standings.slice(0, 4).map((row, i) => (
                    <li
                      key={row.team.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: 13,
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
                          style={{ color: "var(--ps-text)" }}
                        >
                          {row.team.name}
                        </Link>
                      </span>
                      <span className="ps-table__num">
                        {row.wins}-{row.losses}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function iFromId(
  map: Map<number, { goals: number; assists: number; defenses: number }>,
  id: number,
  field: "goals" | "assists" | "defenses",
): number {
  const sorted = [...map.entries()].sort((a, b) => b[1][field] - a[1][field]);
  return sorted.findIndex(([pid]) => pid === id);
}

function Leaderboard({
  title,
  rows,
  noData = "No data yet.",
}: {
  title: string;
  rows: Array<{
    href: string;
    rank: number;
    discLabel: string;
    discColor: string | null;
    name: string;
    meta: string;
    value: number;
  }>;
  noData?: string;
}) {
  return (
    <div className="ps-card">
      <div className="ps-leaderboard">
        <h3 className="ps-leaderboard__title">{title}</h3>
        {rows.length === 0 ? (
          <p style={{ color: "var(--ps-text-muted)", fontSize: 13, margin: 0 }}>
            {noData}
          </p>
        ) : (
          rows.map((row) => (
            <Link
              key={row.href}
              href={row.href}
              className="ps-leaderboard-row"
              style={{ textDecoration: "none" }}
            >
              <span
                className={
                  row.rank === 0
                    ? "ps-leaderboard-row__rank ps-leaderboard-row__rank--top"
                    : "ps-leaderboard-row__rank"
                }
              >
                {row.rank + 1}
              </span>
              <span
                className="ps-disc ps-disc--sm"
                style={{
                  background: row.discColor ?? undefined,
                  color: "#fff",
                  borderColor: row.discColor ?? undefined,
                }}
              >
                {row.discLabel}
              </span>
              <span>
                <span className="ps-leaderboard-row__name">{row.name}</span>
                <span className="ps-leaderboard-row__meta">
                  {" "}
                  · {row.meta}
                </span>
              </span>
              <span
                className={
                  row.rank === 0
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
