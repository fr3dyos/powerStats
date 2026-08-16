"use client";

import { useState } from "react";
import Papa from "papaparse";

type Team = {
  id: number;
  name: string;
  tournament_id: number;
};

type Player = {
  first_name: string;
  last_name: string;
  number: string;
  team: string;
  gender?: string;
  other?: string;
};

type BulkImportReport = {
  teams_created?: number;
  players_created?: number;
  teams?: Team[];
  players?: Player[];
  errors?: string[];
  [k: string]: unknown;
};

type Props = {
  tournamentId: number;
  teams: Team[];
  onTeamsUpdated: (teams: Team[]) => void;
  labels: {
    teams: string;
    addTeam: string;
    teamName: string;
    players: string;
    importRoster: string;
    uploadCSVXLSX: string;
    dragDropHint: string;
    selectFile: string;
    submit: string;
    cancel: string;
    loading: string;
  };
};

export default function TeamsAndPlayersPanel({
  tournamentId,
  teams: initialTeams,
  onTeamsUpdated,
  labels,
}: Props) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [newTeamName, setNewTeamName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [dragActive, setDragActive] = useState(false);

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return;

    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTeamName,
          tournament_id: tournamentId,
        }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail ?? "Failed to create team");
      }

      const newTeam = await res.json();
      const updatedTeams = [...teams, newTeam];
      setTeams(updatedTeams);
      onTeamsUpdated(updatedTeams);
      setNewTeamName("");
      setMessage({ ok: true, text: "Team created!" });
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Create failed",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleBulkImport = async () => {
    if (!file) {
      setMessage({ ok: false, text: "Please select a file" });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const text = await file.text();
      let rows: Record<string, string>[] = [];

      // Parse CSV
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          rows = results.data as Record<string, string>[];
        },
        error: (err) => {
          throw new Error(`CSV parse error: ${err.message}`);
        },
      });

      if (rows.length === 0) {
        throw new Error("No rows found in file");
      }

      // Validate required columns
      const requiredCols = [
        "player name",
        "player lastname",
        "player number",
        "team",
      ];
      const headers = Object.keys(rows[0] || {}).map((h) => h.toLowerCase());
      const missing = requiredCols.filter((col) => !headers.includes(col));
      if (missing.length > 0) {
        throw new Error(
          `Missing required columns: ${missing.join(", ")}`
        );
      }

      // Send to backend
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/bulk-import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ players: rows }),
        }
      );

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail ?? "Import failed");
      }

      const report: BulkImportReport = await res.json();
      const updatedTeams = report.teams || teams;
      setTeams(updatedTeams);
      onTeamsUpdated(updatedTeams);
      setFile(null);

      const summary =
        `Imported: ${report.teams_created || 0} teams, ` +
        `${report.players_created || 0} players`;
      setMessage({ ok: true, text: summary });
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Import failed",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Teams Section */}
      <div className="ps-card">
        <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 16 }}>
          {labels.teams}
        </h2>

        <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
          {teams.length === 0 ? (
            <p style={{ color: "var(--ps-text-muted)", margin: 0 }}>
              No teams yet. Add teams or import from CSV/XLSX.
            </p>
          ) : (
            teams.map((team) => (
              <div
                key={team.id}
                style={{
                  padding: 12,
                  border: "1px solid var(--ps-border)",
                  borderRadius: 4,
                  background: "var(--ps-surface-container-low)",
                }}
              >
                {team.name}
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            className="ps-input"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder={labels.teamName}
            disabled={busy}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="ps-btn ps-btn--secondary"
            onClick={handleAddTeam}
            disabled={busy || !newTeamName.trim()}
          >
            {labels.addTeam}
          </button>
        </div>
      </div>

      {/* Bulk Import Section */}
      <div className="ps-card">
        <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 16 }}>
          {labels.importRoster}
        </h2>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          style={{
            padding: 24,
            border: `2px dashed ${dragActive ? "var(--ps-accent)" : "var(--ps-border)"}`,
            borderRadius: 8,
            background: dragActive
              ? "rgba(var(--ps-accent-rgb), 0.05)"
              : "var(--ps-surface-container-low)",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s",
            marginBottom: 16,
          }}
        >
          <input
            type="file"
            id="file-input"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            disabled={busy}
            style={{ display: "none" }}
          />
          <label
            htmlFor="file-input"
            style={{
              display: "block",
              cursor: "pointer",
              color: file ? "var(--ps-text)" : "var(--ps-text-muted)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              {file ? file.name : labels.uploadCSVXLSX}
            </div>
            <div style={{ fontSize: 12, color: "var(--ps-text-muted)" }}>
              {labels.dragDropHint}
            </div>
          </label>
        </label>

        <details style={{ marginBottom: 16, fontSize: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            Required columns
          </summary>
          <pre
            style={{
              background: "var(--ps-surface-container)",
              padding: 12,
              borderRadius: 4,
              overflow: "auto",
              fontSize: 11,
            }}
          >
            {`player name, player lastname, player number, team, gender, other`}
          </pre>
        </details>

        {message && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 4,
              background: message.ok
                ? "rgba(76, 175, 80, 0.1)"
                : "rgba(244, 67, 54, 0.1)",
              color: message.ok ? "#2E7D32" : "#F44336",
              fontSize: 13,
            }}
          >
            {message.text}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="ps-btn ps-btn--primary"
            onClick={handleBulkImport}
            disabled={busy || !file}
          >
            {busy ? labels.loading : labels.submit}
          </button>
          {file && (
            <button
              type="button"
              className="ps-btn ps-btn--ghost"
              onClick={() => setFile(null)}
              disabled={busy}
            >
              {labels.cancel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
