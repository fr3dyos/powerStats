"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { teamColor, type Game, type Team, type Tournament } from "@/utils/api-shared";

type Row = {
  tournament: Tournament;
  teams: Team[];
  games: Game[];
};

// Plain-text labels passed in from the server parent (see page.tsx).
type Labels = {
  tournament: string;
  teams: string;
  score: string;
  date: string;
  field: string;
  status: string;
  scheduled: string;
  completed: string;
  live: string;
  noGames: string;
  all: string;
  newGame: string;
  noTeams: string;
  noTeamsHint: string;
};

type GamesAdminTableProps = {
  rows: Row[];
  labels: Labels;
};

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export default function GamesAdminTable({ rows, labels }: GamesAdminTableProps) {
  const [tournamentFilter, setTournamentFilter] = useState<number | "all">("all");

  const tournamentOptions = useMemo(() => {
    return rows.map((r) => ({ id: r.tournament.id, name: r.tournament.name }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (tournamentFilter === "all") return rows;
    return rows.filter((r) => r.tournament.id === tournamentFilter);
  }, [rows, tournamentFilter]);

  const totalGames = filteredRows.reduce((acc, r) => acc + r.games.length, 0);

  return (
    <>
      <div
        className="ps-card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
          padding: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label
            htmlFor="ps-games-tournament-filter"
            style={{ fontSize: 13, color: "var(--ps-text-muted)" }}
          >
            {labels.tournament}
          </label>
          <select
            id="ps-games-tournament-filter"
            className="ps-input"
            value={tournamentFilter === "all" ? "all" : String(tournamentFilter)}
            onChange={(e) => {
              const value = e.target.value;
              setTournamentFilter(value === "all" ? "all" : Number(value));
            }}
            style={{ maxWidth: 280 }}
          >
            <option value="all">{labels.all}</option>
            {tournamentOptions.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <span style={{ fontSize: 13, color: "var(--ps-text-muted)" }}>
          {totalGames} {totalGames === 1 ? "game" : "games"}
        </span>
      </div>

      {totalGames === 0 ? (
        <div className="ps-card">
          <h3>{labels.noGames}</h3>
          <p>{labels.noTeamsHint}</p>
        </div>
      ) : (
        <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="ps-table">
            <thead>
              <tr>
                <th>{labels.tournament}</th>
                <th>{labels.score}</th>
                <th>{labels.date}</th>
                <th>{labels.field}</th>
                <th>{labels.status}</th>
                <th style={{ textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ tournament, teams, games }) =>
                games.map((game) => {
                  const home = teams.find((t) => t.id === game.home_team_id);
                  const away = teams.find((t) => t.id === game.away_team_id);
                  const homeColor = teamColor(home?.name);
                  const awayColor = teamColor(away?.name);
                  return (
                    <tr key={game.id}>
                      <td>
                        <Link
                          href={`/tournaments/${tournament.id}`}
                          style={{
                            color: "var(--ps-text)",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          {tournament.name}
                        </Link>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {homeColor ? (
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: homeColor,
                                  display: "inline-block",
                                  flexShrink: 0,
                                }}
                              />
                            ) : null}
                            <span style={{ fontWeight: 600 }}>{home?.name ?? `#${game.home_team_id}`}</span>
                            <span className="ps-table__num" style={{ marginLeft: "auto" }}>
                              {game.home_score}
                            </span>
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {awayColor ? (
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: awayColor,
                                  display: "inline-block",
                                  flexShrink: 0,
                                }}
                              />
                            ) : null}
                            <span style={{ fontWeight: 600 }}>{away?.name ?? `#${game.away_team_id}`}</span>
                            <span className="ps-table__num" style={{ marginLeft: "auto" }}>
                              {game.away_score}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 13 }}>{formatTime(game.start_time)}</span>
                        <div style={{ fontSize: 12, color: "var(--ps-text-muted)" }}>
                          {game.game_rule === "score_limit"
                            ? `${game.score_limit ?? ""} ${labels.score.toLowerCase()}`
                            : `${game.time_limit ?? ""} min`}
                        </div>
                      </td>
                      <td className="ps-table__num">
                        {game.field_number ? `#${game.field_number}` : "—"}
                      </td>
                      <td>
                        {game.is_completed ? (
                          <span className="ps-status-pill">{labels.completed}</span>
                        ) : game.is_live ? (
                          <span
                            className="ps-status-pill"
                            style={{ color: "var(--ps-accent)" }}
                          >
                            {labels.live}
                          </span>
                        ) : (
                          <span className="ps-status-pill">{labels.scheduled}</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <Link
                          href={`/admin/games/${game.id}/score`}
                          style={{ fontSize: 12, color: "var(--ps-accent)" }}
                        >
                          Score
                        </Link>
                        <Link
                          href={`/games/${game.id}`}
                          style={{
                            fontSize: 12,
                            color: "var(--ps-accent)",
                            marginLeft: 12,
                          }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Link
          href={
            tournamentFilter !== "all"
              ? `/admin/tournaments/${tournamentFilter}/games/new`
              : "/admin/tournaments"
          }
          className="ps-btn ps-btn--primary"
        >
          + {labels.newGame}
        </Link>
      </div>
    </>
  );
}
