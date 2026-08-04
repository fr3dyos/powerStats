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

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
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
      authLinks={[
        { label: "All tournaments", href: "/tournaments", variant: "ghost" },
        { label: "Rankings", href: "/rankings", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <div className="ps-section">
          <span className="ps-section__eyebrow">Multi-phase tournament</span>
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
            {teams.length} teams
          </span>
          <span className="ps-status-badge ps-status-badge--completed">
            {completed.length}/{games.length} games played
          </span>
          {live.length > 0 ? (
            <span className="ps-live-pill">{live.length} live</span>
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
                <span className="ps-section__eyebrow">Pool A</span>
                <h2 style={{ fontSize: 18, marginTop: 4 }}>
                  Classification
                </h2>
              </div>
              <Link
                href={`/tournaments/${tournament.id}/bracket`}
                className="ps-btn ps-btn--secondary"
                style={{ fontSize: 12, padding: "6px 12px" }}
              >
                View bracket
              </Link>
            </header>
            <table className="ps-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Team</th>
                  <th style={{ textAlign: "right" }}>W</th>
                  <th style={{ textAlign: "right" }}>L</th>
                  <th style={{ textAlign: "right" }}>Diff</th>
                  <th style={{ textAlign: "right" }}>PF</th>
                  <th style={{ textAlign: "right" }}>PA</th>
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
              <h3 style={{ marginTop: 4 }}>Round-robin</h3>
              <p>
                Every team plays every other team once across{" "}
                {teams.length > 1
                  ? `${(teams.length * (teams.length - 1)) / 2}`
                  : "—"}
                {" "}fixtures. Top four advance to the bracket.
              </p>
              <Link
                href={`/tournaments/${tournament.id}/bracket`}
                className="ps-btn"
                style={{ marginTop: 8, alignSelf: "flex-start" }}
              >
                See bracket
              </Link>
            </div>
            <div className="ps-card">
              <span className="ps-section__eyebrow">Phase 2</span>
              <h3 style={{ marginTop: 4 }}>Playoffs</h3>
              <p>
                Single-elimination bracket with quarterfinals, semifinals, and
                finals — plus consolation games to decide 3rd–6th place.
              </p>
              <Link
                href={`/tournaments/${tournament.id}/bracket`}
                className="ps-btn"
                style={{ marginTop: 8, alignSelf: "flex-start" }}
              >
                Bracket
              </Link>
            </div>
            <div className="ps-card">
              <span className="ps-section__eyebrow">Stats</span>
              <h3 style={{ marginTop: 4 }}>Leaderboards</h3>
              <p>
                Top scorers, assist leaders, and Spirit of the Game standings.
              </p>
              <Link
                href={`/tournaments/${tournament.id}/public`}
                className="ps-btn"
                style={{ marginTop: 8, alignSelf: "flex-start" }}
              >
                View stats
              </Link>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
