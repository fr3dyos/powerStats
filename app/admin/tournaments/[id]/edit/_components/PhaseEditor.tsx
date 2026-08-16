"use client";

import { useState } from "react";
import Link from "next/link";

import { type Phase } from "@/utils/api-shared";

type Props = {
  phase: Phase;
  tournamentId: number;
  canEdit: boolean;
  onChange: (next: Phase) => void;
  onDelete: (phaseId: number) => void;
  labels: {
    name: string;
    phaseType: string;
    phaseStatus: string;
    phaseRoundRobin: string;
    phaseBracket: string;
    phasePending: string;
    phaseInProgress: string;
    phaseCompleted: string;
    generateRoundRobin: string;
    generateBracket: string;
    viewStandings: string;
    edit: string;
    save: string;
    cancel: string;
    delete: string;
    deleteConfirm: string;
    suggestSchedule: string;
    suggestScheduleFailed: string;
    suggestScheduleSuccess: string;
    advancedTeamsPerGroup: string;
    groupCount: string;
    advancingTeams: string;
    tiebreakers: string;
  };
};

const TIEBREAKERS = [
  { value: "head_to_head", label: "Head-to-head" },
  { value: "point_diff", label: "Point differential" },
  { value: "points_for", label: "Points for" },
  { value: "points_against", label: "Points against" },
];

/**
 * Per-phase editor: name + type + status + tiebreakers/group_count/
 * advancing_teams JSON config + delete + suggest-schedule button.
 * Optimistic update with revert on failure.
 */
export default function PhaseEditor({
  phase,
  tournamentId,
  canEdit,
  onChange,
  onDelete,
  labels,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable state mirrors the FastAPI Phase shape.
  const [draft, setDraft] = useState({
    name: phase.name,
    phase_type: phase.phase_type,
    status: phase.status,
    status_mode: phase.status_mode ?? "auto",
    config: {
      group_count: phase.config?.group_count ?? 2,
      advancing_teams: phase.config?.advancing_teams ?? 2,
      tiebreakers: phase.config?.tiebreakers ?? ["head_to_head", "point_diff"],
    },
  });

  const startEdit = () => {
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
    // Reset draft from canonical phase.
    setDraft({
      name: phase.name,
      phase_type: phase.phase_type,
      status: phase.status,
      status_mode: phase.status_mode ?? "auto",
      config: {
        group_count: phase.config?.group_count ?? 2,
        advancing_teams: phase.config?.advancing_teams ?? 2,
        tiebreakers: phase.config?.tiebreakers ?? [
          "head_to_head",
          "point_diff",
        ],
      },
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/phases/${phase.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? "Update failed");
      }
      const updated = await res.json();
      onChange(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (deleting) return;
    const ok = window.confirm(labels.deleteConfirm);
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/phases/${phase.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? "Delete failed");
      }
      onDelete(phase.id);
    } catch (err) {
      setDeleting(false);
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const generateFixtures = async (type: "round-robin" | "bracket") => {
    if (busy) return;
    setBusy(type);
    setError(null);
    try {
      const endpoint =
        type === "round-robin"
          ? `/api/phases/${phase.id}/round-robin`
          : `/api/phases/${phase.id}/bracket`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persist: true }),
      });
      if (!res.ok) throw new Error(`Failed to generate ${type}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to generate ${type}`);
    } finally {
      setBusy(null);
    }
  };

  const suggestSchedule = async () => {
    if (busy) return;
    setBusy("schedule");
    setError(null);
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/schedule-suggestion`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed");
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : labels.suggestScheduleFailed,
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      style={{
        padding: 16,
        border: "1px solid var(--ps-border)",
        borderRadius: 8,
        background: "var(--ps-surface-container-low)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        {editing ? (
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            disabled={!canEdit || saving}
            className="ps-input"
            style={{ flex: 1, marginRight: 12 }}
          />
        ) : (
          <h3 style={{ margin: 0, fontSize: 16 }}>{phase.name}</h3>
        )}
        <span className="ps-pill">
          {phase.phase_type === "round_robin"
            ? labels.phaseRoundRobin
            : labels.phaseBracket}
        </span>
      </div>

      {editing ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginTop: 8,
          }}
        >
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
              {labels.phaseType}
            </label>
            <select
              value={draft.phase_type}
              onChange={(e) =>
                setDraft({ ...draft, phase_type: e.target.value })
              }
              disabled={saving}
              className="ps-input"
            >
              <option value="round_robin">{labels.phaseRoundRobin}</option>
              <option value="bracket">{labels.phaseBracket}</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
              {labels.phaseStatus}
            </label>
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              disabled={saving}
              className="ps-input"
            >
              <option value="pending">{labels.phasePending}</option>
              <option value="in_progress">{labels.phaseInProgress}</option>
              <option value="completed">{labels.phaseCompleted}</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
              {labels.groupCount}
            </label>
            <input
              type="number"
              min={1}
              max={32}
              value={draft.config.group_count}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  config: {
                    ...draft.config,
                    group_count: Number(e.target.value),
                  },
                })
              }
              disabled={saving}
              className="ps-input"
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
              {labels.advancingTeams}
            </label>
            <input
              type="number"
              min={1}
              max={16}
              value={draft.config.advancing_teams}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  config: {
                    ...draft.config,
                    advancing_teams: Number(e.target.value),
                  },
                })
              }
              disabled={saving}
              className="ps-input"
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
              {labels.tiebreakers}
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TIEBREAKERS.map((tb) => {
                const checked =
                  draft.config.tiebreakers?.includes(tb.value) ?? false;
                return (
                  <label
                    key={tb.value}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const set = new Set(draft.config.tiebreakers ?? []);
                        if (e.target.checked) set.add(tb.value);
                        else set.delete(tb.value);
                        setDraft({
                          ...draft,
                          config: {
                            ...draft.config,
                            tiebreakers: Array.from(set),
                          },
                        });
                      }}
                      disabled={saving}
                    />
                    {tb.label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            color: "var(--ps-text-muted)",
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          {labels.phaseStatus}: <strong>{phase.status}</strong>
          {phase.config?.group_count ? (
            <>
              {" · "}
              {labels.groupCount}: <strong>{phase.config.group_count}</strong>
            </>
          ) : null}
          {phase.config?.advancing_teams ? (
            <>
              {" · "}
              {labels.advancingTeams}:{" "}
              <strong>{phase.config.advancing_teams}</strong>
            </>
          ) : null}
        </div>
      )}

      {error ? (
        <div
          role="alert"
          style={{
            marginTop: 8,
            color: "var(--ps-error, #c0392b)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 12,
        }}
      >
        {editing ? (
          <>
            <button
              type="button"
              className="ps-btn ps-btn--primary"
              onClick={save}
              disabled={saving}
              style={{ fontSize: 12 }}
            >
              {saving ? "…" : labels.save}
            </button>
            <button
              type="button"
              className="ps-btn ps-btn--ghost"
              onClick={cancelEdit}
              disabled={saving}
              style={{ fontSize: 12 }}
            >
              {labels.cancel}
            </button>
          </>
        ) : (
          canEdit && (
            <button
              type="button"
              className="ps-btn ps-btn--ghost"
              onClick={startEdit}
              style={{ fontSize: 12 }}
            >
              {labels.edit}
            </button>
          )
        )}
        {phase.phase_type === "round_robin" && canEdit && !editing && (
          <button
            type="button"
            className="ps-btn ps-btn--ghost"
            onClick={() => generateFixtures("round-robin")}
            disabled={busy !== null}
            style={{ fontSize: 12 }}
          >
            {busy === "round-robin" ? "…" : labels.generateRoundRobin}
          </button>
        )}
        {phase.phase_type === "bracket" && canEdit && !editing && (
          <button
            type="button"
            className="ps-btn ps-btn--ghost"
            onClick={() => generateFixtures("bracket")}
            disabled={busy !== null}
            style={{ fontSize: 12 }}
          >
            {busy === "bracket" ? "…" : labels.generateBracket}
          </button>
        )}
        {canEdit && !editing && (
          <button
            type="button"
            className="ps-btn ps-btn--ghost"
            onClick={suggestSchedule}
            disabled={busy !== null}
            style={{ fontSize: 12 }}
          >
            {busy === "schedule" ? "…" : labels.suggestSchedule}
          </button>
        )}
        <Link
          href={`/tournaments/${tournamentId}/phases/${phase.id}/standings`}
          className="ps-btn ps-btn--ghost"
          style={{ fontSize: 12 }}
        >
          {labels.viewStandings}
        </Link>
        {canEdit && !editing && (
          <button
            type="button"
            className="ps-btn ps-btn--ghost"
            onClick={remove}
            disabled={deleting}
            style={{ fontSize: 12, marginLeft: "auto" }}
          >
            {deleting ? "…" : labels.delete}
          </button>
        )}
      </div>
    </div>
  );
}
