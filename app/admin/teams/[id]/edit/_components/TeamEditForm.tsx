"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  deleteTeamAction,
  updateTeamAction,
} from "../../../_actions";
import type { Tournament } from "@/utils/api-shared";

type TeamEditFormProps = {
  teamId: number;
  initial: {
    name: string;
    tournament_id: number;
    logo_url: string | null;
  };
  tournaments: Tournament[];
  canDelete: boolean;
  copy: {
    teamName: string;
    tournament: string;
    selectTournament: string;
    logoUrl: string;
    logoUrlHint: string;
    logoFile: string;
    logoFileHint: string;
    save: string;
    cancel: string;
    back: string;
    delete: string;
    deleteConfirm: string;
    requiredFields: string;
    teamExists: string;
    teamSaved: string;
    teamUpdateFailed: string;
    deleteForbidden: string;
    teamDeleteFailed: string;
    teamDeleted: string;
  };
};

export default function TeamEditForm({
  teamId,
  initial,
  tournaments,
  canDelete,
  copy,
}: TeamEditFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [tournamentId, setTournamentId] = useState<string>(
    String(initial.tournament_id),
  );
  const [logoUrl, setLogoUrl] = useState(initial.logo_url ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setConfirmDelete(false);

    if (!name.trim() || !tournamentId) {
      setFeedback({ ok: false, msg: copy.requiredFields });
      return;
    }

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("tournament_id", tournamentId);
    if (logoUrl.trim()) formData.set("logo_url", logoUrl.trim());
    if (logoFile) formData.set("logo_file", logoFile);

    startTransition(async () => {
      const result = await updateTeamAction(teamId, formData);
      if (result.ok === true) {
        setFeedback({ ok: true, msg: copy.teamSaved });
        router.refresh();
        return;
      }
      const messageKey =
        result.error === "requiredFields"
          ? copy.requiredFields
          : result.error === "teamExists"
            ? copy.teamExists
            : copy.teamUpdateFailed;
      setFeedback({ ok: false, msg: messageKey });
    });
  }

  function handleDelete() {
    setFeedback(null);
    startTransition(async () => {
      const result = await deleteTeamAction(teamId);
      if (result.ok === true) {
        setFeedback({ ok: true, msg: copy.teamDeleted });
        // The team is gone — send the user back to the directory.
        setTimeout(() => router.push("/admin/teams"), 600);
        return;
      }
      const messageKey =
        result.error === "deleteForbidden"
          ? copy.deleteForbidden
          : copy.teamDeleteFailed;
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
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.teamName}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ps-input"
            required
            autoComplete="off"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.tournament}</span>
          <select
            value={tournamentId}
            onChange={(e) => setTournamentId(e.target.value)}
            className="ps-input"
            required
          >
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.logoFile}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setLogoFile(file);
              if (file) setLogoUrl("");
            }}
            className="ps-input"
          />
          <span style={{ fontSize: 11, color: "var(--ps-text-muted)" }}>
            {copy.logoFileHint}
          </span>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.logoUrl}</span>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => {
              setLogoUrl(e.target.value);
              if (e.target.value) setLogoFile(null);
            }}
            className="ps-input"
            placeholder={copy.logoUrlHint}
            autoComplete="off"
            disabled={logoFile !== null}
          />
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
          onClick={() => router.push("/admin/teams")}
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
