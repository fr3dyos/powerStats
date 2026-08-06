import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";

// The form itself isn't wired up yet; the page exists so the admin
// toolbar's "New tournament" button has a real destination.
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "scorekeeper"]);

export default async function NewTournamentPage() {
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
            <h1>{ap.createTournament}</h1>
            <span className="ps-status-pill" aria-live="polite">
              {dashboard.comingSoon}
            </span>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">
          {at.emptyCopy}
        </p>

        <div className="ps-card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, marginTop: 0 }}>
            {ap.createTournament}
          </h2>
          <p style={{ color: "var(--ps-text-muted)", marginBottom: 16 }}>
            {dashboard.comingSoon}. This form will collect the tournament
            name, date range, format, and field count.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/admin/tournaments"
              className="ps-btn ps-btn--ghost"
            >
              {at.cancel}
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
