import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import { usersApi } from "@/utils/api";

import AdminUsersTable from "./AdminUsersTable";

export const dynamic = "force-dynamic";

// Only admins can change other users' roles. Scorekeepers are deliberately
// excluded because they don't have a role-management surface on the
// FastAPI side (see routers/auth.py).
const ALLOWED_ROLES = new Set(["admin"]);

export default async function AdminUsersPage() {
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
  const nav = dict.navigation;
  const dashboard = dict.adminDashboard;
  const au = dict.adminUsers;

  const users = await usersApi.list().catch(() => []);

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
            <h1>{au.title}</h1>
            <span className="ps-status-pill" aria-live="polite">
              {au.summary.replace("{total}", String(users.length))}
            </span>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">{au.subtitle}</p>

        {users.length === 0 ? (
          <div className="ps-card">
            <h3>{au.emptyTitle}</h3>
            <p>{au.emptyCopy}</p>
          </div>
        ) : (
          <AdminUsersTable
            users={users}
            currentUserId={user.id}
            labels={{
              email: au.email,
              role: au.role,
              createdAt: au.createdAt,
              lastSignIn: au.lastSignIn,
              actions: au.actions,
              save: au.save,
              saved: au.saved,
              saveFailed: au.saveFailed,
              selectRole: au.selectRole,
              roleAdmin: au.roleAdmin,
              roleScorekeeper: au.roleScorekeeper,
              rolePublic: au.rolePublic,
            }}
          />
        )}
      </section>
    </AppShell>
  );
}
