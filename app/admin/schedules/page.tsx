import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import { formatDate, gamesApi, tournamentsApi, type Game } from "@/utils/api";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "scorekeeper"]);

/**
 * Cross-tournament live + upcoming games view.  Aggregates every game
 * from every tournament the admin can see, then sorts live games by
 * most-recently-started first and upcoming games by closest start.
 */
export default async function AdminSchedulesPage() {
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
  const as_ = dict.adminSchedules;
  const common = dict.common;

  const tournaments = await tournamentsApi.list(50).catch(() => []);
  const teamName = new Map<number, string>();
  const tournamentName = new Map<number, string>();
  const live: Array<Game & { _tournamentId: number }> = [];
  const upcoming: Array<Game & { _tournamentId: number }> = [];
  const now = Date.now();

  for (const t of tournaments) {
    tournamentName.set(t.id, t.name);
    try {
      const tour = await tournamentsApi.get(t.id);
      for (const team of tour?.teams ?? []) {
        if (!teamName.has(team.id)) teamName.set(team.id, team.name);
      }
    } catch {
      /* ignore tournament detail failure */
    }
    const games = await gamesApi.listByTournament(t.id).catch(() => []);
    for (const g of games) {
      const annotated = { ...g, _tournamentId: t.id };
      if (g.is_completed) continue;
      const startMs = g.start_time ? Date.parse(g.start_time) : NaN;
      if (!Number.isFinite(startMs) || startMs <= now) {
        live.push(annotated);
      } else {
        upcoming.push(annotated);
      }
    }
  }

  const sortByStart = (
    a: { start_time?: string | null },
    b: { start_time?: string | null },
  ) => {
    const av = a.start_time ? Date.parse(a.start_time) : 0;
    const bv = b.start_time ? Date.parse(b.start_time) : 0;
    return (Number.isFinite(av) ? av : 0) - (Number.isFinite(bv) ? bv : 0);
  };
  live.sort(sortByStart);
  upcoming.sort(sortByStart);

  const total = live.length + upcoming.length;
  const teamNameFor = (id: number) => teamName.get(id) ?? "—";
  const tournamentNameFor = (id: number) =>
    tournamentName.get(id) ?? `#${id}`;

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
            <h1>{as_.title}</h1>
            <span className="ps-status-pill" aria-live="polite">
              {as_.summary.replace("{total}", String(total))}
            </span>
          </div>
          <SignOutButton label={auth.signOut} />
        </header>

        <p className="ps-admin__subtitle">{as_.subtitle}</p>

        {total === 0 ? (
          <div className="ps-card">
            <p>{as_.noGames}</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
              alignItems: "start",
            }}
          >
            <ScheduleColumn
              title={as_.live}
              rows={live}
              renderOpenHref={(g) => `/admin/games/${g.id}/score`}
              renderSecondary={(g) =>
                tournamentNameFor(g._tournamentId)
              }
              renderPrimary={(g) =>
                `${teamNameFor(g.home_team_id)} vs ${teamNameFor(g.away_team_id)}`
              }
              renderTertiary={(g) =>
                g.field_number ? `${common.field} ${g.field_number}` : ""
              }
              openLabel={as_.openScoring}
              emptyMessage={as_.noGames}
            />
            <ScheduleColumn
              title={as_.upcoming}
              rows={upcoming}
              renderOpenHref={(g) => `/admin/games/${g.id}/score`}
              renderSecondary={(g) =>
                tournamentNameFor(g._tournamentId)
              }
              renderPrimary={(g) =>
                `${teamNameFor(g.home_team_id)} vs ${teamNameFor(g.away_team_id)}`
              }
              renderTertiary={(g) =>
                g.start_time ? formatDate(g.start_time) : ""
              }
              openLabel={as_.openScoring}
              emptyMessage={as_.noGames}
            />
          </div>
        )}
      </section>
    </AppShell>
  );
}

type ColumnProps = {
  title: string;
  rows: Array<Game & { _tournamentId: number }>;
  renderPrimary: (g: Game & { _tournamentId: number }) => string;
  renderSecondary: (g: Game & { _tournamentId: number }) => string;
  renderTertiary: (g: Game & { _tournamentId: number }) => string;
  renderOpenHref: (g: Game & { _tournamentId: number }) => string;
  openLabel: string;
  emptyMessage: string;
};

function ScheduleColumn({
  title,
  rows,
  renderPrimary,
  renderSecondary,
  renderTertiary,
  renderOpenHref,
  openLabel,
  emptyMessage,
}: ColumnProps) {
  return (
    <div>
      <div className="ps-section__eyebrow">{title}</div>
      <div className="ps-card" style={{ marginTop: 8 }}>
        {rows.length === 0 ? (
          <p
            style={{
              color: "var(--ps-text-muted)",
              fontSize: 13,
              margin: 0,
            }}
          >
            {emptyMessage}
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
            {rows.map((g) => (
              <li key={g.id}>
                <Link
                  href={renderOpenHref(g)}
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
                    {renderPrimary(g)}
                    <span
                      style={{
                        display: "block",
                        color: "var(--ps-text-muted)",
                        fontSize: 12,
                      }}
                    >
                      {renderSecondary(g)}
                      {renderTertiary(g) ? ` · ${renderTertiary(g)}` : ""}
                    </span>
                  </span>
                  <span
                    style={{
                      color: "var(--ps-primary-container)",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      fontSize: 13,
                    }}
                  >
                    {openLabel}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
