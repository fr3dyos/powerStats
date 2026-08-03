import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getDictionary, pickLocale } from "@/utils/i18n";
import { getAuthedUser } from "@/utils/supabase/server";

// Force this route to be evaluated per-request; the auth context must
// never be cached.
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const { user, role } = await getAuthedUser(cookieStore);

  // Not signed in: send to the login screen. The middleware layer has
  // already redirected unauthenticated requests before they reach this
  // point, but the page-level guard remains the authoritative check.
  if (!user) {
    redirect("/admin/login");
  }

  // Signed in but not an admin: bounce to the public home with a generic
  // flag. We never reveal which role the account actually has.
  if (role !== "admin") {
    redirect("/?error=unauthorized");
  }

  const dict = getDictionary(pickLocale(undefined));
  const dashboard = dict.adminDashboard;
  const auth = dict.auth;

  return (
    <AppShell
      brandSubtitle={auth.adminBrand}
      authLinks={[
        { label: auth.signOut, href: "/", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <header className="ps-admin__header">
          <div className="ps-admin__title">
            <h1>{dashboard.title}</h1>
            <span className="ps-status-pill" aria-live="polite">
              {auth.adminAccessVerified}
            </span>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">
          {dashboard.welcome}
          {user.email ? ` ${dashboard.signedInAs} ${user.email}.` : null}
        </p>
        <p className="ps-admin__subtitle">{dashboard.subtitle}</p>

        <div className="ps-grid">
          <article className="ps-card">
            <span className="ps-card__icon" aria-hidden="true">
              01
            </span>
            <h3>{dashboard.tournaments}</h3>
            <p>Create, edit, and manage your Ultimate Frisbee tournaments.</p>
            <span className="ps-card__footer">{dashboard.comingSoon}</span>
          </article>
          <article className="ps-card">
            <span className="ps-card__icon" aria-hidden="true">
              02
            </span>
            <h3>{dashboard.teams}</h3>
            <p>Register teams, upload logos, and assign pools.</p>
            <span className="ps-card__footer">{dashboard.comingSoon}</span>
          </article>
          <article className="ps-card">
            <span className="ps-card__icon" aria-hidden="true">
              03
            </span>
            <h3>{dashboard.players}</h3>
            <p>Roster management with cross-tournament history.</p>
            <span className="ps-card__footer">{dashboard.comingSoon}</span>
          </article>
          <article className="ps-card">
            <span className="ps-card__icon" aria-hidden="true">
              04
            </span>
            <h3>{dashboard.liveScoring}</h3>
            <p>
              Run the live scoring console for goals, assists, and turns.
            </p>
            <span className="ps-card__footer">{dashboard.comingSoon}</span>
          </article>
          <article className="ps-card">
            <span className="ps-card__icon" aria-hidden="true">
              05
            </span>
            <h3>{dashboard.schedules}</h3>
            <p>Bracket, round-robin, and Swiss schedule generation.</p>
            <span className="ps-card__footer">{dashboard.comingSoon}</span>
          </article>
        </div>
      </section>
    </AppShell>
  );
}