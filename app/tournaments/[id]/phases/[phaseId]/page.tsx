import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { getServerLocale } from "@/utils/i18n-server";
import { phasesApi, teamColor, tournamentsApi } from "@/utils/api";

export const dynamic = "force-dynamic";

type Params = { id: string; phaseId: string };

/**
 * Phase detail page — used to be a placeholder. Now renders the phase's
 * standings table directly so the page is the canonical view (the
 * /standings sub-route is kept for backward-compatible URLs and adds a
 * "back to phase" link).
 */
export default async function PhaseDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id: rawTournamentId, phaseId: rawPhaseId } = await params;
  const tournamentId = Number(rawTournamentId);
  const phaseId = Number(rawPhaseId);
  if (!Number.isFinite(tournamentId) || !Number.isFinite(phaseId)) notFound();

  const [tournament, phase, standings] = await Promise.all([
    tournamentsApi.get(tournamentId).catch(() => null),
    phasesApi.get(phaseId).catch(() => null),
    phasesApi.standings(phaseId).catch(() => null),
  ]);
  if (!tournament || !phase) notFound();
  if (phase.tournament_id !== tournamentId) notFound();

  const { dict } = await getServerLocale();
  const common = dict.common;
  const nav = dict.navigation;
  const trn = dict.tournament;
  const st = dict.standings;

  const isBracket = phase.phase_type === "bracket";
  const standingsHref = `/tournaments/${tournamentId}/phases/${phaseId}/standings`;
  const bracketHref = `/tournaments/${tournamentId}/bracket`;

  const tabs: Array<{ label: string; href: string }> = isBracket
    ? [
        { label: st.title, href: standingsHref },
        { label: trn.bracket, href: bracketHref },
      ]
    : [{ label: st.title, href: standingsHref }];

  const phaseTypeLabel = isBracket ? trn.playoffs : trn.roundRobin;

  return (
    <AppShell
      brandSubtitle={`${tournament.name} · ${phase.name}`}
      footerText={common.footer}
      authLinks={[
        {
          label: trn.backToTournament,
          href: `/tournaments/${tournamentId}`,
          variant: "ghost",
        },
        { label: nav.rankings, href: "/rankings", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <div className="ps-section">
          <span className="ps-section__eyebrow">{st.eyebrow}</span>
          <h1>{phase.name}</h1>
          <p>
            {phaseTypeLabel} · #{phase.phase_order}
            {standings?.generated_at
              ? ` · ${new Date(standings.generated_at).toLocaleString()}`
              : ""}
          </p>
        </div>

        {/* Tab strip */}
        <nav
          aria-label={dict.adminTournaments.phases}
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="ps-btn ps-btn--ghost"
              style={{ fontSize: 13 }}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {!standings || standings.groups.length === 0 ? (
          <div className="ps-card">
            <p style={{ color: "var(--ps-text-muted)", margin: 0 }}>
              {st.noStandings}
            </p>
          </div>
        ) : (
          <>
            {standings.groups.map((group, gi) => (
              <div
                key={group.group_id ?? `g-${gi}`}
                className="ps-card"
                style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}
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
                    <span className="ps-section__eyebrow">
                      {group.group_name ?? st.phaseTitle}
                    </span>
                    <h2 style={{ fontSize: 18, marginTop: 4 }}>
                      {group.group_name ?? phaseTypeLabel}
                    </h2>
                  </div>
                  <span className="ps-pill">
                    {group.rows.length} {common.teams}
                  </span>
                </header>
                <div style={{ overflowX: "auto" }}>
                  <table className="ps-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>{st.pos}</th>
                        <th>{common.team}</th>
                        <th style={{ textAlign: "right" }}>{st.played}</th>
                        <th style={{ textAlign: "right" }}>{common.wins}</th>
                        <th style={{ textAlign: "right" }}>{st.draws}</th>
                        <th style={{ textAlign: "right" }}>{common.lossesShort}</th>
                        <th style={{ textAlign: "right" }}>{common.pf}</th>
                        <th style={{ textAlign: "right" }}>{common.pa}</th>
                        <th style={{ textAlign: "right" }}>{common.diff}</th>
                        <th style={{ textAlign: "right" }}>{st.points}</th>
                        <th style={{ textAlign: "right" }}>{st.spirit}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row, i) => (
                        <tr key={row.team_id}>
                          <td className="ps-table__rank">
                            <span
                              className={
                                i < 4
                                  ? "ps-table__rank ps-table__rank--top"
                                  : "ps-table__rank"
                              }
                            >
                              {row.position}
                            </span>
                          </td>
                          <td>
                            <Link
                              href={`/teams/${row.team_id}`}
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
                                  background:
                                    teamColor(row.team_name ?? "") ?? undefined,
                                  color: "#fff",
                                  borderColor:
                                    teamColor(row.team_name ?? "") ?? undefined,
                                }}
                              >
                                {(row.team_name ?? "??").slice(0, 2).toUpperCase()}
                              </span>
                              {row.team_name ?? "—"}
                            </Link>
                          </td>
                          <td className="ps-table__num" style={{ textAlign: "right" }}>
                            {row.played}
                          </td>
                          <td className="ps-table__num" style={{ textAlign: "right" }}>
                            {row.wins}
                          </td>
                          <td className="ps-table__num" style={{ textAlign: "right" }}>
                            {row.draws}
                          </td>
                          <td className="ps-table__num" style={{ textAlign: "right" }}>
                            {row.losses}
                          </td>
                          <td className="ps-table__num" style={{ textAlign: "right" }}>
                            {row.goals_for}
                          </td>
                          <td className="ps-table__num" style={{ textAlign: "right" }}>
                            {row.goals_against}
                          </td>
                          <td
                            className="ps-table__num"
                            style={{
                              textAlign: "right",
                              color:
                                row.goal_difference > 0
                                  ? "var(--ps-lime)"
                                  : row.goal_difference < 0
                                    ? "var(--ps-danger)"
                                    : "var(--ps-text-muted)",
                            }}
                          >
                            {row.goal_difference > 0
                              ? `+${row.goal_difference}`
                              : row.goal_difference}
                          </td>
                          <td className="ps-table__num" style={{ textAlign: "right" }}>
                            {row.points}
                          </td>
                          <td className="ps-table__num" style={{ textAlign: "right" }}>
                            {row.spirit_average > 0
                              ? row.spirit_average.toFixed(2)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {standings.tiebreakers.length > 0 ? (
              <div className="ps-card">
                <span className="ps-section__eyebrow">{st.tiebreakers}</span>
                <ul
                  style={{
                    margin: "8px 0 0",
                    paddingLeft: 20,
                    color: "var(--ps-text-muted)",
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  {standings.tiebreakers.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>
    </AppShell>
  );
}