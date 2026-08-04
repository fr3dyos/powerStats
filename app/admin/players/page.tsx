import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getDictionary, pickLocale } from "@/utils/i18n";
import {
  formatPlayerName,
  playersApi,
  teamsApi,
  tournamentsApi,
  teamColor,
  type Player,
  type Team,
} from "@/utils/api";

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

  const dict = getDictionary(pickLocale(undefined));
  const auth = dict.auth;
  const dashboard = dict.adminDashboard;

  // Gather every tournament, its teams, and every player on those teams to
  // build the full player directory.
  const tournaments = await tournamentsApi.list(50).catch(() => []);
  const perTournament = await Promise.all(
    tournaments.map(async (t) => {
      const teams = await teamsApi.listByTournament(t.id).catch(() => [] as Team[]);
      const playersByTeam = await Promise.all(
        teams.map(async (team) => ({
          team,
          players: await playersApi.listByTeam(team.id).catch(() => [] as Player[]),
        })),
      );
      return { tournament: t, teams, playersByTeam };
    }),
  );

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
        { label: "Dashboard", href: "/admin", variant: "ghost" },
        { label: "Teams", href: "/admin/teams", variant: "ghost" },
        { label: "Tournaments", href: "/tournaments", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <header className="ps-admin__header">
          <div className="ps-admin__title">
            <h1>Players</h1>
            <span className="ps-status-pill" aria-live="polite">
              {totalPlayers} players across {tournaments.length} tournaments
            </span>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">
          {dashboard.playersCopy} Full player directory with cross-tournament
          history.
        </p>

        {allPlayers.length === 0 ? (
          <div className="ps-card">
            <h3>No players yet</h3>
            <p>Register teams and players to see them here.</p>
          </div>
        ) : (
          <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="ps-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Player</th>
                  <th>Team</th>
                  <th style={{ textAlign: "right" }}>Jersey</th>
                </tr>
              </thead>
              <tbody>
                {allPlayers
                  .slice()
                  .sort((a, b) =>
                    formatPlayerName(a).localeCompare(formatPlayerName(b)),
                  )
                  .map((p, i) => {
                    const accent = teamColor(p.team?.name);
                    return (
                      <tr key={p.id}>
                        <td className="ps-table__rank">{i + 1}</td>
                        <td>
                          <Link
                            href={`/players/${p.id}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 10,
                              color: "var(--ps-text)",
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
                              {p.team?.name.slice(0, 2).toUpperCase() ?? "—"}
                            </span>
                            {formatPlayerName(p)}
                          </Link>
                        </td>
                        <td>
                          {p.team ? (
                            <Link
                              href={`/teams/${p.team.id}`}
                              style={{ color: "var(--ps-text)" }}
                            >
                              {p.team.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="ps-table__num" style={{ textAlign: "right" }}>
                          {p.jersey_number ?? "—"}
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
