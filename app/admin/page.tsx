import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getServerLocale } from "@/utils/i18n-server";
import { getAuthedUser } from "@/utils/supabase/server";
import { gamesApi, tournamentsApi } from "@/utils/api";

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
      </section>
    </AppShell>
  );
}