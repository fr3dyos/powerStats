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
import { mapWithConcurrency } from "@/utils/async";

import GamesAdminTable from "./GamesAdminTable";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "scorekeeper"]);

type Row = {
  tournament: Tournament;
  teams: Team[];
  games: Game[];
};

export default async function AdminGamesPage() {
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
  const ag = dict.adminGames;
  const nav = dict.navigation;

  const tournaments = await tournamentsApi.list(50).catch(() => []);
  const rows: Row[] = await mapWithConcurrency(tournaments, 4, async (tournament) => {
    const [teams, games] = await Promise.all([
      teamsApi.listByTournament(tournament.id).catch(() => [] as Team[]),
      gamesApi.listByTournament(tournament.id).catch(() => [] as Game[]),
    ]);
    return { tournament, teams, games };
  });

  const totalGames = rows.reduce((acc, r) => acc + r.games.length, 0);
  const totalCompletedGames = rows.reduce(
    (acc, r) => acc + r.games.filter((g) => g.is_completed).length,
    0,
  );

  // Flat dict of strings the client table needs — keeps the client bundle
  // free of the i18n runtime (same pattern as AdminTournamentsTable).
  const tableLabels = {
    tournament: dict.common.tournament,
    teams: dict.common.teams,
    score: dict.common.score,
    date: dict.common.date,
    field: dict.common.field,
    status: dict.adminTournaments.status,
    scheduled: dict.common.scheduled,
    completed: dict.common.completed,
    live: dict.common.liveNow,
    noGames: dict.common.noGames,
    all: dict.common.all,
    newGame: ag.newGame,
    noTeams: ag.noTeams,
    noTeamsHint: ag.noTeamsHint,
    pickTournamentFirst: ag.pickTournamentFirst,
    searchPlaceholder: ag.searchPlaceholder,
  };

  return (
    <AppShell
      brandSubtitle={auth.adminBrand}
      authLinks={[
        { label: dashboard.title, href: "/admin", variant: "ghost" },
        { label: nav.tournaments, href: "/admin/tournaments", variant: "ghost" },
        { label: nav.teams, href: "/admin/teams", variant: "ghost" },
        { label: nav.players, href: "/admin/players", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <header className="ps-admin__header">
          <div className="ps-admin__title">
            <h1>{ag.title}</h1>
            <span className="ps-status-pill" aria-live="polite">
              {totalCompletedGames}/{totalGames}
            </span>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">
          {totalGames} {dict.common.games} · {totalCompletedGames}{" "}
          {dict.common.completed.toLowerCase()}
        </p>

        {rows.length === 0 ? (
          <div className="ps-card">
            <h3>{dict.common.noTournaments}</h3>
            <p>{dict.common.noGames}</p>
          </div>
        ) : (
          <GamesAdminTable rows={rows} labels={tableLabels} />
        )}
      </section>
    </AppShell>
  );
}
