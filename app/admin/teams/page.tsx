import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getDictionary, pickLocale } from "@/utils/i18n";
import {
  teamsApi,
  tournamentsApi,
  teamColor,
  type Team,
} from "@/utils/api";

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

  const dict = getDictionary(pickLocale(undefined));
  const auth = dict.auth;
  const dashboard = dict.adminDashboard;

  // Gather every tournament and its teams so the admin can browse the full
  // team directory across events.
  const tournaments = await tournamentsApi.list(50).catch(() => []);
  const perTournament = await Promise.all(
    tournaments.map(async (t) => ({
      tournament: t,
      teams: await teamsApi.listByTournament(t.id).catch(() => [] as Team[]),
    })),
  );
  const totalTeams = perTournament.reduce(
    (acc, p) => acc + p.teams.length,
    0,
  );

  return (
    <AppShell
      brandSubtitle={auth.adminBrand}
      authLinks={[
        { label: "Dashboard", href: "/admin", variant: "ghost" },
        { label: "Players", href: "/admin/players", variant: "ghost" },
        { label: "Tournaments", href: "/tournaments", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <header className="ps-admin__header">
          <div className="ps-admin__title">
            <h1>Teams</h1>
            <span className="ps-status-pill" aria-live="polite">
              {totalTeams} teams across {tournaments.length} tournaments
            </span>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">
          {dashboard.teamsCopy} Full team directory across every tournament.
        </p>

        {perTournament.length === 0 ? (
          <div className="ps-card">
            <h3>No tournaments yet</h3>
            <p>Create a tournament first to start registering teams.</p>
          </div>
        ) : (
          <div
            className="ps-card-list"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            {perTournament.map(({ tournament, teams: tlist }) => (
              <div key={tournament.id} className="ps-card">
                <header
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <h3 style={{ fontSize: 16 }}>{tournament.name}</h3>
                  <span className="ps-pill">{tlist.length} teams</span>
                </header>
                {tlist.length === 0 ? (
                  <p style={{ color: "var(--ps-text-muted)", fontSize: 13 }}>
                    No teams registered yet.
                  </p>
                ) : (
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {tlist.map((t) => {
                      const accent = teamColor(t.name);
                      return (
                        <li key={t.id}>
                          <Link
                            href={`/teams/${t.id}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              color: "var(--ps-text)",
                              textDecoration: "none",
                              fontWeight: 600,
                            }}
                          >
                            <span
                              className="ps-disc ps-disc--sm"
                              style={{
                                background: accent ?? undefined,
                                color: "#fff",
                                borderColor: accent ?? undefined,
                              }}
                            >
                              {t.name.slice(0, 2).toUpperCase()}
                            </span>
                            {t.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
