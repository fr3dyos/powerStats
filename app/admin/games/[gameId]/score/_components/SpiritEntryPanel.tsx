"use client";

import { useState } from "react";

type Props = {
  gameId: number;
  homeName: string;
  awayName: string;
  initialHome: number | null;
  initialAway: number | null;
  canEdit: boolean;
};

type Report = {
  game_id: number;
  spirit_home: number | null;
  spirit_away: number | null;
};

/**
 * Per-game spirit (SOTG) entry panel. Each side records a single 0–10 score
 * representing the WFDF 5-category total. The standings engine averages
 * these into ``spirit_average``. Both fields are optional in the PUT body
 * so the scorekeeper can fill them in independently.
 */
export default function SpiritEntryPanel({
  gameId,
  homeName,
  awayName,
  initialHome,
  initialAway,
  canEdit,
}: Props) {
  const [home, setHome] = useState<string>(
    initialHome === null ? "" : String(initialHome),
  );
  const [away, setAway] = useState<string>(
    initialAway === null ? "" : String(initialAway),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (side: "home" | "away") => {
    const raw = side === "home" ? home : away;
    const trimmed = raw.trim();
    if (trimmed === "") {
      setMessage("Both sides cleared.");
      const res = await fetch(`/api/admin/games/${gameId}/spirit`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          side === "home" ? { spirit_home: null } : { spirit_away: null },
        ),
      });
      if (!res.ok) {
        setMessage("Spirit clear failed.");
      }
      return;
    }
    const v = Number(trimmed);
    if (!Number.isFinite(v) || v < 0 || v > 10) {
      setMessage("Spirit must be 0–10.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const body =
        side === "home" ? { spirit_home: v } : { spirit_away: v };
      const res = await fetch(`/api/admin/games/${gameId}/spirit`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: Report = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(
          (data as { detail?: string }).detail ?? "Spirit save failed.",
        );
        return;
      }
      if (side === "home") setHome(String(data.spirit_home ?? ""));
      else setAway(String(data.spirit_away ?? ""));
      setMessage("Spirit saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Spirit save failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 24,
        padding: 16,
        border: "1px solid var(--ps-divider)",
        borderRadius: 8,
        background: "var(--ps-surface-container)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: ".05em",
          textTransform: "uppercase",
          color: "var(--ps-text-muted)",
          marginBottom: 8,
        }}
      >
        Spirit of the Game (SOTG)
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          alignItems: "end",
        }}
      >
        <label style={{ display: "block" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--ps-text-muted)",
              display: "block",
              marginBottom: 4,
            }}
          >
            {homeName}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="number"
              min={0}
              max={10}
              step="0.5"
              value={home}
              onChange={(e) => setHome(e.target.value)}
              disabled={!canEdit || busy}
              style={{
                flex: 1,
                padding: 6,
                fontSize: 13,
                border: "1px solid var(--ps-divider)",
                borderRadius: 4,
                background: "var(--ps-surface-container-low)",
              }}
            />
            <button
              type="button"
              className="ps-btn ps-btn--ghost"
              onClick={() => submit("home")}
              disabled={!canEdit || busy}
              style={{ fontSize: 11, padding: "4px 10px" }}
            >
              Save
            </button>
          </div>
        </label>
        <label style={{ display: "block" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--ps-text-muted)",
              display: "block",
              marginBottom: 4,
            }}
          >
            {awayName}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="number"
              min={0}
              max={10}
              step="0.5"
              value={away}
              onChange={(e) => setAway(e.target.value)}
              disabled={!canEdit || busy}
              style={{
                flex: 1,
                padding: 6,
                fontSize: 13,
                border: "1px solid var(--ps-divider)",
                borderRadius: 4,
                background: "var(--ps-surface-container-low)",
              }}
            />
            <button
              type="button"
              className="ps-btn ps-btn--ghost"
              onClick={() => submit("away")}
              disabled={!canEdit || busy}
              style={{ fontSize: 11, padding: "4px 10px" }}
            >
              Save
            </button>
          </div>
        </label>
      </div>
      <p
        style={{
          fontSize: 11,
          color: "var(--ps-text-muted)",
          marginTop: 8,
        }}
      >
        Each side receives 0–10 (WFDF 5-category total). Leave blank to clear.
      </p>
      {message ? (
        <p style={{ fontSize: 12, marginTop: 8, color: "var(--ps-text-muted)" }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
