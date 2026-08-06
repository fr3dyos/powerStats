import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getServerLocale } from "@/utils/i18n-server";
import { getAuthedUser } from "@/utils/supabase/server";
import {
  formatDate,
  gamesApi,
  tournamentsApi,
  type Game,
} from "@/utils/api";

// Force this route to be evaluated per-request; the auth context must
// never be cached.
export const dynamic = "force-dynamic";

// Roles allowed on the admin dashboard. Scorekeepers get read-only access
// plus the live scoring console; admins get everything. The FastAPI
// backend uses the same allowlist via `require_scorekeeper`.
const ALLOWED_ROLES = new Set(["admin", "scorekeeper"]);

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const { user, role } = await getAuthedUser(cookieStore);

  // Not signed in: send to the login screen. The middleware layer has
  // already redirected unauthenticated requests before they reach this
  // point, but the page-level guard remains the authoritative check.
  if (!user) {
    redirect("/admin/login");
  }

  // Signed in but not allowed on the admin area (e.g. a Supabase user
  // whose `role` claim isn't `admin` or `scorekeeper`): bounce to the
  // public home with a generic flag. We never reveal which role the
  // account actually has.
  if (!role || !ALLOWED_ROLES.has(role)) {
    redirect("/?error=unauthorized");
  }

const { dict } = await getServerLocale();
  const dashboard = dict.adminDashboard;
  const auth = dict.auth;

  // Fetch a small set of recent / live games so the live-scoring tile can
  // deep-link to a real game console instead of leaving the admin to
  // drill down through the public browse.
  const liveConsoleHref = await (async (): Promise<string> => {
    try {
      const tournaments = await tournamentsApi.list(20);
      // Prefer an in-progress game (not yet completed), fall back to the
      // most recently started completed game.
      for (const t of tournaments) {
        const games = await gamesApi.listByTournament(t.id).catch(() => []);
        const live = games.find((g) => !g.is_completed);
        if (live) return `/admin/games/${live.id}/score`;
        const sorted = [...games].sort((a, b) => {
          const at = a.start_time ? Date.parse(a.start_time) : 0;
          const bt = b.start_time ? Date.parse(b.start_time) : 0;
          return bt - at;
        });
        if (sorted[0]) {
          return `/admin/games/${sorted[0].id}/score`;
        }
      }
    } catch {
      /* fall through */
    }
    return "/tournaments";
  })();

  // Widget data: sample recent tournaments, map team ids to names, then
  // slice the two small lists shown below the tiles.
  const teamName = new Map<number, string>();
  const unscored: Game[] = [];
  const completed: Game[] = [];
  try {
    const tournaments = await tournamentsApi.list(20);
    for (const t of tournaments) {
      const [tour, games] = await Promise.all([
        tournamentsApi.get(t.id).catch(() => null),
        gamesApi.listByTournament(t.id).catch(() => []),
      ]);
      for (const team of tour?.teams ?? []) {
        if (!teamName.has(team.id)) teamName.set(team.id, team.name);
      }
      for (const g of games) {
        (g.is_completed ? completed : unscored).push(g);
      }
    }
  } catch {
    /* fall through to empty widgets */
  }

  const sortTime = (g: Game, key: "start_time" | "end_time") => {
    const v = g[key] ? Date.parse(g[key]) : 0;
    return Number.isFinite(v) ? v : 0;
  };

  const topUnscored = [...unscored]
    .sort((a, b) => sortTime(b, "start_time") - sortTime(a, "start_time"))
    .slice(0, 10);
  const topCompleted = [...completed]
    .sort((a, b) => sortTime(b, "end_time") - sortTime(a, "end_time"))
    .slice(0, 10);

  const teamNameFor = (id: number) => teamName.get(id) ?? "—";

  // Each tile links to the surface it actually owns. Scorekeepers get
  // read-only views plus the live-scoring console; admins get the same
  // hub, with role-aware copy.
  const tiles = [
    {
      href: "/tournaments",
      icon: "01",
      title: dashboard.tournaments,
      copy: dashboard.tournamentsCopy,
      footer: dashboard.tournamentsFooter,
    },
    {
      href: "/admin/teams",
      icon: "02",
      title: dashboard.teams,
      copy: dashboard.teamsCopy,
      footer: dashboard.teamsFooter,
    },
    {
      href: "/admin/players",
      icon: "03",
      title: dashboard.players,
      copy: dashboard.playersCopy,
      footer: dashboard.playersFooter,
    },
    {
      href: liveConsoleHref,
      icon: "04",
      title: dashboard.liveScoring,
      copy: dashboard.liveScoringCopy,
      footer: dashboard.liveScoringFooter,
    },
    {
      href: "/tournaments",
      icon: "05",
      title: dashboard.schedules,
      copy: dashboard.schedulesCopy,
      footer: dashboard.schedulesFooter,
    },
  ];

  return (
    <AppShell
      brandSubtitle={auth.adminBrand}
      authLinks={[
        { label: "Tournaments", href: "/tournaments", variant: "ghost" },
        { label: "Teams", href: "/admin/teams", variant: "ghost" },
        { label: "Players", href: "/admin/players", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <header className="ps-admin__header">
          <div className="ps-admin__title">
            <h1>{dashboard.title}</h1>
            <span className="ps-status-pill" aria-live="polite">
              {role === "admin"
                ? auth.adminAccessVerified
                : dashboard.scorekeeperAccess}
            </span>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">
          {dashboard.welcome}
          {user.email ? ` ${dashboard.signedInAs} ${user.email}.` : null}
        </p>
        <p className="ps-admin__subtitle">
          {role === "admin" ? dashboard.subtitle : dashboard.scorekeeperSubtitle}
        </p>

        <div className="ps-grid">
          {tiles.map((tile) => (
            <Link
              key={tile.title}
              href={tile.href}
              className="ps-card"
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <span className="ps-card__icon" aria-hidden="true">
                {tile.icon}
              </span>
              <h3>{tile.title}</h3>
              <p>{tile.copy}</p>
              <span className="ps-card__footer">{tile.footer}</span>
            </Link>
          ))}
        </div>

        <div
          style={{
            marginTop: 32,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div>
            <div className="ps-section__eyebrow">{dashboard.unscoredGames}</div>
            <div className="ps-card" style={{ marginTop: 8, minHeight: 0 }}>
              {topUnscored.length === 0 ? (
                <p style={{ color: "var(--ps-text-muted)", fontSize: 13, margin: 0 }}>
                  {dashboard.unscoredGamesEmpty}
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {topUnscored.map((g) => {
                    const home = teamNameFor(g.home_team_id);
                    const away = teamNameFor(g.away_team_id);
                    return (
                      <li key={g.id}>
                        <Link
                          href={`/admin/games/${g.id}/score`}
                          className="ps-pill"
                          style={{
                            textDecoration: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: "var(--ps-radius)",
                            background: "var(--ps-surface-container-low)",
                          }}
                        >
                          <span style={{ color: "var(--ps-text)" }}>
                            {home} vs {away}
                          </span>
                          <span
                            style={{
                              color: "var(--ps-primary-container)",
                              fontWeight: 800,
                            }}
                          >
                            {dashboard.score}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div>
            <div className="ps-section__eyebrow">{dashboard.recentlyCompleted}</div>
            <div className="ps-card" style={{ marginTop: 8, minHeight: 0 }}>
              {topCompleted.length === 0 ? (
                <p style={{ color: "var(--ps-text-muted)", fontSize: 13, margin: 0 }}>
                  {dashboard.recentlyCompletedEmpty}
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {topCompleted.map((g) => {
                    const home = teamNameFor(g.home_team_id);
                    const away = teamNameFor(g.away_team_id);
                    return (
                      <li key={g.id}>
                        <Link
                          href={`/games/${g.id}`}
                          className="ps-pill"
                          style={{
                            textDecoration: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: "var(--ps-radius)",
                            background: "var(--ps-surface-container-low)",
                          }}
                        >
                          <span style={{ color: "var(--ps-text)" }}>
                            {home}
                            <strong> {g.home_score}–{g.away_score} </strong>
                            {away}
                          </span>
                          <span
                            style={{
                              color: "var(--ps-secondary)",
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatDate(g.end_time ?? g.start_time)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
