import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { getServerLocale } from "@/utils/i18n-server";
import { phasesApi, tournamentsApi } from "@/utils/api";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function TournamentPhasesPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { dict } = await getServerLocale();
  const common = dict.common;
  const trn = dict.tournament;
  const st = dict.standings;
  const nav = dict.navigation;

  const { id: rawId } = await params;
  const tournamentId = Number(rawId);
  if (!Number.isFinite(tournamentId)) notFound();

  const [tournament, phases] = await Promise.all([
    tournamentsApi.get(tournamentId).catch(() => null),
    phasesApi.listByTournament(tournamentId).catch(() => []),
  ]);
  if (!tournament) notFound();

  const sorted = [...phases].sort((a, b) => a.phase_order - b.phase_order);

  return (
    <AppShell
      brandSubtitle={`${tournament.name} · ${dict.adminTournaments.phases}`}
      footerText={common.footer}
      authLinks={[
        {
          label: trn.backToTournament,
          href: `/tournaments/${tournament.id}`,
          variant: "ghost",
        },
        { label: nav.rankings, href: "/rankings", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <div className="ps-section">
          <span className="ps-section__eyebrow">{st.eyebrow}</span>
          <h1>{tournament.name}</h1>
          <p>{trn.multiPhase}</p>
        </div>

        {sorted.length === 0 ? (
          <div className="ps-card">
            <p style={{ color: "var(--ps-text-muted)", margin: 0 }}>
              {common.noData}
            </p>
          </div>
        ) : (
          <div className="ps-card-list">
            {sorted.map((phase) => {
              const isBracket = phase.phase_type === "bracket";
              const status = phase.status;
              return (
                <Link
                  key={phase.id}
                  href={`/tournaments/${tournament.id}/phases/${phase.id}`}
                  className="ps-card ps-card--linked"
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    <span className="ps-status-badge ps-status-badge--completed">
                      #{phase.phase_order}
                    </span>
                    <span className="ps-pill">
                      {isBracket ? trn.playoffs : trn.roundRobin}
                    </span>
                    <span
                      className={
                        status === "completed"
                          ? "ps-status-badge ps-status-badge--completed"
                          : status === "in_progress"
                            ? "ps-live-pill"
                            : "ps-status-badge"
                      }
                    >
                      {status === "completed"
                        ? common.completed
                        : status === "in_progress"
                          ? common.live
                          : dict.adminTournaments.phasePending}
                    </span>
                  </div>
                  <h2 style={{ fontSize: 18, marginTop: 4 }}>{phase.name}</h2>
                  <p style={{ color: "var(--ps-text-muted)", margin: 0 }}>
                    {trn.classification}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
