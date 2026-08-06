import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";

// The form itself isn't wired up yet; the page exists so the admin
// teams hub's "Add team" button has a real destination.
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "scorekeeper"]);

export default async function NewTeamPage() {
  const cookieStore = await cookies();
  const { user, role } = await getAuthedUser(cookieStore);

  if (!user) {
    redirect("/admin/login");
  }
  if (!role || !ALLOWED_ROLES.has(role)) {
    redirect("/?error=unauthorized");
  }

  const { dict } = await getServerLocale();
  const auth = dict.auth;
  const dashboard = dict.adminDashboard;
  const teams = dict.adminTeams;

  return (
    <AppShell
      brandSubtitle={auth.adminBrand}
      authLinks={[
        { label: dashboard.title, href: "/admin", variant: "ghost" },
        { label: teams.title, href: "/admin/teams", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <header className="ps-admin__header">
          <div className="ps-admin__title">
            <h1>{teams.addTeam}</h1>
            <span className="ps-status-pill" aria-live="polite">
              {dashboard.comingSoon}
            </span>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">
          {teams.emptyCopy}
        </p>

        <div className="ps-card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, marginTop: 0 }}>
            {teams.addTeam}
          </h2>
          <p style={{ color: "var(--ps-text-muted)", marginBottom: 16 }}>
            {dashboard.comingSoon}. This form will collect the team name,
            tournament assignment, and optional logo.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/admin/teams"
              className="ps-btn ps-btn--ghost"
            >
              {dict.common.back}
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
