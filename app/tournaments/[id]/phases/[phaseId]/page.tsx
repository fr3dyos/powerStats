import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { getServerLocale } from "@/utils/i18n-server";
import { phasesApi, tournamentsApi } from "@/utils/api";

export const dynamic = "force-dynamic";

type Params = { id: string; phaseId: string };

export default async function PhaseDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { dict } = await getServerLocale();
  const common = dict.common;
  const trn = dict.tournament;
  const st = dict.standings;
  const nav = dict.navigation;

  const { id: rawTournamentId, phaseId: rawPhaseId } = await params;
  const tournamentId = Number(rawTournamentId);
  const phaseId = Number(rawPhaseId);
  if (!Number.isFinite(tournamentId) || !Number.isFinite(phaseId)) notFound();

  const [tournament, phase] = await Promise.all([
    tournamentsApi.get(tournamentId).catch(() => null),
    phasesApi.get(phaseId).catch(() => null),
  ]);
  if (!tournament || !phase) notFound();
  if (phase.tournament_id !== tournamentId) notFound();

  const isBracket = phase.phase_type === "bracket";
  const standingsHref = `/tournaments/${tournamentId}/phases/${phaseId}/standings`;
  const bracketHref = `/tournaments/${tournamentId}/bracket`;
  const groupsHref = standingsHref;

  const tabs: Array<{ label: string; href: string }> = isBracket
    ? [
        { label: trn.bracket, href: bracketHref },
        { label: st.title, href: standingsHref },
      ]
    : [
        { label: st.title, href: standingsHref },
        { label: trn.poolA, href: groupsHref },
      ];

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
            {isBracket ? trn.playoffs : trn.roundRobin} · #
            {phase.phase_order}
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

        <div className="ps-card">
          <p style={{ color: "var(--ps-text-muted)", margin: 0 }}>
            {st.subtitle}
          </p>
          <p style={{ marginTop: 8 }}>
            {isBracket
              ? trn.playoffsCopy
              : trn.roundRobinCopy.replace("{fixtures}", "—")}
          </p>
        </div>
      </section>
    </AppShell>
  );
}
