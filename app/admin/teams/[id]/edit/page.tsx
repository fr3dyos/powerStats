import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import { teamsApi, tournamentsApi } from "@/utils/api";

import TeamEditForm from "./_components/TeamEditForm";

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

  const tournaments = await tournamentsApi.list(50).catch(() => []);

  const { dict } = await getServerLocale();
  const auth = dict.auth;
  const dashboard = dict.adminDashboard;
  const at = dict.adminTeams;
  const ap = dict.adminPanel;
  const c = dict.common;

  const canDelete = role === "admin";

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
            <h1>
              {ap.editTeam} — {team.name}
            </h1>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">
          {team.name}
        </p>

        <TeamEditForm
          teamId={team.id}
          initial={{
            name: team.name,
            tournament_id: team.tournament_id,
            logo_url: team.logo_url,
          }}
          tournaments={tournaments}
          canDelete={canDelete}
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
            back: c.back,
            delete: ap.delete,
            deleteConfirm: at.deleteConfirm,
            requiredFields: at.requiredFields,
            teamExists: at.teamExists,
            teamSaved: at.teamSaved,
            teamUpdateFailed: at.teamUpdateFailed,
            deleteForbidden: at.deleteForbidden,
            teamDeleteFailed: at.teamDeleteFailed,
            teamDeleted: at.teamDeleted,
          }}
        />

        <div style={{ marginTop: 16 }}>
          <Link href="/admin/teams" className="ps-btn ps-btn--ghost">
            ← {c.back}
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
