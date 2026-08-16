import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import { teamsApi, tournamentsApi } from "@/utils/api";
import { mapWithConcurrency } from "@/utils/async";

import NewTeamForm from "./_components/NewTeamForm";

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

  const tournaments = await tournamentsApi.list(50).catch(() => []);

  // Count existing teams so the header subtitle can show the real total.
  const teamCounts = await mapWithConcurrency(tournaments, 4, async (t) => {
    const teams = await teamsApi.listByTournament(t.id).catch(() => []);
    return teams.length;
  });
  const totalTeams = teamCounts.reduce((sum, n) => sum + n, 0);

  const { dict } = await getServerLocale();
  const auth = dict.auth;
  const dashboard = dict.adminDashboard;
  const at = dict.adminTeams;
  const c = dict.common;

  return (
    <AppShell
      brandSubtitle={auth.adminBrand}
      authLinks={[
        { label: dashboard.title, href: "/admin", variant: "ghost" },
        { label: at.title, href: "/admin/teams", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <header className="ps-admin__header">
          <div className="ps-admin__title">
            <h1>{at.addTeam}</h1>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">
          {tournaments.length === 0
            ? at.emptyCopy
            : at.summary
                .replace("{total}", String(totalTeams))
                .replace("{count}", String(tournaments.length))}
        </p>

        {tournaments.length === 0 ? (
          <div className="ps-card" style={{ marginTop: 16 }}>
            <h3>{at.emptyTitle}</h3>
            <p>{at.emptyCopy}</p>
            <Link
              href="/tournaments"
              className="ps-btn ps-btn--ghost"
              style={{ marginTop: 12 }}
            >
              {c.back}
            </Link>
          </div>
        ) : (
          <NewTeamForm
            tournaments={tournaments}
            copy={{
              teamName: at.teamName,
              tournament: c.tournament,
              selectTournament: at.selectTournament,
              logoUrl: at.logoUrl,
              logoUrlHint: "https://…",
              logoFile: at.logoFile,
              logoFileHint: at.logoFileHint,
              save: at.save,
              cancel: at.cancel,
              requiredFields: at.requiredFields,
              teamCreated: at.teamCreated,
              teamAddFailed: at.teamAddFailed,
            }}
          />
        )}
      </section>
    </AppShell>
  );
}
