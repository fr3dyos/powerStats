import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import {
  formatPlayerName,
  playersApi,
  teamsApi,
  teamColor,
} from "@/utils/api";

export const dynamic = "force-dynamic";

type Params = { playerId: string };

// Roles allowed to see player-level admin actions. Mirrors the same allowlist
// used on /admin/* routes — kept inline so this page does not silently grant
// privileges if the helper set changes elsewhere.
const ADMIN_ACTION_ROLES = new Set(["admin", "scorekeeper"]);

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

  const { dict } = await getServerLocale();
  const p = dict.player;
  const c = dict.common;
  const ap = dict.adminPanel;

  // Read the current viewer's role so the admin actions card can be gated.
  // getAuthedUser() never throws on logged-out callers — it returns role: null,
  // which keeps the card hidden for public visitors.
  const cookieStore = await cookies();
  const { role } = await getAuthedUser(cookieStore);
  const canAdmin = role !== null && ADMIN_ACTION_ROLES.has(role);

  // Defensive read of the optional photo URL. The backend may add a
  // `photo_url` field at any point; the shared Player type does not declare
  // it, so we narrow the cast at the access site rather than widening the
  // type for every caller.
  const photoUrl = (player as { photo_url?: string | null }).photo_url ?? null;

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
      brandSubtitle={`${formatPlayerName(player)} · ${p.profile}`}
authLinks={[
        { label: p.profile, href: `/teams/${player.team_id}`, variant: "ghost" },
{ label: dict.navigation.rankings, href: "/rankings", variant: "ghost" },
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
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={formatPlayerName(player)}
              width={64}
              height={64}
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                objectFit: "cover",
                border: `2px solid ${accent ?? "var(--ps-border)"}`,
                background: "var(--ps-surface-container-high)",
              }}
            />
          ) : (
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
          )}
          <div>
<span className="ps-section__eyebrow">
              {team?.name ?? p.title} · #{player.jersey_number ?? "—"}
            </span>
            <h1 style={{ marginTop: 4 }}>{formatPlayerName(player)}</h1>
<p style={{ color: "var(--ps-text-muted)", marginTop: 4 }}>
              {p.gamesPlayedAcross.replace("{games}", String(totals.games_played)).replace(
                "{tournaments}",
                String(perTournament.length),
              )}
            </p>
          </div>
        </div>

        {canAdmin ? (
          <div className="ps-card" style={{ marginBottom: 24 }}>
            <span className="ps-section__eyebrow">{ap.adminActions}</span>
            <h3 style={{ marginTop: 4 }}>{ap.adminActions}</h3>
            <p
              style={{
                color: "var(--ps-text-muted)",
                fontSize: 13,
                margin: "0 0 12px",
              }}
            >
              {ap.adminActionsCopy}
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Link
                href={`/admin/players/${playerId}/edit`}
                className="ps-btn ps-btn--secondary"
              >
                {ap.editPlayer}
              </Link>
              <Link
                href={`/admin/players/${playerId}/transfer`}
                className="ps-btn ps-btn--secondary"
              >
                {ap.transferPlayer}
              </Link>
              <Link
                href={`/admin/players/${playerId}/photo`}
                className="ps-btn ps-btn--secondary"
              >
                {ap.uploadPhoto}
              </Link>
            </div>
          </div>
        ) : null}

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
                <span className="ps-stat-tile__label">{p.goals}</span>
              </div>
              <div className="ps-stat-tile">
                <span className="ps-stat-tile__value">{totals.assists}</span>
                <span className="ps-stat-tile__label">{p.assists}</span>
              </div>
              <div className="ps-stat-tile">
                <span className="ps-stat-tile__value">{totals.defenses}</span>
                <span className="ps-stat-tile__label">{p.defenses}</span>
              </div>
              <div className="ps-stat-tile">
                <span className="ps-stat-tile__value ps-stat-tile__value--accent">
                  {totals.games_played}
                </span>
                <span className="ps-stat-tile__label">{p.games}</span>
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
<h2 style={{ fontSize: 18 }}>{p.latestTournament}</h2>
                  <Link
                    href={`/tournaments/${head.tournament_id}`}
                    className="ps-pill"
                    style={{ textDecoration: "none" }}
                  >
                    {head.tournament_name ?? c.tournament} →
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
                      label={p.goalsPerGame}
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
                      label={p.assistsPerGame}
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
                      label={p.defensesPerGame}
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
<h2 style={{ fontSize: 18 }}>{p.tournamentHistory}</h2>
              </header>
              {perTournament.length === 0 ? (
                <p style={{ color: "var(--ps-text-muted)", padding: 16, fontSize: 13 }}>
                  {p.noTournamentStats}
                </p>
              ) : (
                <table className="ps-table">
                  <thead>
                    <tr>
                      <th>{c.tournament}</th>
                      <th style={{ textAlign: "right" }}>{p.goals}</th>
                      <th style={{ textAlign: "right" }}>{p.assists}</th>
                      <th style={{ textAlign: "right" }}>{p.defenses}</th>
                      <th style={{ textAlign: "right" }}>{c.gamesPlayedShort}</th>
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
{row.tournament_name ?? `${c.tournament} #${row.tournament_id}`}
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
              <span className="ps-section__eyebrow">{p.playerCard}</span>
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
                  <strong>{p.team}:</strong>{" "}
                  <Link
                    href={`/teams/${player.team_id}`}
                    style={{ color: "var(--ps-secondary)" }}
                  >
                    {team?.name ?? "—"}
                  </Link>
                </li>
                <li>
                  <strong>{p.jersey}:</strong> {player.jersey_number ?? "—"}
                </li>
                <li>
                  <strong>{p.gamesPlayed}:</strong> {totals.games_played}
                </li>
                <li>
                  <strong>{p.goalsConceded}:</strong> {totals.goals_conceded}
                </li>
              </ul>
            </div>

            {head && head.goals + head.assists + head.defenses > 0 ? (
              <div className="ps-card">
                <span className="ps-section__eyebrow">{p.spiritOfTheGame}</span>
                <p style={{ color: "var(--ps-text-muted)", fontSize: 13 }}>
                  {p.noSotg}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
