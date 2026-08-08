import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import {
  playersApi,
  teamsApi,
  tournamentsApi,
  type Team,
} from "@/utils/api";
import { mapWithConcurrency } from "@/utils/async";

import PlayerEditForm from "./_components/PlayerEditForm";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "scorekeeper"]);

type Params = { id: string };

export default async function EditPlayerPage({
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

  const player = await playersApi.get(id).catch(() => null);
  if (!player) notFound();

  // Gather every team (grouped by tournament in the form) so the player can
  // be reassigned to any team in the system.
  const tournaments = await tournamentsApi.list(50).catch(() => []);
  const teams = (
    await mapWithConcurrency(tournaments, 4, async (t) =>
      teamsApi.listByTournament(t.id).catch(() => [] as Team[]),
    )
  ).flat();

  const { dict } = await getServerLocale();
  const auth = dict.auth;
  const dashboard = dict.adminDashboard;
  const players = dict.adminPlayers;
  const ap = dict.adminPanel;
  const at = dict.adminTournaments;
  const c = dict.common;

  const canDelete = role === "admin";

  return (
    <AppShell
      brandSubtitle={auth.adminBrand}
      authLinks={[
        { label: dashboard.title, href: "/admin", variant: "ghost" },
        { label: players.title, href: "/admin/players", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <header className="ps-admin__header">
          <div className="ps-admin__title">
            <h1>
              {ap.editPlayer} — {player.first_name} {player.last_name}
            </h1>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">
          {player.first_name} {player.last_name}
          {player.jersey_number !== null ? ` · #${player.jersey_number}` : ""}
        </p>

        <PlayerEditForm
          playerId={player.id}
          initial={{
            first_name: player.first_name,
            last_name: player.last_name,
            jersey_number: player.jersey_number,
            team_id: player.team_id,
          }}
          teams={teams}
          tournamentNames={Object.fromEntries(
            tournaments.map((t) => [t.id, t.name]),
          )}
          canDelete={canDelete}
          copy={{
            firstName: at.firstName,
            lastName: at.lastName,
            jersey: at.jersey,
            team: at.team,
            selectTeam: at.selectTeam,
            save: at.save,
            cancel: at.cancel,
            back: c.back,
            delete: ap.delete,
            deleteConfirm: players.deleteConfirm,
            requiredFields: at.requiredFields,
            playerExists: at.playerExists,
            playerSaved: players.playerSaved,
            playerUpdateFailed: players.playerUpdateFailed,
            deleteForbidden: players.deleteForbidden,
            playerDeleteFailed: players.playerDeleteFailed,
            playerDeleted: players.playerDeleted,
          }}
        />

        <div style={{ marginTop: 16 }}>
          <Link href="/admin/players" className="ps-btn ps-btn--ghost">
            ← {c.back}
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
