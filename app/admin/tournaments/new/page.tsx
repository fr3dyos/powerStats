import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";

import { NewTournamentForm } from "./_components/NewTournamentForm";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "scorekeeper"]);

export default async function NewTournamentPage() {
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
            <h1>{ap.createTournament}</h1>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <NewTournamentForm
          labels={{
            name: at.name,
            location: at.location,
            description: at.description,
            startDate: at.startDate,
            endDate: at.endDate,
            create: at.create,
            cancel: at.cancel,
            saving: at.saving,
          }}
        />

        <div style={{ marginTop: 16 }}>
          <Link href="/admin/tournaments" className="ps-btn ps-btn--ghost">
            ← {at.cancel}
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
