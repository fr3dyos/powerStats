import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import {
  tournamentsApi,
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

  // Fetch phases for this tournament
  const phases = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/tournaments/${id}/phases`,
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    }
  )
    .then((res) => res.json())
    .catch(() => [] as Phase[]);

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
          {tournament.location || "No location set"} · {formatDate(tournament.start_date)} -{" "}
          {formatDate(tournament.end_date)}
        </p>

        <TournamentEditForm
          tournament={tournament}
          phases={phases}
          labels={{
            name: at.name,
            location: "Location",
            description: "Description",
            startDate: "Start Date",
            endDate: "End Date",
            save: at.save,
            cancel: at.cancel,
            phases: at.phases,
            addPhase: "Add Phase",
            phaseName: "Phase Name",
            phaseType: "Type",
            phaseStatus: "Status",
            phaseRoundRobin: at.phaseRoundRobin,
            phaseBracket: at.phaseBracket,
            phasePending: at.phasePending,
            phaseInProgress: at.phaseInProgress,
            phaseCompleted: at.phaseCompleted,
            generateRoundRobin: ap.generateRoundRobin,
            generateBracket: ap.generateBracket,
            viewStandings: "View Standings",
          }}
          canEdit={role === "admin"}
        />

        <div style={{ marginTop: 24 }}>
          <Link href="/admin/tournaments" className="ps-btn ps-btn--ghost">
            ← {at.cancel}
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
