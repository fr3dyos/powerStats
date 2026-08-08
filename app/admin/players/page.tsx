import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import {
  playersApi,
  teamsApi,
  tournamentsApi,
  type Player,
  type Team,
} from "@/utils/api";
import { mapWithConcurrency } from "@/utils/async";

import AddPlayerForm from "./AddPlayerForm";
import AdminPlayersTable from "./AdminPlayersTable";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "scorekeeper"]);

export default async function AdminPlayersPage() {
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
  const ap = dict.adminPlayers;
  const at = dict.adminTournaments;
  const ap_panel = dict.adminPanel;
  const nav = dict.navigation;

  // Gather every tournament, its teams, and every player on those teams to
  // build the full player directory.  Use concurrency limits so we never
  // overwhelm the FastAPI connection pool.
  const tournaments = await tournamentsApi.list(50).catch(() => []);
  const perTournament = await mapWithConcurrency(tournaments, 4, async (t) => {
    const teams = await teamsApi.listByTournament(t.id).catch(() => [] as Team[]);
    const playersByTeam = await mapWithConcurrency(teams, 4, async (team) => ({
      team,
      players: await playersApi.listByTeam(team.id).catch(() => [] as Player[]),
    }));
    return { tournament: t, teams, playersByTeam };
  });

  const allPlayers: Array<Player & { team: Team | undefined }> = [];
  for (const { teams, playersByTeam } of perTournament) {
    const teamById = new Map(teams.map((t) => [t.id, t]));
    for (const { team, players } of playersByTeam) {
      for (const p of players) allPlayers.push({ ...p, team: teamById.get(team.id) });
    }
  }
  const totalPlayers = allPlayers.length;

  return (
    <AppShell
      brandSubtitle={auth.adminBrand}
authLinks={[
        { label: dashboard.title, href: "/admin", variant: "ghost" },
        { label: nav.teams, href: "/admin/teams", variant: "ghost" },
        { label: nav.tournaments, href: "/tournaments", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <header className="ps-admin__header">
          <div className="ps-admin__title">
            <h1>{ap.title}</h1>
            <span className="ps-status-pill" aria-live="polite">
              {ap.summary
                .replace("{total}", String(totalPlayers))
                .replace("{count}", String(tournaments.length))}
            </span>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">
          {dashboard.playersCopy} {ap.title.toLowerCase()} directory.
        </p>

        <AddPlayerForm
          teams={perTournament.flatMap(({ teams }) => teams)}
          tournamentNames={Object.fromEntries(
            perTournament.map(({ tournament: t }) => [t.id, t.name]),
          )}
          copy={{
            addPlayer: at.addPlayer,
            firstName: at.firstName,
            lastName: at.lastName,
            jersey: at.jersey,
            team: at.team,
            selectTeam: at.selectTeam,
            save: at.save,
            cancel: at.cancel,
            requiredFields: at.requiredFields,
            playerExists: at.playerExists,
            playerAdded: at.playerAdded,
            playerAddFailed: at.playerAddFailed,
          }}
        />

        {allPlayers.length === 0 ? (
          <div className="ps-card">
            <h3>{ap.emptyTitle}</h3>
            <p>{ap.emptyCopy}</p>
          </div>
        ) : (
          <AdminPlayersTable
            rows={allPlayers}
            labels={{
              player: ap.player,
              team: ap.team,
              jersey: ap.jersey,
              actions: at.actions,
              searchPlayers: ap.searchPlayers,
              edit: ap_panel.edit,
              delete: ap_panel.delete,
              deleteComingSoon: ap.deleteComingSoon,
              noPlayerMatches: ap.noPlayerMatches,
            }}
          />
        )}
      </section>
    </AppShell>
  );
}
