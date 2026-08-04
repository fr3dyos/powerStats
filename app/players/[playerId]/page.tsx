import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import {
  formatPlayerName,
  playersApi,
  teamsApi,
  teamColor,
} from "@/utils/api";

export const dynamic = "force-dynamic";

type Params = { playerId: string };

/** Render a Stitch-style progress ring for a percentage value. */
function ProgressRing({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: "orange" | "teal" | "lime";
  label: string;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);
  const stroke =
    color === "teal"
      ? "var(--ps-secondary)"
      : color === "lime"
        ? "var(--ps-lime)"
        : "var(--ps-primary-container)";
  const display = `${Math.round(pct * 100)}%`;
  return (
    <div className="ps-progress-ring" style={{ ["--ps-progress" as never]: pct }}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r={radius}
          strokeWidth="6"
          className="ps-progress-ring__track"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          strokeWidth="6"
          className="ps-progress-ring__bar"
          style={{
            stroke,
            strokeDasharray: circumference,
            strokeDashoffset: dashOffset,
          }}
        />
      </svg>
      <span className="ps-progress-ring__value">{display}</span>
      <span
        style={{
          position: "absolute",
          bottom: -16,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: "var(--ps-text-muted)",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { playerId: raw } = await params;
  const playerId = Number(raw);
  if (!Number.isFinite(playerId)) notFound();

  const [player, statsRes] = await Promise.all([
    playersApi.get(playerId).catch(() => null),
    playersApi.stats(playerId).catch(() => null),
  ]);
  if (!player) notFound();

  const team = await teamsApi.get(player.team_id).catch(() => null);
  const accent = teamColor(team?.name);

  // Find the most relevant tournament (the one with the most games played).
  const perTournament = statsRes?.per_tournament ?? [];
  const head = perTournament.slice().sort((a, b) => b.games_played - a.games_played)[0];

  // Per-game ratios for the head tournament.
  const goalsPerGame = head ? head.goals / Math.max(1, head.games_played) : 0;
  const assistsPerGame = head ? head.assists / Math.max(1, head.games_played) : 0;
  const defensesPerGame = head ? head.defenses / Math.max(1, head.games_played) : 0;
  const totals = statsRes?.totals ?? {
    games_played: 0,
    goals: 0,
    assists: 0,
    defenses: 0,
    goals_conceded: 0,
  };

  return (
    <AppShell
      brandSubtitle={`${formatPlayerName(player)} · Profile`}
      authLinks={[
        { label: "← Team profile", href: `/teams/${player.team_id}`, variant: "ghost" },
        { label: "Rankings", href: "/rankings", variant: "ghost" },
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
          <span
            className="ps-disc ps-disc--lg"
            style={{
              background: accent ?? undefined,
              color: "#fff",
              borderColor: accent ?? undefined,
            }}
          >
            {player.jersey_number ?? "?"}
          </span>
          <div>
            <span className="ps-section__eyebrow">
              {team?.name ?? "Player"} · #{player.jersey_number ?? "—"}
            </span>
            <h1 style={{ marginTop: 4 }}>{formatPlayerName(player)}</h1>
            <p style={{ color: "var(--ps-text-muted)", marginTop: 4 }}>
              {totals.games_played} games played across {perTournament.length}{" "}
              {perTournament.length === 1 ? "tournament" : "tournaments"}
            </p>
          </div>
        </div>

        <div className="ps-split ps-split--2-1">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              className="ps-card"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div className="ps-stat-tile">
                <span className="ps-stat-tile__value">{totals.goals}</span>
                <span className="ps-stat-tile__label">Goals</span>
              </div>
              <div className="ps-stat-tile">
                <span className="ps-stat-tile__value">{totals.assists}</span>
                <span className="ps-stat-tile__label">Assists</span>
              </div>
              <div className="ps-stat-tile">
                <span className="ps-stat-tile__value">{totals.defenses}</span>
                <span className="ps-stat-tile__label">Defenses</span>
              </div>
              <div className="ps-stat-tile">
                <span className="ps-stat-tile__value ps-stat-tile__value--accent">
                  {totals.games_played}
                </span>
                <span className="ps-stat-tile__label">Games</span>
              </div>
            </div>

            {head ? (
              <div className="ps-card">
                <header
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <h2 style={{ fontSize: 18 }}>Latest tournament</h2>
                  <Link
                    href={`/tournaments/${head.tournament_id}`}
                    className="ps-pill"
                    style={{ textDecoration: "none" }}
                  >
                    {head.tournament_name ?? "Tournament"} →
                  </Link>
                </header>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 16,
                    marginTop: 24,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <ProgressRing
                      value={goalsPerGame}
                      max={Math.max(goalsPerGame, 1.5)}
                      color="lime"
                      label="Goals / game"
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <ProgressRing
                      value={assistsPerGame}
                      max={Math.max(assistsPerGame, 2)}
                      color="teal"
                      label="Assists / game"
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <ProgressRing
                      value={defensesPerGame}
                      max={Math.max(defensesPerGame, 1.2)}
                      color="orange"
                      label="Defenses / game"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
              <header
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--ps-border)",
                }}
              >
                <h2 style={{ fontSize: 18 }}>Tournament history</h2>
              </header>
              {perTournament.length === 0 ? (
                <p style={{ color: "var(--ps-text-muted)", padding: 16, fontSize: 13 }}>
                  No tournament stats yet.
                </p>
              ) : (
                <table className="ps-table">
                  <thead>
                    <tr>
                      <th>Tournament</th>
                      <th style={{ textAlign: "right" }}>G</th>
                      <th style={{ textAlign: "right" }}>A</th>
                      <th style={{ textAlign: "right" }}>D</th>
                      <th style={{ textAlign: "right" }}>GP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perTournament.map((row) => (
                      <tr key={row.tournament_id}>
                        <td>
                          <Link
                            href={`/tournaments/${row.tournament_id}`}
                            style={{ color: "var(--ps-text)" }}
                          >
                            {row.tournament_name ?? `Tournament #${row.tournament_id}`}
                          </Link>
                        </td>
                        <td className="ps-table__num" style={{ textAlign: "right" }}>
                          {row.goals}
                        </td>
                        <td className="ps-table__num" style={{ textAlign: "right" }}>
                          {row.assists}
                        </td>
                        <td className="ps-table__num" style={{ textAlign: "right" }}>
                          {row.defenses}
                        </td>
                        <td className="ps-table__num" style={{ textAlign: "right" }}>
                          {row.games_played}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="ps-card">
              <span className="ps-section__eyebrow">Player card</span>
              <h3 style={{ marginTop: 4 }}>{formatPlayerName(player)}</h3>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "12px 0 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 13,
                }}
              >
                <li>
                  <strong>Team:</strong>{" "}
                  <Link
                    href={`/teams/${player.team_id}`}
                    style={{ color: "var(--ps-secondary)" }}
                  >
                    {team?.name ?? "—"}
                  </Link>
                </li>
                <li>
                  <strong>Jersey:</strong> {player.jersey_number ?? "—"}
                </li>
                <li>
                  <strong>Games played:</strong> {totals.games_played}
                </li>
                <li>
                  <strong>Goals conceded:</strong> {totals.goals_conceded}
                </li>
              </ul>
            </div>

            {head && head.goals + head.assists + head.defenses > 0 ? (
              <div className="ps-card">
                <span className="ps-section__eyebrow">Spirit of the Game</span>
                <p style={{ color: "var(--ps-text-muted)", fontSize: 13 }}>
                  SOTG ratings are not collected for this player yet.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
