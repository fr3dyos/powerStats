import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import {
  formatDate,
  gamesApi,
  teamColor,
  type GameEvent,
} from "@/utils/api";
import { getServerLocale } from "@/utils/i18n-server";

export const dynamic = "force-dynamic";

type Params = { gameId: string };

const EVENT_LABEL_KEY: Record<GameEvent["event_type"], string> = {
  goal: "goal",
  assist: "assist",
  defense: "defense",
  timeout: "timeout",
  half: "half",
};

export default async function PublicMatchPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { dict } = await getServerLocale();
  const c = dict.common;
  const m = dict.match;
  const nav = dict.navigation;

  const { gameId: raw } = await params;
  const gameId = Number(raw);
  if (!Number.isFinite(gameId)) notFound();

  const game = await gamesApi.get(gameId).catch(() => null);
  if (!game) notFound();

  const home = game.home_team;
  const away = game.away_team;
  const accentHome = teamColor(home.name);
  const accentAway = teamColor(away.name);

  const status: "live" | "completed" | "scheduled" = game.is_completed
    ? "completed"
    : game.home_score > 0 || game.away_score > 0
      ? "live"
      : "scheduled";

  const events = game.game_events ?? [];

  return (
    <AppShell
      brandSubtitle={`${home.name} vs ${away.name} · ${m.title}`}
      footerText={c.footer}
      authLinks={[
        {
          label: m.backToTournament,
          href: game.tournament ? `/tournaments/${game.tournament.id}` : "/tournaments",
          variant: "ghost",
        },
        {
          label: m.backToBracket,
          href: game.tournament
            ? `/tournaments/${game.tournament.id}/bracket`
            : "/tournaments",
          variant: "ghost",
        },
        { label: nav.rankings, href: "/rankings", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              className="ps-disc ps-disc--lg"
              style={{
                background: accentHome ?? undefined,
                color: "#fff",
                borderColor: accentHome ?? undefined,
              }}
            >
              {home.name.slice(0, 2).toUpperCase()}
            </span>
            <span
              style={{
                fontFamily: "Montserrat, Inter, sans-serif",
                fontWeight: 800,
                fontSize: 28,
              }}
            >
              vs
            </span>
            <span
              className="ps-disc ps-disc--lg"
              style={{
                background: accentAway ?? undefined,
                color: "#fff",
                borderColor: accentAway ?? undefined,
              }}
            >
              {away.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <span className="ps-section__eyebrow">
              {game.tournament?.name ?? c.tournament} · {m.gameLabel} #{game.id}
            </span>
            <h1 style={{ marginTop: 4 }}>
              {home.name} vs {away.name}
            </h1>
            <p style={{ color: "var(--ps-text-muted)", marginTop: 4 }}>
              {formatDate(game.start_time)}
              {game.field_number ? ` · ${c.field} ${game.field_number}` : ""} ·{" "}
              {status === "live"
                ? c.liveNow
                : status === "completed"
                  ? c.completed
                  : c.scheduled}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
<div className="ps-stat-tile">
            <span className="ps-stat-tile__value ps-stat-tile__value--accent">
              {game.home_score}
            </span>
            <span className="ps-stat-tile__label">{home.name}</span>
          </div>
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value ps-stat-tile__value--accent">
              {game.away_score}
            </span>
            <span className="ps-stat-tile__label">{away.name}</span>
          </div>
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value">{game.score_limit ?? "—"}</span>
            <span className="ps-stat-tile__label">{m.scoreLimit}</span>
          </div>
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value">
              {game.time_limit ? `${game.time_limit}′` : "—"}
            </span>
            <span className="ps-stat-tile__label">{m.timeLimit}</span>
          </div>
        </div>

        <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
          <header
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--ps-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ fontSize: 18 }}>{m.events}</h2>
            <span className="ps-pill">
              {events.length} {c.gamesPlayed}
            </span>
          </header>
          {events.length === 0 ? (
            <p style={{ color: "var(--ps-text-muted)", padding: 16, fontSize: 13 }}>
              {m.noEvents}
            </p>
          ) : (
            <table className="ps-table">
              <thead>
                <tr>
                  <th>{m.period}</th>
                  <th>{m.event}</th>
                  <th>{c.player}</th>
                  <th style={{ textAlign: "right" }}>{m.points}</th>
                </tr>
              </thead>
              <tbody>
                {events
                  .slice()
                  .sort((a, b) => (a.id - b.id))
                  .map((ev) => (
                    <tr key={ev.id}>
                      <td className="ps-table__num">{ev.period ?? "—"}</td>
                      <td>{EVENT_LABEL_KEY[ev.event_type]}</td>
                      <td>{ev.player_id ? `#${ev.player_id}` : "—"}</td>
                      <td className="ps-table__num" style={{ textAlign: "right" }}>
                        {ev.points}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: 24 }}>
          <Link
            href={
              game.tournament
                ? `/tournaments/${game.tournament.id}`
                : "/tournaments"
            }
            className="ps-btn ps-btn--ghost"
          >
            ← {m.backToTournament}
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
