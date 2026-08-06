import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import {
  gamesApi,
  teamsApi,
  tournamentsApi,
  type Game,
  type Team,
  type Tournament,
} from "@/utils/api";

import AdminTournamentsTable from "./AdminTournamentsTable";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "scorekeeper"]);

type Row = {
  tournament: Tournament;
  teams: Team[];
  games: Game[];
};

export default async function AdminTournamentsPage() {
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
  const nav = dict.navigation;

  const tournaments = await tournamentsApi.list(50).catch(() => []);
  const rows: Row[] = await Promise.all(
    tournaments.map(async (tournament) => {
      const teams = await teamsApi.listByTournament(tournament.id).catch(() => [] as Team[]);
      const games = await gamesApi.listByTournament(tournament.id).catch(() => [] as Game[]);
      return { tournament, teams, games };
    }),
  );

  const totalTeams = rows.reduce((acc, r) => acc + r.teams.length, 0);
  const totalGames = rows.reduce((acc, r) => acc + r.games.length, 0);
  const totalCompletedGames = rows.reduce(
    (acc, r) => acc + r.games.filter((g) => g.is_completed).length,
    0,
  );

  // Flat dict of strings the client table needs. Passing literal strings (not
  // the whole dict) keeps the client component free of the i18n runtime and
  // means the client bundle only ships what's actually rendered.
  const tableLabels = {
    name: at.name,
    dates: at.dates,
    teams: at.teams,
    games: at.games,
    actions: at.actions,
    status: at.status,
    phaseRoundRobin: at.phaseRoundRobin,
    phaseBracket: at.phaseBracket,
    phasePending: at.phasePending,
    phaseInProgress: at.phaseInProgress,
    phaseCompleted: at.phaseCompleted,
    notStarted: at.notStarted,
    inProgress: at.inProgress,
    completed: at.completed,
    viewTournament: dict.common.viewTournament,
    viewBracket: dict.common.viewBracket,
    newTournament: at.newTournament,
    editSelected: at.editSelected,
    deleteSelected: at.deleteSelected,
    selectAll: at.selectAll,
    selectRow: at.selectRow,
    noneSelected: at.noneSelected,
    oneSelected: at.oneSelected,
    manySelected: at.manySelected,
    deleteConfirm: at.deleteConfirm,
  };

  return (
    <AppShell
      brandSubtitle={auth.adminBrand}
      authLinks={[
        { label: dashboard.title, href: "/admin", variant: "ghost" },
        { label: nav.teams, href: "/admin/teams", variant: "ghost" },
        { label: nav.players, href: "/admin/players", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <header className="ps-admin__header">
          <div className="ps-admin__title">
            <h1>{at.title}</h1>
            <span className="ps-status-pill" aria-live="polite">
              {at.summary.replace("{total}", String(rows.length))}
            </span>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">
          {dashboard.tournamentsCopy} {totalTeams} {nav.teams.toLowerCase()},{" "}
          {totalCompletedGames}/{totalGames} {dict.common.games}.
        </p>

        {rows.length === 0 ? (
          <div className="ps-card">
            <h3>{at.emptyTitle}</h3>
            <p>{at.emptyCopy}</p>
          </div>
        ) : (
          <AdminTournamentsTable rows={rows} labels={tableLabels} />
        )}
      </section>
    </AppShell>
  );
}
