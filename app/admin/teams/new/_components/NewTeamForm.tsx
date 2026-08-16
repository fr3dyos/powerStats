"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createTeamAction } from "../../_actions";
import type { Tournament } from "@/utils/api-shared";

type NewTeamFormProps = {
  tournaments: Tournament[];
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
    requiredFields: string;
    teamCreated: string;
    teamAddFailed: string;
  };
};

export default function NewTeamForm({
  tournaments,
  copy,
}: NewTeamFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [tournamentId, setTournamentId] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setTournamentId("");
    setLogoUrl("");
    setLogoFile(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

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
      const result = await createTeamAction(formData);
      if (result.ok === true) {
        setFeedback({ ok: true, msg: copy.teamCreated });
        reset();
        return;
      }
      const messageKey =
        result.error === "requiredFields"
          ? copy.requiredFields
          : copy.teamAddFailed;
      setFeedback({ ok: false, msg: messageKey });
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
            <option value="">{copy.selectTournament}</option>
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

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
          onClick={() => {
            reset();
            setFeedback(null);
            router.push("/admin/teams");
          }}
          disabled={isPending}
        >
          {copy.cancel}
        </button>
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
