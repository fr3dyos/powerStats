"use client";

// Public games index — pulls games across every tournament and shows the
// basics (date, matchup, score, tournament, status). The backend `/games`
// list route returns flat `Game` rows (no nested `home_team`/`away_team`),
// so we fetch the teams per tournament and resolve names client-side.
// Admin/scorekeeper actions (New game / Enter result) are only shown to
// authenticated users.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { formatDate, type Game, type Team, type Tournament } from "@/utils/api-shared";
import { mapWithConcurrency } from "@/utils/async";
import { AppShell } from "@/app/_components/AppShell";
import { createClient } from "@/utils/supabase/client";
import { ListSearch, matchesQuery } from "@/app/_components/ListSearch";

// --- Tiny fetch wrapper (mirrors the one in /teams; consolidated when
// both pages move to use `apiFetch` from utils/api.ts).
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${detail}`);
  }
  return res.status === 204 ? ((undefined as unknown) as T) : ((await res.json()) as T);
}

// --- Types ---------------------------------------------------------

type Status = "completed" | "live" | "scheduled";

type DisplayRow = {
  game: Game;
  homeName: string;
  awayName: string;
  tournamentName: string;
};

// --- Component ----------------------------------------------------

export default function GamesPage() {
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [query, setQuery] = useState("");

  // New-game inline form state — kept local; replaced by a full page when
  // the create flow lands elsewhere.
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Auth check: only scorekeepers/admins should see create / scoring.
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        setIsAuthed(Boolean(data.session));
      } catch {
        setIsAuthed(false);
      }

      const tournaments = await api<Tournament[]>("/api/tournaments").catch(
        () => [] as Tournament[],
      );

      // Fetch teams per tournament to resolve team ids → names.
      const teamLists = await mapWithConcurrency(tournaments, 4, (t) =>
        api<Team[]>(`/api/teams?tournament_id=${t.id}`).catch(() => [] as Team[]),
      );
      const teamNames = new Map<number, string>();
      for (const list of teamLists) {
        for (const team of list) teamNames.set(team.id, team.name);
      }

      const lists = await mapWithConcurrency(tournaments, 4, (t) =>
        api<Game[]>(`/api/games?tournament_id=${t.id}`).catch(() => []),
      );
      const flat: DisplayRow[] = lists.flat().map((g) => ({
        game: g,
        homeName: teamNames.get(g.home_team_id) ?? `#${g.home_team_id}`,
        awayName: teamNames.get(g.away_team_id) ?? `#${g.away_team_id}`,
        tournamentName:
          tournaments.find((t) => t.id === g.tournament_id)?.name ?? "—",
      }));
      setRows(flat);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load games");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const at = a.game.start_time ? Date.parse(a.game.start_time) : 0;
        const bt = b.game.start_time ? Date.parse(b.game.start_time) : 0;
        return bt - at;
      }),
    [rows],
  );

  const statusOf = (g: Game): Status =>
    g.is_completed
      ? "completed"
      : g.home_score > 0 || g.away_score > 0
        ? "live"
        : "scheduled";

  return (
    <AppShell footerText="built for Ultimate.">
    <section
      className="ps-container"
      style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h1 style={{ margin: 0 }}>Games</h1>
        {isAuthed ? (
          <button
            type="button"
            className="ps-btn ps-btn--primary"
            onClick={() => setShowNew((v) => !v)}
          >
            {showNew ? "Cancel" : "New game"}
          </button>
        ) : null}
      </header>

      {showNew && isAuthed ? (
        <div className="ps-card" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0, color: "var(--ps-text-muted)" }}>
            Schedule a new game from a tournament hub. The bulk create form
            will live here once the backend endpoint ships.
          </p>
          <Link
            href="/admin/games"
            className="ps-btn ps-btn--primary"
            style={{ marginTop: 12 }}
          >
            Open admin scheduler
          </Link>
        </div>
      ) : null}

      {error ? (
        <div
          className="ps-card"
          role="alert"
          style={{ borderColor: "var(--ps-danger)", marginBottom: 12 }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p>Loading games…</p>
      ) : sorted.length === 0 ? (
        <div className="ps-card">
          <p>No games scheduled yet.</p>
        </div>
      ) : (
        <>
        <ListSearch
          query={query}
          onQueryChange={setQuery}
          placeholder="Search games by team or tournament"
          countLabel={`${sorted.filter((r) => matchesQuery(query, [r.homeName, r.awayName, r.tournamentName])).length} of ${sorted.length}`}
        />
        {sorted.filter((r) => matchesQuery(query, [r.homeName, r.awayName, r.tournamentName])).length === 0 ? (
          <div className="ps-card" role="status">
            <p style={{ margin: 0 }}>No games match "{query}".</p>
          </div>
        ) : (
        <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="ps-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Matchup</th>
                <th style={{ textAlign: "center" }}>Score</th>
                <th>Tournament</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.filter((r) => matchesQuery(query, [r.homeName, r.awayName, r.tournamentName])).map(({ game, homeName, awayName, tournamentName }) => {
                const status = statusOf(game);
                return (
                  <tr key={game.id}>
                    <td>{formatDate(game.start_time)}</td>
                    <td style={{ fontWeight: 600 }}>
                      <Link
                        href={`/games/${game.id}`}
                        style={{ color: "var(--ps-text)", textDecoration: "none" }}
                      >
                        {homeName} vs {awayName}
                      </Link>
                    </td>
                    <td
                      className="ps-table__num"
                      style={{ textAlign: "center", fontWeight: 700 }}
                    >
                      {game.home_score}–{game.away_score}
                    </td>
                    <td>{tournamentName}</td>
                    <td>
                      <span
                        className="ps-pill"
                        data-status={status}
                        style={{
                          background:
                            status === "live"
                              ? "rgba(244, 67, 54, 0.15)"
                              : status === "completed"
                                ? "var(--ps-surface-container-high)"
                                : "rgba(76, 175, 80, 0.15)",
                          color:
                            status === "live"
                              ? "#F44336"
                              : status === "completed"
                                ? "var(--ps-text-muted)"
                                : "#2E7D32",
                        }}
                      >
                        {status === "live" ? "● " : ""}
                        {status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link
                        href={`/games/${game.id}`}
                        className="ps-btn ps-btn--ghost"
                        style={{ fontSize: 12, padding: "4px 10px", marginRight: 6 }}
                      >
                        View
                      </Link>
                      {isAuthed ? (
                        <Link
                          href={`/admin/games/${game.id}/score`}
                          className="ps-btn ps-btn--secondary"
                          style={{ fontSize: 12, padding: "4px 10px" }}
                        >
                          Enter result
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
        </>
      )}
    </section>
    </AppShell>
  );
}
