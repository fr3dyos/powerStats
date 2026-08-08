import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import { teamsApi, tournamentsApi, type Team } from "@/utils/api";

import GameNewForm from "./_components/GameNewForm";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "scorekeeper"]);

type Params = { id: string };

export default async function NewGamePage({
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
  const tournamentId = Number(raw);
  if (!Number.isFinite(tournamentId)) notFound();

  const tournament = await tournamentsApi.get(tournamentId).catch(() => null);
  if (!tournament) notFound();

  const teams = await teamsApi
    .listByTournament(tournamentId)
    .catch(() => [] as Team[]);

  const { dict } = await getServerLocale();
  const auth = dict.auth;
  const dashboard = dict.adminDashboard;
  const at = dict.adminTournaments;
  const ag = dict.adminGames;
  const c = dict.common;

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
            <h1>
              {ag.newGame} — {tournament.name}
            </h1>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">
          {teams.length === 0 ? ag.noTeams : ag.selectTeamsHint}
        </p>

        {teams.length < 2 ? (
          <div className="ps-card" style={{ marginTop: 16 }}>
            <h3>{ag.noTeams}</h3>
            <p>{ag.noTeamsHint}</p>
            <Link
              href="/admin/teams/new"
              className="ps-btn ps-btn--ghost"
              style={{ marginTop: 12 }}
            >
              {c.back}
            </Link>
          </div>
        ) : (
          <GameNewForm
            tournamentId={tournament.id}
            teams={teams}
            copy={{
              singleGame: ag.singleGame,
              bulkUpload: ag.bulkUpload,
              homeTeam: ag.homeTeam,
              awayTeam: ag.awayTeam,
              selectTeam: ag.selectTeam,
              startTime: ag.startTime,
              fieldNumber: ag.fieldNumber,
              gameRule: ag.gameRule,
              ruleTimeLimit: ag.ruleTimeLimit,
              ruleScoreLimit: ag.ruleScoreLimit,
              timeLimit: ag.timeLimit,
              scoreLimit: ag.scoreLimit,
              requiredFields: ag.requiredFields,
              sameTeam: ag.sameTeam,
              gameCreated: ag.gameCreated,
              gameCreateFailed: ag.gameCreateFailed,
              csvInstructions: ag.csvInstructions,
              downloadTemplate: ag.downloadTemplate,
              invalidCsv: ag.invalidCsv,
              gamesCreated: ag.gamesCreated,
              gamesCreateFailed: ag.gamesCreateFailed,
              save: ag.save,
              cancel: ag.cancel,
            }}
          />
        )}
      </section>
    </AppShell>
  );
}
