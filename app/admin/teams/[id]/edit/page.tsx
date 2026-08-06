import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import { teamsApi } from "@/utils/api";

// The edit form itself isn't wired up yet; the page exists so the per-row
// Edit button on /admin/teams has a real destination.
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "scorekeeper"]);

type Params = { id: string };

export default async function EditTeamPage({
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

  const team = await teamsApi.get(id).catch(() => null);
  if (!team) notFound();

  const { dict } = await getServerLocale();
  const auth = dict.auth;
  const dashboard = dict.adminDashboard;
  const teams = dict.adminTeams;
  const ap = dict.adminPanel;

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
            <h1>{ap.editTeam} — {team.name}</h1>
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
            {ap.editTeam}: {team.name}
          </h2>
          <p style={{ color: "var(--ps-text-muted)", marginBottom: 16 }}>
            {dashboard.comingSoon}. This form will let you update the
            team name, logo, and roster.
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
