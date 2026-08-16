"use client";

import { useState } from "react";

import { type Phase } from "@/utils/api-shared";

type Props = {
  currentPhaseId: number;
  laterPhases: Phase[];
  label: string;
  choosePhaseLabel: string;
  teamsPerGroupLabel: string;
  confirmLabel: string;
  successLabel: string;
  failureLabel: string;
  advancedLabel: string;
  noTargetLabel: string;
};

/**
 * Per-round "Advance winners" control.
 *
 * Lets the admin pick the *target* phase (must have phase_order greater
 * than the current phase; we filter server-side too) and trigger
 * `/api/phases/:id/advance` for the whole round.  FastAPI recomputes
 * which teams qualify.
 */
export default function AdvanceRoundButton({
  currentPhaseId,
  laterPhases,
  label,
  choosePhaseLabel,
  teamsPerGroupLabel,
  confirmLabel,
  successLabel,
  failureLabel,
  advancedLabel,
  noTargetLabel,
}: Props) {
  const [targetId, setTargetId] = useState<string>(
    laterPhases[0] ? String(laterPhases[0].id) : "",
  );
  const [teamsPerGroup, setTeamsPerGroup] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (laterPhases.length === 0) {
    return (
      <span
        style={{
          fontSize: 11,
          color: "var(--ps-text-muted)",
        }}
      >
        {noTargetLabel}
      </span>
    );
  }

  const submit = async () => {
    if (!targetId) return;
    const tpg = teamsPerGroup ? Number(teamsPerGroup) : undefined;
    if (tpg !== undefined && (!Number.isFinite(tpg) || tpg <= 0)) {
      setMessage(failureLabel);
      return;
    }
    const ok = window.confirm(confirmLabel);
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/phases/${currentPhaseId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_phase_id: Number(targetId),
          teams_per_group: tpg,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? "Advance failed");
      }
      const result = await res.json();
      const count = result.advanced_team_ids?.length ?? 0;
      setMessage(`${successLabel} ${advancedLabel.replace("{count}", String(count))}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : failureLabel);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        fontSize: 11,
      }}
    >
      <select
        aria-label={choosePhaseLabel}
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        disabled={busy}
        style={{
          padding: "2px 6px",
          fontSize: 11,
          borderRadius: 4,
          border: "1px solid var(--ps-divider)",
          background: "var(--ps-surface-container-low)",
        }}
      >
        {laterPhases.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        max={8}
        placeholder={teamsPerGroupLabel}
        value={teamsPerGroup}
        onChange={(e) => setTeamsPerGroup(e.target.value)}
        disabled={busy}
        style={{
          width: 60,
          padding: "2px 6px",
          fontSize: 11,
          borderRadius: 4,
          border: "1px solid var(--ps-divider)",
          background: "var(--ps-surface-container-low)",
        }}
      />
      <button
        type="button"
        className="ps-btn ps-btn--ghost"
        onClick={submit}
        disabled={busy || !targetId}
        style={{ fontSize: 11, padding: "2px 8px" }}
      >
        {busy ? "…" : label}
      </button>
      {message ? (
        <span
          style={{
            color: message.startsWith(successLabel)
              ? "var(--ps-success, #1f7a3a)"
              : "var(--ps-error, #c0392b)",
            fontSize: 11,
          }}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
