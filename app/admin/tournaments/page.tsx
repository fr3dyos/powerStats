import Link from "next/link";
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
  formatDate,
  formatDateRange,
  type Game,
  type Team,
  type Tournament,
} from "@/utils/api";

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
          <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="ps-table">
              <thead>
                <tr>
                  <th>{at.name}</th>
                  <th>{at.dates}</th>
                  <th style={{ textAlign: "right" }}>{at.teams}</th>
                  <th style={{ textAlign: "right" }}>{at.games}</th>
                  <th style={{ textAlign: "right" }}>{at.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ tournament, teams: tlist, games: glist }) => {
                  const completed = glist.filter((g) => g.is_completed).length;
                  return (
                    <tr key={tournament.id}>
                      <td>
                        <Link
                          href={`/tournaments/${tournament.id}`}
                          style={{
                            color: "var(--ps-text)",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          {tournament.name}
                        </Link>
                        {tournament.location ? (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--ps-text-muted)",
                            }}
                          >
                            {tournament.location}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <span style={{ fontSize: 13 }}>
                          {formatDateRange(tournament.start_date, tournament.end_date)}
                        </span>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--ps-text-muted)",
                          }}
                        >
                          {formatDate(tournament.start_date)} → {formatDate(tournament.end_date)}
                        </div>
                      </td>
                      <td className="ps-table__num" style={{ textAlign: "right" }}>
                        {tlist.length}
                      </td>
                      <td className="ps-table__num" style={{ textAlign: "right" }}>
                        {completed}/{glist.length}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/tournaments/${tournament.id}`}
                          style={{
                            fontSize: 12,
                            color: "var(--ps-accent)",
                            marginRight: 12,
                          }}
                        >
                          {dict.common.viewTournament}
                        </Link>
                        <Link
                          href={`/tournaments/${tournament.id}/bracket`}
                          style={{
                            fontSize: 12,
                            color: "var(--ps-accent)",
                          }}
                        >
                          {dict.common.viewBracket}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
