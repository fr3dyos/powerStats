"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  deletePlayerAction,
  updatePlayerAction,
} from "../../../_actions";
import type { Team } from "@/utils/api-shared";

type PlayerEditFormProps = {
  playerId: number;
  initial: {
    first_name: string;
    last_name: string;
    jersey_number: number | null;
    team_id: number;
  };
  teams: Team[];
  tournamentNames?: Record<number, string>;
  canDelete: boolean;
  copy: {
    firstName: string;
    lastName: string;
    jersey: string;
    team: string;
    selectTeam: string;
    photoFile: string;
    photoFileHint: string;
    save: string;
    cancel: string;
    back: string;
    delete: string;
    deleteConfirm: string;
    requiredFields: string;
    playerExists: string;
    playerSaved: string;
    playerUpdateFailed: string;
    deleteForbidden: string;
    playerDeleteFailed: string;
    playerDeleted: string;
  };
};

export default function PlayerEditForm({
  playerId,
  initial,
  teams,
  tournamentNames,
  canDelete,
  copy,
}: PlayerEditFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial.first_name);
  const [lastName, setLastName] = useState(initial.last_name);
  const [jersey, setJersey] = useState(
    initial.jersey_number === null ? "" : String(initial.jersey_number),
  );
  const [teamId, setTeamId] = useState<string>(String(initial.team_id));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const teamGroups = useMemo(() => {
    // Group teams by tournament id, sorted by team name within each group.
    const byTournament = new Map<number, Team[]>();
    for (const team of teams) {
      const list = byTournament.get(team.tournament_id) ?? [];
      list.push(team);
      byTournament.set(team.tournament_id, list);
    }
    return Array.from(byTournament.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([tid, list]) => ({
        tournamentId: tid,
        teams: [...list].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [teams]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setConfirmDelete(false);

    if (!firstName.trim() || !lastName.trim() || !teamId) {
      setFeedback({ ok: false, msg: copy.requiredFields });
      return;
    }

    const formData = new FormData();
    formData.set("first_name", firstName.trim());
    formData.set("last_name", lastName.trim());
    formData.set("jersey_number", jersey.trim());
    formData.set("team_id", teamId);
    if (photoFile) formData.set("photo_file", photoFile);

    startTransition(async () => {
      const result = await updatePlayerAction(playerId, formData);
      if (result.ok === true) {
        setFeedback({ ok: true, msg: copy.playerSaved });
        router.refresh();
        return;
      }
      const messageKey =
        result.error === "requiredFields"
          ? copy.requiredFields
          : result.error === "playerExists"
            ? copy.playerExists
            : copy.playerUpdateFailed;
      setFeedback({ ok: false, msg: messageKey });
    });
  }

  function handleDelete() {
    setFeedback(null);
    startTransition(async () => {
      const result = await deletePlayerAction(playerId);
      if (result.ok === true) {
        setFeedback({ ok: true, msg: copy.playerDeleted });
        // The player is gone — send the user back to the directory.
        setTimeout(() => router.push("/admin/players"), 600);
        return;
      }
      const messageKey =
        result.error === "deleteForbidden"
          ? copy.deleteForbidden
          : copy.playerDeleteFailed;
      setFeedback({ ok: false, msg: messageKey });
      setConfirmDelete(false);
    });
  }

  return (
    <form
      className="ps-card"
      style={{
        marginTop: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
      onSubmit={handleSubmit}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.firstName}</span>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="ps-input"
            required
            autoComplete="off"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.lastName}</span>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="ps-input"
            required
            autoComplete="off"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.jersey}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={999}
            value={jersey}
            onChange={(e) => setJersey(e.target.value)}
            className="ps-input"
            autoComplete="off"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.team}</span>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="ps-input"
            required
          >
            {teamGroups.map((group) => (
              <optgroup key={group.tournamentId} label={tournamentNames?.[group.tournamentId] ?? `Tournament ${group.tournamentId}`}>
                {group.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.photoFile}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setPhotoFile(file);
            }}
            className="ps-input"
          />
          <span style={{ fontSize: 11, color: "var(--ps-text-muted)" }}>
            {copy.photoFileHint}
          </span>
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          type="submit"
          className="ps-btn ps-btn--primary"
          disabled={isPending}
        >
          {isPending ? "…" : copy.save}
        </button>
        <button
          type="button"
          className="ps-btn ps-btn--ghost"
          onClick={() => router.push("/admin/players")}
          disabled={isPending}
        >
          {copy.back}
        </button>

        {canDelete ? (
          confirmDelete ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--ps-text-muted)",
              }}
            >
              {copy.deleteConfirm}
              <button
                type="button"
                className="ps-btn ps-btn--danger"
                onClick={handleDelete}
                disabled={isPending}
                style={{ padding: "4px 12px", fontSize: 12 }}
              >
                {copy.delete}
              </button>
              <button
                type="button"
                className="ps-btn ps-btn--ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={isPending}
                style={{ padding: "4px 12px", fontSize: 12 }}
              >
                {copy.cancel}
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="ps-btn ps-btn--ghost"
              onClick={() => {
                setConfirmDelete(true);
                setFeedback(null);
              }}
              disabled={isPending}
              style={{ color: "var(--ps-error, #c62828)", borderColor: "var(--ps-error, #c62828)" }}
            >
              {copy.delete}
            </button>
          )
        ) : null}

        {feedback ? (
          <span
            role={feedback.ok ? "status" : "alert"}
            style={{
              fontSize: 13,
              color: feedback.ok ? "var(--ps-success, #2e7d32)" : "var(--ps-error, #c62828)",
            }}
          >
            {feedback.msg}
          </span>
        ) : null}
      </div>
    </form>
  );
}
