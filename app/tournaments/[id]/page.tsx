import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import {
  computeStandings,
  formatDateRange,
  gamesApi,
  teamsApi,
  teamColor,
  tournamentsApi,
} from "@/utils/api";
import { getServerLocale } from "@/utils/i18n-server";

export const dynamic = "force-dynamic";

type Params = { id: string };

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

  const [tournament, teams, games] = await Promise.all([
    tournamentsApi.get(id).catch(() => null),
    teamsApi.listByTournament(id).catch(() => []),
    gamesApi.listByTournament(id).catch(() => []),
  ]);

  if (!tournament) notFound();

  const standings = computeStandings(teams, games);
  const completed = games.filter((g) => g.is_completed);
  const live = games.filter((g) => !g.is_completed);

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
            <span className="ps-live-pill">{live.length} {common.live}</span>
          ) : null}
        </div>

        <div className="ps-split ps-split--2-1">
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
              <Link
                href={`/tournaments/${tournament.id}/bracket`}
                className="ps-btn ps-btn--secondary"
                style={{ fontSize: 12, padding: "6px 12px" }}
              >
                {common.viewBracket}
              </Link>
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
              <span className="ps-section__eyebrow">Phase 1</span>
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
              <span className="ps-section__eyebrow">Phase 2</span>
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
              <span className="ps-section__eyebrow">Stats</span>
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
      </section>
    </AppShell>
  );
}
