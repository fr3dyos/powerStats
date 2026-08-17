"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { teamColor, type Game, type Team, type Tournament } from "@/utils/api-shared";
import { matchesQuery } from "@/app/_components/ListSearch";

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
  pickTournamentFirst: string;
  searchPlaceholder: string;
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
  const [query, setQuery] = useState("");
  // When the table-level filter is "all", the "+ New game" CTA needs a
  // specific tournament to deep-link into. The user picks one inline; the
  // CTA stays disabled until they do so we never bounce them to a generic
  // page without context.
  const [inlineTournament, setInlineTournament] = useState<number | "">(
    rows[0]?.tournament.id ?? "",
  );

  const tournamentOptions = useMemo(() => {
    return rows.map((r) => ({ id: r.tournament.id, name: r.tournament.name }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const byTournament =
      tournamentFilter === "all"
        ? rows
        : rows.filter((r) => r.tournament.id === tournamentFilter);
    if (!query.trim()) return byTournament;
    return byTournament
      .map((r) => {
        const teamNames = r.teams.map((t) => t.name).join(" ");
        const games = r.games.filter((g) => {
          const home = r.teams.find((t) => t.id === g.home_team_id)?.name ?? "";
          const away = r.teams.find((t) => t.id === g.away_team_id)?.name ?? "";
          return matchesQuery(query, [
            r.tournament.name,
            teamNames,
            home,
            away,
            g.field_number != null ? String(g.field_number) : "",
          ]);
        });
        return { ...r, games };
      })
      .filter((r) => r.games.length > 0);
  }, [rows, tournamentFilter, query]);

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
          <input
            type="search"
            className="ps-input"
            placeholder={labels.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={labels.searchPlaceholder}
            style={{ maxWidth: 240 }}
          />
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

      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {tournamentFilter === "all" ? (
          <>
            <label
              htmlFor="ps-games-inline-tournament"
              style={{ fontSize: 13, color: "var(--ps-text-muted)" }}
            >
              {labels.tournament}
            </label>
            <select
              id="ps-games-inline-tournament"
              className="ps-input"
              value={inlineTournament === "" ? "" : String(inlineTournament)}
              onChange={(e) => {
                const value = e.target.value;
                setInlineTournament(value === "" ? "" : Number(value));
              }}
              style={{ maxWidth: 280 }}
            >
              <option value="" disabled>
                {labels.pickTournamentFirst}
              </option>
              {tournamentOptions.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <Link
          aria-disabled={
            tournamentFilter === "all" && inlineTournament === ""
          }
          href={
            tournamentFilter !== "all"
              ? `/admin/tournaments/${tournamentFilter}/games/new`
              : inlineTournament !== ""
                ? `/admin/tournaments/${inlineTournament}/games/new`
                : "#"
          }
          className="ps-btn ps-btn--primary"
          style={{
            pointerEvents:
              tournamentFilter === "all" && inlineTournament === ""
                ? "none"
                : "auto",
            opacity:
              tournamentFilter === "all" && inlineTournament === "" ? 0.5 : 1,
          }}
        >
          + {labels.newGame}
        </Link>
      </div>
    </>
  );
}
