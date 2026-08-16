import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import {
  tournamentsApi,
  phasesApi,
  formatDate,
  type Tournament,
  type Phase,
} from "@/utils/api";
import { TournamentEditForm } from "./_components/TournamentEditForm";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "scorekeeper"]);

type Params = { id: string };

export default async function EditTournamentPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const cookieStore = await cookies();
  const { user, role } = await getAuthedUser(cookieStore);

  if (!user) {
    redirect("/admin/login");
  }
  if (!role || !ALLOWED_ROLES.has(role)) {
    redirect("/?error=unauthorized");
  }

  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isFinite(id)) notFound();

  const tournament = await tournamentsApi.get(id).catch(() => null);
  if (!tournament) notFound();

  // Fetch phases for this tournament (goes through apiFetch so the JWT is
  // forwarded; the previous hard-coded http://localhost:8000 was broken in
  // any non-local environment).
  const phases = await phasesApi.listByTournament(id).catch(() => [] as Phase[]);

  const { dict } = await getServerLocale();
  const auth = dict.auth;
  const dashboard = dict.adminDashboard;
  const at = dict.adminTournaments;
  const ap = dict.adminPanel;

  return (
    <AppShell
      brandSubtitle={auth.adminBrand}
      authLinks={[
        { label: dashboard.title, href: "/admin", variant: "ghost" },
        { label: at.title, href: "/admin/tournaments", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <header className="ps-admin__header">
          <div className="ps-admin__title">
            <h1>
              {ap.edit}: {tournament.name}
            </h1>
            <span className="ps-status-pill" aria-live="polite">
              {role === "admin" ? auth.adminAccessVerified : dashboard.scorekeeperAccess}
            </span>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">
          {tournament.location || at.noLocationSet} · {formatDate(tournament.start_date)} -{" "}
          {formatDate(tournament.end_date)}
        </p>

        <TournamentEditForm
          tournament={tournament}
          phases={phases}
          labels={{
            name: at.name,
            location: at.location,
            description: at.description,
            startDate: at.startDate,
            endDate: at.endDate,
            save: at.save,
            cancel: at.cancel,
            phases: at.phases,
            addPhase: at.addPhase,
            phaseName: at.phaseName,
            phaseType: at.phaseType,
            phaseStatus: at.phaseStatus,
            phaseRoundRobin: at.phaseRoundRobin,
            phaseBracket: at.phaseBracket,
            phasePending: at.phasePending,
            phaseInProgress: at.phaseInProgress,
            phaseCompleted: at.phaseCompleted,
            generateRoundRobin: ap.generateRoundRobin,
            generateBracket: ap.generateBracket,
            viewStandings: at.viewStandings,
            edit: ap.edit,
            delete: ap.delete,
            deleteConfirm: at.phaseDeleteConfirm,
            suggestSchedule: at.suggestSchedule,
            suggestScheduleFailed: at.suggestScheduleFailed,
            suggestScheduleSuccess: at.suggestScheduleSuccess,
            groupCount: at.groupCount,
            advancingTeams: at.advancingTeams,
            tiebreakers: at.tiebreakers,
          }}
          canEdit={role === "admin"}
        />

        <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/admin/tournaments" className="ps-btn ps-btn--ghost">
            ← {at.cancel}
          </Link>
          {role === "admin" ? (
            <>
              <Link href={`/admin/tournaments/${id}/roster`} className="ps-btn ps-btn--ghost">
                {at.importRoster}
              </Link>
              <Link href={`/admin/tournaments/${id}/spirit`} className="ps-btn ps-btn--ghost">
                {at.importSpirit}
              </Link>
            </>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
