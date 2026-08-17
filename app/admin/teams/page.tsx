import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import {
  teamsApi,
  tournamentsApi,
  teamColor,
  type Team,
} from "@/utils/api";
import { mapWithConcurrency } from "@/utils/async";

import { AdminTeamsFilterableList } from "./_components/AdminTeamsFilterableList";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "scorekeeper"]);

export default async function AdminTeamsPage() {
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
  const at = dict.adminTeams;
  const ap = dict.adminPanel;
  const nav = dict.navigation;

  // Gather every tournament and its teams so the admin can browse the full
  // team directory across events.
  const tournaments = await tournamentsApi.list(50).catch(() => []);
  const perTournament = await mapWithConcurrency(tournaments, 4, async (t) => ({
    tournament: t,
    teams: await teamsApi.listByTournament(t.id).catch(() => [] as Team[]),
  }));
  const totalTeams = perTournament.reduce(
    (acc, p) => acc + p.teams.length,
    0,
  );

  return (
    <AppShell
      brandSubtitle={auth.adminBrand}
authLinks={[
        { label: dashboard.title, href: "/admin", variant: "ghost" },
        { label: nav.players, href: "/admin/players", variant: "ghost" },
        { label: nav.tournaments, href: "/tournaments", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <header className="ps-admin__header">
          <div className="ps-admin__title">
            <h1>{at.title}</h1>
            <span className="ps-status-pill" aria-live="polite">
              {at.summary
                .replace("{total}", String(totalTeams))
                .replace("{count}", String(tournaments.length))}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link
              href="/admin/teams/new"
              className="ps-btn ps-btn--primary"
            >
              {at.addTeam}
            </Link>
            <SignOutButton label={auth.signOut} />
          </div>
        </header>

        <p className="ps-admin__subtitle">
          {dashboard.teamsCopy} {at.title.toLowerCase()} directory.
        </p>

        {perTournament.length === 0 ? (
          <div className="ps-card">
            <h3>{at.emptyTitle}</h3>
            <p>{at.emptyCopy}</p>
          </div>
        ) : (
          <AdminTeamsFilterableList
            groups={perTournament.map((p) => ({
              tournament: { id: p.tournament.id, name: p.tournament.name },
              teams: p.teams,
            }))}
            labels={{
              searchPlaceholder: at.searchPlaceholder,
              teamCount: at.teamCount,
              noTeams: at.noTeams,
              editTeam: ap.editTeam,
            }}
          />
        )}
      </section>
    </AppShell>
  );
}
