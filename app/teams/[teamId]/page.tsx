import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
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
      brandSubtitle={`${team.name} · Team profile`}
      authLinks={[
        {
          label: "← Tournament hub",
          href: tournament ? `/tournaments/${tournament.id}` : "/tournaments",
          variant: "ghost",
        },
        {
          label: "Rankings",
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
              {tournament?.name ?? "Tournament"}
            </span>
            <h1 style={{ marginTop: 4 }}>{team.name}</h1>
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
            <span className="ps-stat-tile__label">Wins</span>
          </div>
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value">{losses}</span>
            <span className="ps-stat-tile__label">Losses</span>
          </div>
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value">{team.players.length}</span>
            <span className="ps-stat-tile__label">Roster size</span>
          </div>
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value">{allGames.length}</span>
            <span className="ps-stat-tile__label">Games played</span>
          </div>
        </div>

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
              <h2 style={{ fontSize: 18 }}>Roster</h2>
              <span className="ps-pill">{team.players.length} players</span>
            </header>
            {team.players.length === 0 ? (
              <p style={{ color: "var(--ps-text-muted)", fontSize: 13 }}>
                No players registered yet.
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
              <h2 style={{ fontSize: 18 }}>Match history</h2>
              <span className="ps-pill">{allGames.length} games</span>
            </header>
            {allGames.length === 0 ? (
              <p style={{ color: "var(--ps-text-muted)", padding: 16, fontSize: 13 }}>
                No games scheduled yet.
              </p>
            ) : (
              <table className="ps-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    <th style={{ textAlign: "right" }}>Score</th>
                    <th>Result</th>
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
                      result = { label: "Pending", tone: "pending" };
                    } else if (us > them) {
                      result = { label: "Win", tone: "win" };
                    } else if (us < them) {
                      result = { label: "Loss", tone: "loss" };
                    } else {
                      result = { label: "Tie", tone: "pending" };
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
