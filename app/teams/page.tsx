"use client";

// Public teams index. The backend FastAPI `Team` shape does not include
// per-row stat fields (wins/losses/power score), so the per-team stats
// columns fall back to `0` until a richer endpoint is added. CRUD hits
// the same `/teams` resource used elsewhere via the `/api/teams/*` proxy.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { teamColor, type Team } from "@/utils/api-shared";
import { mapWithConcurrency } from "@/utils/async";
import { AppShell } from "@/app/_components/AppShell";

// --- Lightweight client fetch helper ---------------------------------
// Talks to the Next.js `/api/*` proxy routes. Each returns parsed JSON
// or throws — callers handle UI error state.
async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
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
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Types -----------------------------------------------------------

type TeamWithStats = Team & {
  league?: string | null;
  wins: number;
  losses: number;
  power_score: number;
};

// --- Component -------------------------------------------------------

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithStats[]>([]);
  const [tournaments, setTournaments] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Inline create form state
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTournamentId, setNewTournamentId] = useState<number>(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tourList = await api<Array<{ id: number; name: string }>>(
        "/api/tournaments",
      );
      setTournaments(tourList);

      // Fetch teams and compute stats from games
      const lists = await mapWithConcurrency(tourList, 4, (t) =>
        api<Team[]>(`/api/teams?tournament_id=${t.id}`).catch(() => []),
      );

      // Fetch games per tournament to compute stats
      const gameLists = await mapWithConcurrency(tourList, 4, (t) =>
        api<Array<{ home_team_id: number; away_team_id: number; home_score: number; away_score: number; is_completed: boolean }>>(
          `/api/games?tournament_id=${t.id}`,
        ).catch(() => []),
      );

      // Build stats map: teamId -> { wins, losses, power_score }
      const statsMap = new Map<number, { wins: number; losses: number; pf: number; pa: number }>();
      for (const games of gameLists) {
        for (const g of games) {
          if (!g.is_completed) continue;
          const h = statsMap.get(g.home_team_id) ?? { wins: 0, losses: 0, pf: 0, pa: 0 };
          const a = statsMap.get(g.away_team_id) ?? { wins: 0, losses: 0, pf: 0, pa: 0 };
          h.pf += g.home_score; h.pa += g.away_score;
          a.pf += g.away_score; a.pa += g.home_score;
          if (g.home_score > g.away_score) { h.wins++; a.losses++; }
          else if (g.away_score > g.home_score) { a.wins++; h.losses++; }
          statsMap.set(g.home_team_id, h);
          statsMap.set(g.away_team_id, a);
        }
      }

      const flat = lists.flat().map<TeamWithStats>((t) => {
        const s = statsMap.get(t.id) ?? { wins: 0, losses: 0, pf: 0, pa: 0 };
        return {
          ...t,
          league: null,
          wins: s.wins,
          losses: s.losses,
          power_score: s.wins * 2 + (s.pf - s.pa) / 10,
        };
      });
      setTeams(flat);

      // Default new team tournament to first one
      if (tourList.length > 0 && newTournamentId === 0) {
        setNewTournamentId(tourList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, [newTournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createTeam = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!newName.trim() || !newTournamentId) return;
      try {
        const created = await api<Team>("/api/teams", {
          method: "POST",
          body: JSON.stringify({
            name: newName.trim(),
            tournament_id: newTournamentId,
          }),
        });
        setTeams((prev) => [
          { ...created, league: null, wins: 0, losses: 0, power_score: 0 },
          ...prev,
        ]);
        setNewName("");
        setShowNew(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Create failed");
      }
    },
    [newName, newTournamentId],
  );

  const deleteTeam = useCallback(async (id: number) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this team?")) {
      return;
    }
    setBusyId(id);
    // Optimistic remove; rollback if the delete fails so the UI stays in
    // sync with the server.
    const previous = teams;
    setTeams((prev) => prev.filter((t) => t.id !== id));
    try {
      await api<void>(`/api/teams/${id}`, { method: "DELETE" });
    } catch (err) {
      setTeams(previous);
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }, [teams]);

  const sorted = useMemo(
    () => [...teams].sort((a, b) => b.power_score - a.power_score),
    [teams],
  );

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
        <h1 style={{ margin: 0 }}>Teams</h1>
        <button
          type="button"
          className="ps-btn ps-btn--primary"
          onClick={() => setShowNew((v) => !v)}
        >
          {showNew ? "Cancel" : "New team"}
        </button>
      </header>

      {showNew ? (
        <form
          onSubmit={createTeam}
          className="ps-card"
          style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input
            type="text"
            className="ps-input"
            placeholder="Team name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            style={{ flex: "1 1 200px" }}
          />
          <select
            className="ps-input"
            value={newTournamentId}
            onChange={(e) => setNewTournamentId(Number(e.target.value))}
            required
            style={{ flex: "1 1 180px" }}
          >
            <option value={0} disabled>Select tournament…</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button type="submit" className="ps-btn ps-btn--primary">
            Create
          </button>
        </form>
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
        <p>Loading teams…</p>
      ) : sorted.length === 0 ? (
        <div className="ps-card">
          <p>No teams yet. Create one above to get started.</p>
        </div>
      ) : (
        <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="ps-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>League</th>
                <th style={{ textAlign: "right" }}>W</th>
                <th style={{ textAlign: "right" }}>L</th>
                <th style={{ textAlign: "right" }}>Power score</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const accent = teamColor(t.name);
                const isBusy = busyId === t.id;
                return (
                  <tr key={t.id}>
                    <td>
                      <Link
                        href={`/teams/${t.id}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          color: "var(--ps-text)",
                          textDecoration: "none",
                          fontWeight: 600,
                        }}
                      >
                        <span
                          className="ps-disc ps-disc--sm"
                          style={{
                            background: accent ?? undefined,
                            color: "#fff",
                            borderColor: accent ?? undefined,
                          }}
                        >
                          {t.name.slice(0, 2).toUpperCase()}
                        </span>
                        {t.name}
                      </Link>
                    </td>
                    <td>{t.league ?? "—"}</td>
                    <td className="ps-table__num" style={{ textAlign: "right" }}>
                      {t.wins}
                    </td>
                    <td className="ps-table__num" style={{ textAlign: "right" }}>
                      {t.losses}
                    </td>
                    <td
                      className="ps-table__num"
                      style={{ textAlign: "right", fontWeight: 700 }}
                    >
                      {t.power_score.toFixed(1)}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link
                        href={`/admin/teams/${t.id}/edit`}
                        className="ps-btn ps-btn--ghost"
                        style={{ fontSize: 12, padding: "4px 10px", marginRight: 6 }}
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="ps-btn ps-btn--ghost"
                        onClick={() => deleteTeam(t.id)}
                        disabled={isBusy}
                        style={{ fontSize: 12, padding: "4px 10px" }}
                      >
                        {isBusy ? "…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
    </AppShell>
  );
}