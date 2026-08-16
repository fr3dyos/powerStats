"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  type Game,
  type GameEvent,
  type Player,
  type Team,
} from "@/utils/api-shared";

type Props = {
  initialGame: Game;
  homeTeam: Team;
  awayTeam: Team;
  homePlayers: Player[];
  awayPlayers: Player[];
  initialEvents: GameEvent[];
  /** True when the current user is allowed to mutate the game. */
  canEdit: boolean;
  /** i18n labels threaded from server component */
  labels: {
    undoLastEvent: string;
    endTimeout: string;
    advanceHalf: string;
    endGame: string;
    endGameScoreCap: string;
  };
};

/** Live scoring console — interactive client wrapper around the read-only
 *  state loaded by the server component. Records goal/assist/defense events,
 *  starts/end timeouts, advances halves, and ends the game via the FastAPI
 *  backend. */
export function LiveScoringConsole({
  initialGame,
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
  initialEvents,
  canEdit,
  labels,
}: Props) {
  const [game, setGame] = useState<Game>(initialGame);
  const [events, setEvents] = useState<GameEvent[]>(initialEvents);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEventId, setLastEventId] = useState<number | null>(
    initialEvents[initialEvents.length - 1]?.id ?? null,
  );
  // Game-clock ticker: `clockNow` re-renders the console once per second
  // while the clock is running so the elapsed display stays live.
  const [clockNow, setClockNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!game.clock_running) return;
    const id = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [game.clock_running]);

  /** Effective clock elapsed seconds: accumulated + running segment. */
  const clockElapsedNow = useMemo(() => {
    const base = game.clock_elapsed ?? 0;
    if (game.clock_running && game.clock_started_at) {
      const started = new Date(game.clock_started_at).getTime();
      return base + Math.max(0, Math.floor((clockNow - started) / 1000));
    }
    return base;
  }, [game.clock_elapsed, game.clock_running, game.clock_started_at, clockNow]);

  const period = useMemo(() => {
    const lastHalf = [...events]
      .reverse()
      .find((e) => e.event_type === "half");
    return lastHalf?.period ?? 1;
  }, [events]);

  const homeTeamEvents = useMemo(
    () => events.filter((e) => homePlayers.some((p) => p.id === e.player_id)),
    [events, homePlayers],
  );
  const awayTeamEvents = useMemo(
    () => events.filter((e) => awayPlayers.some((p) => p.id === e.player_id)),
    [events, awayPlayers],
  );

  const homeGoals = homeTeamEvents.filter((e) => e.event_type === "goal").length;
  const awayGoals = awayTeamEvents.filter((e) => e.event_type === "goal").length;
  const homeAssists = homeTeamEvents.filter((e) => e.event_type === "assist").length;
  const awayAssists = awayTeamEvents.filter((e) => e.event_type === "assist").length;
  const homeDs = homeTeamEvents.filter((e) => e.event_type === "defense").length;
  const awayDs = awayTeamEvents.filter((e) => e.event_type === "defense").length;

  // Backend should already be returning home_score/away_score; sync them
  // defensively in case the optimistic update drifts from the server.
  useEffect(() => {
    if (game.home_score !== homeGoals || game.away_score !== awayGoals) {
      setGame((g) => ({ ...g, home_score: homeGoals, away_score: awayGoals }));
    }
  }, [homeGoals, awayGoals, game.home_score, game.away_score]);

  const record = useCallback(
    async (
      playerId: number,
      type: "goal" | "assist" | "defense",
      points = 1,
    ) => {
      if (!canEdit || game.is_completed) return;
      setBusy(true);
      setError(null);
      try {
        const ev = await fetch(`/api/admin/games/${game.id}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player_id: playerId,
            event_type: type,
            points,
            period,
            time_elapsed: clockElapsedNow,
          }),
        });
        if (!ev.ok) {
          const detail = await ev.json().catch(() => ({ detail: ev.statusText }));
          throw new Error(detail.detail ?? `Request failed (${ev.status})`);
        }
        const created: GameEvent = await ev.json();
        setEvents((cur) => [...cur, created]);
        setLastEventId(created.id);
        // Refresh the full game so server-computed scores stick.
        const refreshed = await fetch(`/api/admin/games/${game.id}`);
        if (refreshed.ok) {
          const g = await refreshed.json();
          setGame(g);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [canEdit, game.id, game.is_completed, period, clockElapsedNow],
  );

  const undoLastEvent = useCallback(async () => {
    if (!canEdit || game.is_completed) return;
    if (events.length === 0) return;
    // Snapshot the previous event list so we can restore on failure.
    const previousEvents = events;
    const previousLastId = lastEventId;
    // Optimistic UI: drop the last event from view immediately, then ask the
    // backend to confirm. The server is the source of truth — on failure we
    // restore the snapshot, on success we sync the refreshed game state.
    setEvents((cur) => cur.slice(0, -1));
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/games/${game.id}/events/undo`,
        { method: "POST" },
      );
      if (!res.ok) {
        const detail = await res
          .json()
          .catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Request failed (${res.status})`);
      }
      const refreshed = await fetch(`/api/admin/games/${game.id}`);
      if (refreshed.ok) {
        const g = await refreshed.json();
        setGame(g);
      }
      // Re-anchor lastEventId to the now-newest remaining event. We compute
      // it from the previousEvents snapshot (which had one fewer entry after
      // the optimistic drop above) — a sync read here is safe because the
      // state has already settled by the time we run after the network call.
      setLastEventId(previousEvents[previousEvents.length - 2]?.id ?? null);
    } catch (err) {
      // Roll back optimistic update.
      setEvents(previousEvents);
      setLastEventId(previousLastId);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [canEdit, events, game.id, game.is_completed, lastEventId]);

  const startTimeout = useCallback(
    async (which: "home" | "away") => {
      if (!canEdit || game.is_completed) return;
      setBusy(true);
      setError(null);
      try {
        const ev = await fetch(
          `/api/admin/games/${game.id}/timeout?team=${which}&timeout_number=1&period=${period}`,
          { method: "POST" },
        );
        if (!ev.ok) {
          const detail = await ev.json().catch(() => ({ detail: ev.statusText }));
          throw new Error(detail.detail ?? `Request failed (${ev.status})`);
        }
        const created: GameEvent = await ev.json();
        setEvents((cur) => [...cur, created]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [canEdit, game.id, game.is_completed, period],
  );

  const endTimeout = useCallback(async () => {
    if (!canEdit || game.is_completed) return;
    setBusy(true);
    setError(null);
    try {
      const ev = await fetch(`/api/admin/games/${game.id}/end-timeout`, {
        method: "POST",
      });
      if (!ev.ok) {
        const detail = await ev.json().catch(() => ({ detail: ev.statusText }));
        throw new Error(detail.detail ?? `Request failed (${ev.status})`);
      }
      const created: GameEvent = await ev.json();
      setEvents((cur) => [...cur, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [canEdit, game.id, game.is_completed]);

  const advanceHalf = useCallback(async () => {
    if (!canEdit || game.is_completed) return;
    setBusy(true);
    setError(null);
    try {
      const ev = await fetch(`/api/admin/games/${game.id}/advance-half`, {
        method: "POST",
      });
      if (!ev.ok) {
        const detail = await ev.json().catch(() => ({ detail: ev.statusText }));
        throw new Error(detail.detail ?? `Request failed (${ev.status})`);
      }
      const created: GameEvent = await ev.json();
      setEvents((cur) => [...cur, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [canEdit, game.id, game.is_completed]);

  const endGame = useCallback(async () => {
    if (!canEdit || game.is_completed) return;
    setBusy(true);
    setError(null);
    try {
      const ev = await fetch(`/api/admin/games/${game.id}/end`, {
        method: "POST",
      });
      if (!ev.ok) {
        const detail = await ev.json().catch(() => ({ detail: ev.statusText }));
        throw new Error(detail.detail ?? `Request failed (${ev.status})`);
      }
      const updated: Game = await ev.json();
      setGame(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [canEdit, game.id, game.is_completed]);

  /** Generic partial-update of the game via the admin proxy. */
  const patchGame = useCallback(
    async (patch: Partial<Game>) => {
      if (!canEdit || game.is_completed) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/games/${game.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const detail = await res
            .json()
            .catch(() => ({ detail: res.statusText }));
          throw new Error(detail.detail ?? `Request failed (${res.status})`);
        }
        const updated: Game = await res.json();
        setGame(updated);
        setClockNow(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [canEdit, game.id, game.is_completed],
  );

  const toggleLive = useCallback(() => {
    void patchGame({ is_live: !game.is_live });
  }, [patchGame, game.is_live]);

  const startClock = useCallback(() => {
    if (game.clock_running) return;
    void patchGame({
      clock_running: true,
      clock_started_at: new Date().toISOString(),
    });
  }, [patchGame, game.clock_running]);

  const pauseClock = useCallback(() => {
    if (!game.clock_running) return;
    const base = game.clock_elapsed ?? 0;
    const started = game.clock_started_at
      ? new Date(game.clock_started_at).getTime()
      : 0;
    const total =
      base + (started ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : 0);
    void patchGame({
      clock_running: false,
      clock_started_at: null,
      clock_elapsed: total,
    });
  }, [patchGame, game.clock_running, game.clock_elapsed, game.clock_started_at]);

  const resetClock = useCallback(() => {
    void patchGame({
      clock_running: false,
      clock_started_at: null,
      clock_elapsed: 0,
    });
  }, [patchGame]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        className="ps-card"
        style={{
          padding: "14px 18px",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {game.is_completed ? (
            <span className="ps-status-badge ps-status-badge--completed">
              Game ended
            </span>
          ) : game.is_live ? (
            <span className="ps-live-pill">● Live</span>
          ) : (
            <span className="ps-pill">Not live</span>
          )}
          <span className="ps-pill">Half {period}</span>
          {canEdit && !game.is_completed ? (
            <button
              type="button"
              className={`ps-btn ${
                game.is_live ? "ps-btn--ghost" : "ps-btn--primary"
              }`}
              onClick={toggleLive}
              disabled={busy}
            >
              {game.is_live ? "Stop live" : "Go live"}
            </button>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            title="Game clock"
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              color: game.clock_running
                ? "var(--ps-primary)"
                : "var(--ps-text)",
              minWidth: 84,
              textAlign: "center",
            }}
          >
            {formatClock(clockElapsedNow)}
          </span>
          {canEdit && !game.is_completed ? (
            <>
              {game.clock_running ? (
                <button
                  type="button"
                  className="ps-btn ps-btn--ghost"
                  onClick={pauseClock}
                  disabled={busy}
                >
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  className="ps-btn ps-btn--primary"
                  onClick={startClock}
                  disabled={busy}
                >
                  Start
                </button>
              )}
              <button
                type="button"
                className="ps-btn ps-btn--ghost"
                onClick={resetClock}
                disabled={busy || (clockElapsedNow === 0 && !game.clock_running)}
              >
                Reset
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div
        className="ps-card"
        style={{
          padding: 0,
          overflow: "hidden",
          border: "1px solid var(--ps-border)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "stretch",
            background: "var(--ps-surface)",
          }}
        >
          <TeamColumn
            team={homeTeam}
            score={game.home_score}
            assists={homeAssists}
            defenses={homeDs}
            isHome
            canEdit={canEdit && !game.is_completed}
            busy={busy}
            players={homePlayers}
            onAction={(playerId, type) => record(playerId, type)}
            onTimeout={() => startTimeout("home")}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 28px",
              borderLeft: "1px solid var(--ps-border)",
              borderRight: "1px solid var(--ps-border)",
              background: "var(--ps-surface-container)",
              minWidth: 140,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "var(--ps-text-muted)",
                textTransform: "uppercase",
              }}
            >
              Score
            </span>
            <span
              style={{
                fontFamily: "Montserrat, Inter, sans-serif",
                fontWeight: 800,
                fontSize: 56,
                lineHeight: 1,
                margin: "8px 0",
                color: "var(--ps-text)",
              }}
            >
              {game.home_score} – {game.away_score}
            </span>
            <span
              className="ps-pill"
              style={{ fontSize: 11 }}
            >
              {game.game_rule === "time_limit"
                ? `${game.time_limit ?? "?"} min cap`
                : `${game.score_limit ?? "?"} pt cap`}
            </span>
          </div>
          <TeamColumn
            team={awayTeam}
            score={game.away_score}
            assists={awayAssists}
            defenses={awayDs}
            isHome={false}
            canEdit={canEdit && !game.is_completed}
            busy={busy}
            players={awayPlayers}
            onAction={(playerId, type) => record(playerId, type)}
            onTimeout={() => startTimeout("away")}
          />
        </div>
      </div>

      {error ? (
        <div
          className="ps-card"
          style={{
            borderLeft: "3px solid var(--ps-danger)",
            color: "var(--ps-text)",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      <div
        className="ps-card"
        style={{
          padding: 16,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            className="ps-btn ps-btn--ghost"
            onClick={() => undoLastEvent()}
            disabled={
              !canEdit ||
              game.is_completed ||
              busy ||
              events.length === 0
            }
          >
            {labels.undoLastEvent}
          </button>
          <button
            type="button"
            className="ps-btn ps-btn--ghost"
            onClick={() => endTimeout()}
            disabled={!canEdit || game.is_completed || busy}
          >
            {labels.endTimeout}
          </button>
          <button
            type="button"
            className="ps-btn ps-btn--ghost"
            onClick={() => advanceHalf()}
            disabled={
              !canEdit || game.is_completed || busy || period >= 2
            }
          >
            {labels.advanceHalf}
          </button>
        </div>
        <button
          type="button"
          className="ps-btn ps-btn--primary"
          onClick={() => endGame()}
          disabled={!canEdit || game.is_completed || busy}
        >
          {game.game_rule === "score_limit" ? labels.endGameScoreCap : labels.endGame}
        </button>
      </div>

      <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--ps-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: 18 }}>Play-by-play</h2>
          <span className="ps-pill">{events.length} events</span>
        </header>
        {events.length === 0 ? (
          <p
            style={{
              color: "var(--ps-text-muted)",
              padding: 16,
              fontSize: 13,
            }}
          >
            No events yet — record the first goal above.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {[...events].reverse().map((ev) => {
              const player =
                homePlayers.find((p) => p.id === ev.player_id) ??
                awayPlayers.find((p) => p.id === ev.player_id);
              const isHome = homePlayers.some((p) => p.id === ev.player_id);
              return (
                <li
                  key={ev.id}
                  style={{
                    padding: "10px 20px",
                    borderBottom: "1px solid var(--ps-border)",
                    display: "grid",
                    gridTemplateColumns: "100px 1fr auto",
                    gap: 12,
                    alignItems: "center",
                    background:
                      ev.id === lastEventId
                        ? "rgba(204,255,0,0.05)"
                        : "transparent",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      color: "var(--ps-text-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    H{ev.period ?? period}
                  </span>
                  <span>
                    <strong>{ev.event_type.toUpperCase()}</strong> ·{" "}
                    {player ? (
                      <Link href={`/players/${player.id}`}>
                        {player.first_name} {player.last_name}
                      </Link>
                    ) : (
                      "Player"
                    )}{" "}
                    <span style={{ color: "var(--ps-text-muted)" }}>
                      ({isHome ? homeTeam.name : awayTeam.name})
                    </span>
                  </span>
                  <span
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 12,
                      color: "var(--ps-text-muted)",
                    }}
                  >
                    #{ev.id}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p
        style={{
          color: "var(--ps-text-muted)",
          fontSize: 12,
          marginTop: 4,
        }}
      >
        Use the Undo button to reverse the most recent event. The server is
        the source of truth — if the rollback fails, the console restores the
        previous event list and surfaces the error above.
      </p>
    </div>
  );
}

function TeamColumn({
  team,
  score,
  assists,
  defenses,
  isHome,
  canEdit,
  busy,
  players,
  onAction,
  onTimeout,
}: {
  team: Team;
  score: number;
  assists: number;
  defenses: number;
  isHome: boolean;
  canEdit: boolean;
  busy: boolean;
  players: Player[];
  onAction: (
    playerId: number,
    type: "goal" | "assist" | "defense",
  ) => void;
  onTimeout: () => void;
}) {
  return (
    <div
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          justifyContent: isHome ? "flex-start" : "flex-end",
          flexDirection: isHome ? "row" : "row-reverse",
        }}
      >
        <span
          style={{
            fontFamily: "Montserrat, Inter, sans-serif",
            fontWeight: 700,
            fontSize: 18,
          }}
        >
          {team.name}
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          textAlign: "center",
        }}
      >
        <Mini label="Goals" value={score} />
        <Mini label="Assists" value={assists} muted />
        <Mini label="Defense" value={defenses} muted />
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="ps-btn ps-btn--primary"
          onClick={onTimeout}
          disabled={!canEdit || busy}
          style={{ flex: 1 }}
        >
          Timeout
        </button>
      </div>
      <div style={{ marginTop: 4 }}>
        <h3
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ps-text-muted)",
            marginBottom: 6,
          }}
        >
          Roster quick actions
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 4,
            maxHeight: 260,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {players.length === 0 ? (
            <p
              style={{
                color: "var(--ps-text-muted)",
                fontSize: 12,
                margin: 0,
              }}
            >
              No players on this team yet.
            </p>
          ) : (
            players.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 6px",
                  borderRadius: 6,
                  background: "var(--ps-surface-container)",
                }}
              >
                <span
                  className="ps-disc ps-disc--sm"
                  style={{ background: "var(--ps-surface-container-high)" }}
                >
                  {p.jersey_number ?? "?"}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.first_name} {p.last_name}
                </span>
                <button
                  type="button"
                  className="ps-btn ps-btn--primary"
                  style={{
                    fontSize: 10,
                    padding: "4px 8px",
                  }}
                  onClick={() => onAction(p.id, "goal")}
                  disabled={!canEdit || busy}
                >
                  G
                </button>
                <button
                  type="button"
                  className="ps-btn ps-btn--ghost"
                  style={{
                    fontSize: 10,
                    padding: "4px 8px",
                  }}
                  onClick={() => onAction(p.id, "assist")}
                  disabled={!canEdit || busy}
                >
                  A
                </button>
                <button
                  type="button"
                  className="ps-btn ps-btn--ghost"
                  style={{
                    fontSize: 10,
                    padding: "4px 8px",
                  }}
                  onClick={() => onAction(p.id, "defense")}
                  disabled={!canEdit || busy}
                >
                  D
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--ps-surface-container)",
        padding: 8,
        borderRadius: 8,
        border: "1px solid var(--ps-border)",
      }}
    >
      <div
        style={{
          fontFamily: "Montserrat, Inter, sans-serif",
          fontWeight: 800,
          fontSize: 22,
          color: muted ? "var(--ps-text-muted)" : "var(--ps-text)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ps-text-muted)",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
    </div>
  );
}

/** Format a number of seconds as MM:SS for the game clock display. */
function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}