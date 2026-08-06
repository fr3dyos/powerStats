"use client";

import { useMemo, useState, useTransition } from "react";

import { createPlayerAction } from "./_actions";
import type { Team } from "@/utils/api-shared";

type AddPlayerFormProps = {
  teams: Team[];
  copy: {
    addPlayer: string;
    firstName: string;
    lastName: string;
    jersey: string;
    team: string;
    selectTeam: string;
    save: string;
    cancel: string;
    requiredFields: string;
    playerExists: string;
    playerAdded: string;
    playerAddFailed: string;
  };
};

export default function AddPlayerForm({ teams, copy }: AddPlayerFormProps) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jersey, setJersey] = useState("");
  const [teamId, setTeamId] = useState<string>("");
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

  function reset() {
    setFirstName("");
    setLastName("");
    setJersey("");
    setTeamId("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!firstName.trim() || !lastName.trim() || !teamId) {
      setFeedback({ ok: false, msg: copy.requiredFields });
      return;
    }

    const formData = new FormData();
    formData.set("first_name", firstName.trim());
    formData.set("last_name", lastName.trim());
    formData.set("jersey_number", jersey.trim());
    formData.set("team_id", teamId);

    startTransition(async () => {
      const result = await createPlayerAction(formData);
      if (result.ok === true) {
        setFeedback({ ok: true, msg: copy.playerAdded });
        reset();
        return;
      }
      const errorKey = result.error;
      const messageKey =
        errorKey === "requiredFields"
          ? copy.requiredFields
          : errorKey === "playerExists"
            ? copy.playerExists
            : copy.playerAddFailed;
      setFeedback({ ok: false, msg: messageKey });
    });
  }

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ps-button ps-button--primary"
          disabled={teams.length === 0}
          aria-disabled={teams.length === 0}
          title={teams.length === 0 ? copy.selectTeam : undefined}
        >
          {copy.addPlayer}
        </button>
      </div>
    );
  }

  return (
    <form
      className="ps-card"
      style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}
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
            <option value="">{copy.selectTeam}</option>
            {teamGroups.map((group) => (
              <optgroup key={group.tournamentId} label={`Tournament ${group.tournamentId}`}>
                {group.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          className="ps-button ps-button--primary"
          disabled={isPending}
        >
          {isPending ? "…" : copy.save}
        </button>
        <button
          type="button"
          className="ps-button ps-button--ghost"
          onClick={() => {
            setOpen(false);
            setFeedback(null);
            reset();
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
