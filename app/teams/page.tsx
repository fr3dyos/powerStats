"use client";

// Public teams index. The backend FastAPI `Team` shape does not include
// per-row stat fields (wins/losses/power score), so the per-team stats
// columns fall back to `0` until a richer endpoint is added. CRUD hits
// the same `/teams` resource used elsewhere via the `/api/teams/*` proxy.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { teamColor, type Team } from "@/utils/api-shared";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Inline create form state — kept local; no global form library needed
  // for a placeholder that will be replaced by a server action later.
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLeague, setNewLeague] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // `listAll` is not implemented yet; fall back to fetching each
      // tournament's teams until the bulk endpoint ships.
      const tournaments = await api<Array<{ id: number }>>(
        "/api/tournaments",
      );
      const lists = await Promise.all(
        tournaments.map((t) =>
          api<Team[]>(`/api/teams?tournament_id=${t.id}`).catch(() => []),
        ),
      );
      const flat = lists.flat().map<TeamWithStats>((t) => ({
        ...t,
        league: null,
        wins: 0,
        losses: 0,
        power_score: 0,
      }));
      setTeams(flat);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createTeam = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!newName.trim()) return;
      try {
        const created = await api<Team>("/api/teams", {
          method: "POST",
          body: JSON.stringify({
            name: newName.trim(),
            tournament_id: 1, // placeholder: until the form gets a picker
          }),
        });
        setTeams((prev) => [
          { ...created, wins: 0, losses: 0, power_score: 0 },
          ...prev,
        ]);
        setNewName("");
        setNewLeague("");
        setShowNew(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Create failed");
      }
    },
    [newName, newLeague],
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
    <main
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
          <input
            type="text"
            className="ps-input"
            placeholder="League (optional)"
            value={newLeague}
            onChange={(e) => setNewLeague(e.target.value)}
            style={{ flex: "1 1 160px" }}
          />
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
    </main>
  );
}