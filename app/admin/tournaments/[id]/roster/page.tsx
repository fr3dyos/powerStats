import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import { tournamentsApi } from "@/utils/api";
import RosterImportPanel from "./_components/RosterImportPanel";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin"]);

type Params = { id: string };

export default async function RosterImportPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const cookieStore = await cookies();
  const { user, role } = await getAuthedUser(cookieStore);

  if (!user) redirect("/admin/login");
  if (!role || !ALLOWED_ROLES.has(role)) redirect("/?error=unauthorized");

  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isFinite(id)) notFound();

  const tournament = await tournamentsApi.get(id).catch(() => null);
  if (!tournament) notFound();

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
            <h1>
              {at.importRoster}: {tournament.name}
            </h1>
            <span className="ps-status-pill">{auth.adminAccessVerified}</span>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>
        <p className="ps-admin__subtitle">
          <Link href={`/admin/tournaments/${id}/edit`}>← {ap.edit}</Link>
        </p>
        <RosterImportPanel
          endpoint={`/api/admin/tournaments/${id}/roster/import`}
          submitLabel={at.importRosterSubmit}
          templateLabel={at.importRosterTemplate}
          pasteLabel={at.importRosterPaste}
          fileLabel={at.importRosterFile}
          successLabel={at.importRosterSuccess}
          failureLabel={at.importRosterFailure}
          helpLabel={at.importRosterHelp}
        />
      </section>
    </AppShell>
  );
}
