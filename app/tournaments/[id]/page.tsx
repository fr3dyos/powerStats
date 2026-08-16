import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import {
  computeStandings,
  formatDate,
  formatDateRange,
  gamesApi,
  phasesApi,
  teamsApi,
  teamColor,
  tournamentsApi,
  type Game,
  type Team,
} from "@/utils/api";
import { getServerLocale } from "@/utils/i18n-server";

export const revalidate = 60;

type Params = { id: string };

/** Look up home/away teams for a fixture (tolerates missing data). */
function matchTeams(game: Game, teamMap: Map<number, Team>) {
  return {
    home: teamMap.get(game.home_team_id) ?? null,
    away: teamMap.get(game.away_team_id) ?? null,
  };
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { dict } = await getServerLocale();
  const common = dict.common;
  const trn = dict.tournament;
  const nav = dict.navigation;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();

  const [tournament, teams, games, phases] = await Promise.all([
    tournamentsApi.get(id).catch(() => null),
    teamsApi.listByTournament(id).catch(() => []),
    gamesApi.listByTournament(id).catch(() => []),
    phasesApi.listByTournament(id).catch(() => []),
  ]);

  if (!tournament) notFound();

  const teamMap = new Map<number, Team>(
    teams.map((t) => [t.id, t] as const),
  );
  const standings = computeStandings(teams, games);
  const completed = games.filter((g) => g.is_completed);
  const live = games.filter((g) => !g.is_completed);

  // Live games: earliest scheduled first, then stable fallback by id.
  const liveSorted = [...live].sort((a, b) => {
    const at = a.start_time
      ? Date.parse(a.start_time)
      : Number.POSITIVE_INFINITY;
    const bt = b.start_time
      ? Date.parse(b.start_time)
      : Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    return a.id - b.id;
  });
  // Completed fixtures: most recently finished first.
  const completedSorted = [...completed].sort((a, b) => {
    const at = a.end_time
      ? Date.parse(a.end_time)
      : a.start_time
        ? Date.parse(a.start_time)
        : 0;
    const bt = b.end_time
      ? Date.parse(b.end_time)
      : b.start_time
        ? Date.parse(b.start_time)
        : 0;
    if (at !== bt) return bt - at;
    return b.id - a.id;
  });

  return (
    <AppShell
      brandSubtitle={tournament.name}
      footerText={common.footer}
      authLinks={[
        { label: trn.title, href: "/tournaments", variant: "ghost" },
        { label: nav.rankings, href: "/rankings", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        {/* ─── Overview ─────────────────────────────────────────────── */}
        <header>
          <div className="ps-section">
            <span className="ps-section__eyebrow">{trn.multiPhase}</span>
            <h1>{tournament.name}</h1>
            <p>
              {formatDateRange(tournament.start_date, tournament.end_date)}
              {tournament.location ? ` · ${tournament.location}` : ""}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 24,
            }}
          >
            <span className="ps-status-badge ps-status-badge--completed">
              {teams.length} {common.teams}
            </span>
            <span className="ps-status-badge ps-status-badge--completed">
              {completed.length}/{games.length} {common.gamesPlayed}
            </span>
            {live.length > 0 ? (
              <span className="ps-live-pill">
                {live.length} {common.live}
              </span>
            ) : null}
          </div>
        </header>

        {/* ─── Standings ────────────────────────────────────────────── */}
        <div className="ps-split ps-split--2-1" style={{ marginBottom: 32 }}>
          <div
            className="ps-card"
            style={{ padding: 0, overflow: "hidden" }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--ps-border)",
              }}
            >
              <div>
                <span className="ps-section__eyebrow">{trn.poolA}</span>
                <h2 style={{ fontSize: 18, marginTop: 4 }}>
                  {trn.classification}
                </h2>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {phases.length > 0 ? (
                  <Link
                    href={`/tournaments/${tournament.id}/phases/${phases[0].id}/standings`}
                    className="ps-btn ps-btn--secondary"
                    style={{ fontSize: 12, padding: "6px 12px" }}
                  >
                    {dict.standings.title}
                  </Link>
                ) : null}
                {phases.length > 1 ? (
                  <Link
                    href={`/tournaments/${tournament.id}/phases`}
                    className="ps-btn ps-btn--secondary"
                    style={{ fontSize: 12, padding: "6px 12px" }}
                  >
                    {dict.adminTournaments.phases}
                  </Link>
                ) : null}
                <Link
                  href={`/tournaments/${tournament.id}/bracket`}
                  className="ps-btn ps-btn--secondary"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                >
                  {common.viewBracket}
                </Link>
              </div>
            </header>
            <table className="ps-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>{common.team}</th>
                  <th style={{ textAlign: "right" }}>{common.wins}</th>
                  <th style={{ textAlign: "right" }}>{common.lossesShort}</th>
                  <th style={{ textAlign: "right" }}>{common.diff}</th>
                  <th style={{ textAlign: "right" }}>{common.pf}</th>
                  <th style={{ textAlign: "right" }}>{common.pa}</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => (
                  <tr key={row.team.id}>
                    <td className="ps-table__rank">
                      <span
                        className={
                          i < 4
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
                          gap: 10,
                          color: "var(--ps-text)",
                          fontWeight: 600,
                        }}
                      >
                        <span
                          className="ps-disc ps-disc--sm"
                          style={{
                            background: teamColor(row.team.name) ?? undefined,
                            color: "#fff",
                            borderColor: teamColor(row.team.name) ?? undefined,
                          }}
                        >
                          {row.team.name.slice(0, 2).toUpperCase()}
                        </span>
                        {row.team.name}
                      </Link>
                    </td>
                    <td className="ps-table__num" style={{ textAlign: "right" }}>
                      {row.wins}
                    </td>
                    <td className="ps-table__num" style={{ textAlign: "right" }}>
                      {row.losses}
                    </td>
                    <td
                      className="ps-table__num"
                      style={{
                        textAlign: "right",
                        color:
                          row.diff > 0
                            ? "var(--ps-lime)"
                            : row.diff < 0
                              ? "var(--ps-danger)"
                              : "var(--ps-text-muted)",
                      }}
                    >
                      {row.diff > 0 ? `+${row.diff}` : row.diff}
                    </td>
                    <td className="ps-table__num" style={{ textAlign: "right" }}>
                      {row.gf}
                    </td>
                    <td className="ps-table__num" style={{ textAlign: "right" }}>
                      {row.ga}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="ps-card">
              <span className="ps-section__eyebrow">{trn.roundRobin}</span>
              <h3 style={{ marginTop: 4 }}>{trn.roundRobin}</h3>
              <p>
                {trn.roundRobinCopy.replace(
                  "{fixtures}",
                  teams.length > 1
                    ? `${(teams.length * (teams.length - 1)) / 2}`
                    : "—",
                )}
              </p>
              <Link
                href={`/tournaments/${tournament.id}/bracket`}
                className="ps-btn"
                style={{ marginTop: 8, alignSelf: "flex-start" }}
              >
                {trn.bracket}
              </Link>
            </div>
            <div className="ps-card">
              <span className="ps-section__eyebrow">{trn.playoffs}</span>
              <h3 style={{ marginTop: 4 }}>{trn.playoffs}</h3>
              <p>{trn.playoffsCopy}</p>
              <Link
                href={`/tournaments/${tournament.id}/bracket`}
                className="ps-btn"
                style={{ marginTop: 8, alignSelf: "flex-start" }}
              >
                {trn.bracket}
              </Link>
            </div>
            <div className="ps-card">
              <span className="ps-section__eyebrow">{common.viewStats}</span>
              <h3 style={{ marginTop: 4 }}>{trn.leaderboards}</h3>
              <p>{trn.leaderboardsCopy}</p>
              <Link
                href={`/tournaments/${tournament.id}/public`}
                className="ps-btn"
                style={{ marginTop: 8, alignSelf: "flex-start" }}
              >
                {common.viewStats}
              </Link>
            </div>
          </div>
        </div>

        {/* ─── Live games ───────────────────────────────────────────── */}
        <section style={{ marginBottom: 32 }}>
          <div className="ps-section">
            <span className="ps-section__eyebrow">{common.liveNow}</span>
            <h2>{common.liveNow}</h2>
            <p>{trn.gamesInProgress.replace("{count}", String(live.length))}</p>
          </div>

          {liveSorted.length === 0 ? (
            <div className="ps-card" style={{ textAlign: "center" }}>
              <p style={{ margin: 0 }}>{common.noGames}</p>
            </div>
          ) : (
            <div className="ps-card-list">
              {liveSorted.map((g) => {
                const { home, away } = matchTeams(g, teamMap);
                const homeColor = teamColor(home?.name);
                const awayColor = teamColor(away?.name);
                return (
                  <Link
                    key={g.id}
                    href={`/games/${g.id}`}
                    className="ps-card ps-card--linked"
                    style={{
                      borderLeft: "3px solid var(--ps-lime)",
                      textDecoration: "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 8,
                      }}
                    >
                      <span className="ps-live-pill">{common.live}</span>
                      {g.field_number !== null ? (
                        <span className="ps-status-badge ps-status-badge--completed">
                          {common.field} {g.field_number}
                        </span>
                      ) : null}
                      {g.start_time ? (
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--ps-text-muted)",
                            marginLeft: "auto",
                          }}
                        >
                          {formatDate(g.start_time)}
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          justifyContent: "flex-end",
                        }}
                      >
                        <strong>{home?.name ?? "TBD"}</strong>
                        <span
                          className="ps-disc ps-disc--sm"
                          style={{
                            background: homeColor ?? undefined,
                            color: "#fff",
                            borderColor: homeColor ?? undefined,
                          }}
                        >
                          {(home?.name ?? "?").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--ps-font-display)",
                          fontWeight: 800,
                          fontSize: 18,
                          fontVariantNumeric: "tabular-nums",
                          padding: "4px 10px",
                          background: "var(--ps-surface-container-high)",
                          borderRadius: "var(--ps-radius)",
                        }}
                      >
                        {g.home_score} – {g.away_score}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          className="ps-disc ps-disc--sm"
                          style={{
                            background: awayColor ?? undefined,
                            color: "#fff",
                            borderColor: awayColor ?? undefined,
                          }}
                        >
                          {(away?.name ?? "?").slice(0, 2).toUpperCase()}
                        </span>
                        <strong>{away?.name ?? "TBD"}</strong>
                      </div>
                    </div>
                    <span className="ps-card__footer">{common.score} →</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── Completed fixtures ───────────────────────────────────── */}
        <section style={{ marginBottom: 32 }}>
          <div className="ps-section">
            <span className="ps-section__eyebrow">{common.completed}</span>
            <h2>{common.completed}</h2>
            <p>
              {completed.length}{" "}
              {completed.length === 1
                ? common.gamesPlayedShort
                : common.games}{" "}
              {common.completed}
            </p>
          </div>

          {completedSorted.length === 0 ? (
            <div className="ps-card" style={{ textAlign: "center" }}>
              <p style={{ margin: 0 }}>{common.noGames}</p>
            </div>
          ) : (
            <div className="ps-card-list">
              {completedSorted.map((g) => {
                const { home, away } = matchTeams(g, teamMap);
                const homeColor = teamColor(home?.name);
                const awayColor = teamColor(away?.name);
                const homeWon = g.home_score > g.away_score;
                const awayWon = g.away_score > g.home_score;
                const tied = g.home_score === g.away_score;
                return (
                  <Link
                    key={g.id}
                    href={`/games/${g.id}`}
                    className="ps-card ps-card--linked"
                    style={{
                      borderLeft: "3px solid var(--ps-text-muted)",
                      textDecoration: "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 8,
                      }}
                    >
                      <span className="ps-status-badge ps-status-badge--completed">
                        {common.completed}
                      </span>
                      {g.field_number !== null ? (
                        <span className="ps-status-badge ps-status-badge--completed">
                          {common.field} {g.field_number}
                        </span>
                      ) : null}
                      {g.end_time ?? g.start_time ? (
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--ps-text-muted)",
                            marginLeft: "auto",
                          }}
                        >
                          {formatDate(g.end_time ?? g.start_time)}
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          justifyContent: "flex-end",
                          color: homeWon
                            ? "var(--ps-text)"
                            : awayWon
                              ? "var(--ps-text-muted)"
                              : "var(--ps-text)",
                          fontWeight: homeWon ? 700 : 500,
                        }}
                      >
                        <strong>{home?.name ?? "TBD"}</strong>
                        <span
                          className="ps-disc ps-disc--sm"
                          style={{
                            background: homeColor ?? undefined,
                            color: "#fff",
                            borderColor: homeColor ?? undefined,
                          }}
                        >
                          {(home?.name ?? "?").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--ps-font-display)",
                          fontWeight: 800,
                          fontSize: 18,
                          fontVariantNumeric: "tabular-nums",
                          padding: "4px 10px",
                          background: "var(--ps-surface-container-high)",
                          borderRadius: "var(--ps-radius)",
                        }}
                      >
                        {g.home_score} – {g.away_score}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          color: awayWon
                            ? "var(--ps-text)"
                            : homeWon
                              ? "var(--ps-text-muted)"
                              : "var(--ps-text)",
                          fontWeight: awayWon ? 700 : 500,
                        }}
                      >
                        <span
                          className="ps-disc ps-disc--sm"
                          style={{
                            background: awayColor ?? undefined,
                            color: "#fff",
                            borderColor: awayColor ?? undefined,
                          }}
                        >
                          {(away?.name ?? "?").slice(0, 2).toUpperCase()}
                        </span>
                        <strong>{away?.name ?? "TBD"}</strong>
                      </div>
                    </div>
                    <span className="ps-card__footer">
                      {common.viewTournament} →
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </AppShell>
  );
}
