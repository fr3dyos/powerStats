import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { getAuthedUser } from "@/utils/supabase/server";
import { getServerLocale } from "@/utils/i18n-server";
import {
  formatDate,
  formatPlayerName,
  playersApi,
  teamsApi,
  teamColor,
  tournamentsApi,
  type Game,
  type Team,
} from "@/utils/api";

export const dynamic = "force-dynamic";

type Params = { teamId: string };

// Roles allowed to see team-level admin actions. Mirrors the same allowlist
// used on /admin/* routes — kept inline so this page does not silently grant
// privileges if the helper set changes elsewhere.
const ADMIN_ACTION_ROLES = new Set(["admin", "scorekeeper"]);

export default async function TeamProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { teamId: raw } = await params;
  const teamId = Number(raw);
  if (!Number.isFinite(teamId)) notFound();

  const team = await teamsApi.get(teamId).catch(() => null);
  if (!team) notFound();

  // Read the current viewer's role so the admin actions panel can be gated.
  // getAuthedUser() never throws on logged-out callers — it returns role: null,
  // which keeps the panel hidden for public visitors.
  const cookieStore = await cookies();
  const { role } = await getAuthedUser(cookieStore);
  const canAdmin = role !== null && ADMIN_ACTION_ROLES.has(role);

  const { dict } = await getServerLocale();
  const t = dict.team;
  const c = dict.common;
  const ap = dict.adminPanel;
  const at = dict.adminTournaments;

  const [tournament, tournamentTeams] = await Promise.all([
    tournamentsApi.get(team.tournament_id).catch(() => null),
    teamsApi.listByTournament(team.tournament_id).catch(() => []),
  ]);
  const teamNameById = new Map(
    tournamentTeams.map((t) => [t.id, t.name] as const),
  );

  const allGames: Game[] = [...(team.home_games ?? []), ...(team.away_games ?? [])]
    .sort((a, b) => {
      const at = a.start_time ? Date.parse(a.start_time) : 0;
      const bt = b.start_time ? Date.parse(b.start_time) : 0;
      return at - bt;
    });

  const wins = allGames.filter(
    (g) =>
      g.is_completed &&
      ((g.home_team_id === team.id && g.home_score > g.away_score) ||
        (g.away_team_id === team.id && g.away_score > g.home_score)),
  ).length;
  const losses = allGames.filter(
    (g) =>
      g.is_completed &&
      ((g.home_team_id === team.id && g.home_score < g.away_score) ||
        (g.away_team_id === team.id && g.away_score < g.home_score)),
  ).length;

  const accent = teamColor(team.name);

  return (
<AppShell
      brandSubtitle={`${team.name} · ${t.profile}`}
      authLinks={[
        {
          label: t.tournamentHub,
          href: tournament ? `/tournaments/${tournament.id}` : "/tournaments",
          variant: "ghost",
        },
        {
          label: dict.navigation.rankings,
          href: "/rankings",
          variant: "ghost",
        },
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
            {team.name.slice(0, 2).toUpperCase()}
          </span>
<div>
<span className="ps-section__eyebrow">
              {tournament?.name ?? c.tournament}
            </span>
            <h1
              style={{
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {team.name}
              {/* Monospace team-ID badge so admins can cross-reference the
                  database tables quickly. */}
              <span
                className="ps-id-badge"
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ps-text-muted)",
                  background: "var(--ps-surface-container-high)",
                  border: "1px solid var(--ps-border)",
                  borderRadius: "var(--ps-radius-full)",
                  padding: "2px 10px",
                  letterSpacing: "0.02em",
                }}
              >
                #{team.id}
              </span>
            </h1>
            {tournament ? (
              <p style={{ color: "var(--ps-text-muted)", marginTop: 4 }}>
                {formatDate(tournament.start_date)} →{" "}
                {formatDate(tournament.end_date)} · {tournament.location ?? "—"}
              </p>
            ) : null}
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
              {wins}
            </span>
            <span className="ps-stat-tile__label">{t.wins}</span>
          </div>
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value">{losses}</span>
            <span className="ps-stat-tile__label">{t.losses}</span>
          </div>
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value">{team.players.length}</span>
            <span className="ps-stat-tile__label">{t.rosterSize}</span>
          </div>
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value">{allGames.length}</span>
            <span className="ps-stat-tile__label">{t.gamesPlayed}</span>
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
                href={`/admin/teams/${teamId}/edit`}
                className="ps-btn ps-btn--secondary"
              >
                {ap.editTeam}
              </Link>
              <Link
                href={`/admin/players?teamId=${teamId}`}
                className="ps-btn ps-btn--secondary"
              >
                {at.addPlayer}
              </Link>
              <Link
                href={`/admin/teams/${teamId}/logo`}
                className="ps-btn ps-btn--secondary"
              >
                {ap.uploadLogo}
              </Link>
            </div>
          </div>
        ) : null}

        <div className="ps-split ps-split--1-2">
          <div className="ps-card">
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
<h2 style={{ fontSize: 18 }}>{t.roster}</h2>
              <span className="ps-pill">
                {team.players.length} {c.players}
              </span>
            </header>
            {team.players.length === 0 ? (
              <p style={{ color: "var(--ps-text-muted)", fontSize: 13 }}>
                {t.noPlayersCopy}
              </p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {team.players
                  .slice()
                  .sort((a, b) =>
                    (a.jersey_number ?? 999) - (b.jersey_number ?? 999),
                  )
                  .map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/players/${p.id}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "8px 10px",
                          borderRadius: 8,
                          color: "var(--ps-text)",
                          textDecoration: "none",
                        }}
                      >
                        <span
                          className="ps-disc ps-disc--sm"
                          style={{ background: accent ?? undefined }}
                        >
                          {p.jersey_number ?? "?"}
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {formatPlayerName(p)}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
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
<h2 style={{ fontSize: 18 }}>{t.matchHistory}</h2>
              <span className="ps-pill">
                {allGames.length} {c.games}
              </span>
            </header>
            {allGames.length === 0 ? (
              <p style={{ color: "var(--ps-text-muted)", padding: 16, fontSize: 13 }}>
                {t.noGamesCopy}
              </p>
            ) : (
              <table className="ps-table">
                <thead>
                  <tr>
                    <th>{c.date}</th>
                    <th>{c.opponent}</th>
                    <th style={{ textAlign: "right" }}>{c.score}</th>
                    <th>{c.result}</th>
                  </tr>
                </thead>
                <tbody>
                  {allGames.map((g) => {
                    const isHome = g.home_team_id === team.id;
                    const us = isHome ? g.home_score : g.away_score;
                    const them = isHome ? g.away_score : g.home_score;
                    const opponentId = isHome ? g.away_team_id : g.home_team_id;
                    const opponent =
                      teamNameById.get(opponentId) ??
                      (isHome ? g.away_team?.name : g.home_team?.name);
                    let result: { label: string; tone: "win" | "loss" | "pending" };
                    if (!g.is_completed) {
                      result = { label: c.pending, tone: "pending" };
                    } else if (us > them) {
                      result = { label: c.win, tone: "win" };
                    } else if (us < them) {
                      result = { label: c.loss, tone: "loss" };
                    } else {
                      result = { label: c.tie, tone: "pending" };
                    }
                    return (
                      <tr key={g.id}>
                        <td style={{ color: "var(--ps-text-muted)" }}>
                          {formatDate(g.start_time)}
                        </td>
                        <td>
                          <Link
                            href={`/teams/${opponentId}`}
                            style={{ color: "var(--ps-text)" }}
                          >
                            {opponent ?? "TBD"}
                          </Link>
                        </td>
                        <td className="ps-table__num" style={{ textAlign: "right" }}>
                          {us}-{them}
                        </td>
                        <td>
                          <span
                            className={
                              result.tone === "win"
                                ? "ps-status-badge ps-status-badge--active"
                                : result.tone === "loss"
                                  ? "ps-status-badge ps-status-badge--completed"
                                  : "ps-status-badge ps-status-badge--pending"
                            }
                          >
                            {result.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
