import Link from "next/link";

import { AppShell } from "@/app/_components/AppShell";
import {
  formatDateRange,
  teamColor,
  tournamentsApi,
  teamsApi,
} from "@/utils/api";

export const dynamic = "force-dynamic";

export default async function TournamentsListPage() {
  const tournaments = await tournamentsApi.list(100).catch(() => []);
  // Pre-fetch team counts so each card shows the team count without N+1.
  const teamCounts = await Promise.all(
    tournaments.map(async (t) => {
      try {
        const teams = await teamsApi.listByTournament(t.id);
        return { id: t.id, count: teams.length };
      } catch {
        return { id: t.id, count: 0 };
      }
    }),
  );
  const countById = new Map(teamCounts.map((c) => [c.id, c.count]));

  return (
    <AppShell
      brandSubtitle="Ultimate Frisbee tournament manager"
      authLinks={[
        { label: "Rankings", href: "/rankings", variant: "ghost" },
        { label: "Admin", href: "/admin/login", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <div className="ps-section">
          <span className="ps-section__eyebrow">Browse</span>
          <h1>Tournaments</h1>
          <p>
            Every tournament run on PowerStats — past, present, and upcoming.
            Open one to see the bracket, the leaderboards, and the per-team
            performance.
          </p>
        </div>

        {tournaments.length === 0 ? (
          <div className="ps-card">
            <h3>No tournaments yet</h3>
            <p>
              When an organizer publishes a tournament, it will appear here.
              Sign in as an admin to create one.
            </p>
          </div>
        ) : (
          <div className="ps-card-list">
            {tournaments.map((t) => {
              const accent = teamColor(t.name);
              return (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.id}`}
                  className="ps-card ps-card--linked"
                  style={{
                    borderLeft: accent
                      ? `3px solid ${accent}`
                      : "3px solid var(--ps-primary-container)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span className="ps-pill">
                      {countById.get(t.id) ?? 0} teams
                    </span>
                    <span
                      className="ps-card__icon"
                      aria-hidden="true"
                      style={{
                        background: accent ?? "var(--ps-surface-container-high)",
                        color: "#fff",
                      }}
                    >
                      {(t.name ?? "?").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <h3 style={{ marginTop: 8 }}>{t.name}</h3>
                  <p style={{ fontSize: 13 }}>
                    {formatDateRange(t.start_date, t.end_date)}
                  </p>
                  {t.location ? (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--ps-text-muted)",
                        margin: 0,
                      }}
                    >
                      📍 {t.location}
                    </p>
                  ) : null}
                  <span className="ps-card__footer">View tournament →</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
