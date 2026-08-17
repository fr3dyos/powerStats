"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";

import { CsvButton } from "@/app/_components/CsvButton";

type Team = {
  id: number;
  name: string;
  tournament_id: number;
};

type Player = {
  id: number;
  first_name: string;
  last_name: string;
  jersey_number?: number | null;
  team_id?: number;
  gender?: string | null;
  nationality?: string | null;
  other?: string | null;
};

type BulkImportPreview = {
  teams_to_create?: number;
  players_to_create?: number;
  proposed_teams?: Array<{ name: string; tournament_id: number }>;
  proposed_players?: Array<{
    first_name: string;
    last_name: string;
    jersey_number?: number | null;
    team_name?: string | null;
    gender?: string | null;
    nationality?: string | null;
    other?: string | null;
  }>;
  errors?: Array<{ row: number; reason: string }>;
};

type BulkImportReport = {
  teams_created?: number;
  players_created?: number;
  teams?: Team[];
  players?: Player[];
  errors?: Array<{ row: number; reason: string }> | string[];
  [k: string]: unknown;
};

type Stage = "idle" | "previewing" | "previewed" | "committing";

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
    bulkImportColumnHelp: string;
    bulkImportSummary: string;
    exportCsv: string;
    previewImport: string;
    confirmImport: string;
    backToIdle: string;
    teamsToCreate: string;
    playersToCreate: string;
    rowErrors: string;
    gender: string;
    nationality: string;
    other: string;
    teamColumn: string;
    nameColumn: string;
    lastnameColumn: string;
    numberColumn: string;
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
    null,
  );
  const [dragActive, setDragActive] = useState(false);
  const [roster, setRoster] = useState<
    Array<Player & { team_name: string }>
  >([]);

  // Two-step staging state.
  const [stage, setStage] = useState<Stage>("idle");
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [preview, setPreview] = useState<BulkImportPreview | null>(null);

  // Fetch roster (players grouped by team) any time the team list changes.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (teams.length === 0) {
        setRoster([]);
        return;
      }
      const results: Array<Player & { team_name: string }> = [];
      for (const t of teams) {
        try {
          const res = await fetch(`/api/players?team_id=${t.id}`);
          if (!res.ok) continue;
          const data: Player[] = await res.json();
          for (const p of data) {
            results.push({ ...p, team_name: t.name });
          }
        } catch {
          // ignore
        }
      }
      if (!cancelled) setRoster(results);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [teams, tournamentId]);

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
      setMessage(null);
      setPreview(null);
      setStage("idle");
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
      setMessage(null);
      setPreview(null);
      setStage("idle");
    }
  };

  /**
   * Read the file and validate its headers. Returns the parsed rows or
   * throws an Error with a human-readable message that the caller can
   * surface as a `setMessage({ ok: false, ... })`.
   */
  const parseAndValidate = async (
    f: File,
  ): Promise<Record<string, string>[]> => {
    const text = await f.text();
    let rows: Record<string, string>[] = [];

    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        rows = results.data;
      },
      error: (err) => {
        throw new Error(`CSV parse error: ${err.message}`);
      },
    });

    if (rows.length === 0) {
      throw new Error("No rows found in file");
    }

    // Validate required columns. "player lastname" and "player last name"
    // are interchangeable; we accept either.
    const requiredCols = ["player name", "player number", "team"];
    const lastnameCols = ["player lastname", "player last name"];
    const headers = Object.keys(rows[0] || {}).map((h) =>
      h.toLowerCase().trim(),
    );
    const missing = requiredCols.filter((col) => !headers.includes(col));
    const hasLastname = lastnameCols.some((col) => headers.includes(col));
    if (missing.length > 0) {
      throw new Error(`Missing required columns: ${missing.join(", ")}`);
    }
    if (!hasLastname) {
      throw new Error(
        `Missing required column: "player lastname" or "player last name"`,
      );
    }
    return rows;
  };

  /**
   * Step 1: parse the CSV locally and call /preview. Render the proposed
   * teams + players for the user to inspect before any DB writes happen.
   */
  const handlePreviewImport = async () => {
    if (!file) {
      setMessage({ ok: false, text: "Please select a file" });
      return;
    }

    setBusy(true);
    setStage("previewing");
    setMessage(null);
    setPreview(null);

    try {
      const rows = await parseAndValidate(file);
      setParsedRows(rows);

      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/bulk-import/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ players: rows }),
        },
      );

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail ?? "Preview failed");
      }

      const previewData: BulkImportPreview = await res.json();
      setPreview(previewData);
      setStage("previewed");
    } catch (err) {
      setStage("idle");
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Preview failed",
      });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Step 2: persist the same rows the user just previewed. The backend
   * returns the updated teams list so we can sync the parent component.
   */
  const handleConfirmImport = async () => {
    if (!preview || stage !== "previewed") return;

    setBusy(true);
    setStage("committing");
    setMessage(null);

    try {
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/bulk-import/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ players: parsedRows }),
        },
      );

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail ?? "Import failed");
      }

      const report: BulkImportReport = await res.json();
      const updatedTeams = report.teams || teams;
      setTeams(updatedTeams);
      onTeamsUpdated(updatedTeams);

      const summary = labels.bulkImportSummary
        .replace("{teams}", String(report.teams_created || 0))
        .replace("{players}", String(report.players_created || 0));
      setMessage({ ok: true, text: summary });

      // Reset the staging state so the user can drop a new file without
      // the preview lingering.
      setStage("idle");
      setPreview(null);
      setParsedRows([]);
      setFile(null);
    } catch (err) {
      // Stay in previewed state so the user can retry without re-uploading.
      setStage("previewed");
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Import failed",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleBackToIdle = () => {
    setStage("idle");
    setPreview(null);
    setMessage(null);
  };

  // Convenience: render a `—` for the three optional profile fields when
  // they're either absent or just the single-space default sentinel.
  const displayValue = (v: string | null | undefined) => {
    if (v == null) return "—";
    const trimmed = v.trim();
    if (trimmed.length === 0) return "—";
    return v;
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
        </div>

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
            {labels.bulkImportColumnHelp}
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

        {/* Stage 1 controls (idle): preview button */}
        {stage === "idle" || stage === "previewing" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="ps-btn ps-btn--primary"
              onClick={handlePreviewImport}
              disabled={busy || !file}
            >
              {stage === "previewing" ? labels.loading : labels.previewImport}
            </button>
            {file && (
              <button
                type="button"
                className="ps-btn ps-btn--ghost"
                onClick={() => {
                  setFile(null);
                  setMessage(null);
                  setPreview(null);
                  setStage("idle");
                }}
                disabled={busy}
              >
                {labels.cancel}
              </button>
            )}
          </div>
        ) : null}

        {/* Stage 2: preview table + confirm */}
        {stage === "previewed" && preview ? (
          <div
            style={{
              border: "1px solid var(--ps-border)",
              borderRadius: 6,
              padding: 12,
              marginBottom: 16,
              background: "var(--ps-surface-container-low)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 12,
                fontSize: 13,
              }}
            >
              <strong>
                {labels.teamsToCreate.replace(
                  "{count}",
                  String(preview.teams_to_create ?? 0),
                )}
              </strong>
              <strong>
                {labels.playersToCreate.replace(
                  "{count}",
                  String(preview.players_to_create ?? 0),
                )}
              </strong>
              {preview.errors && preview.errors.length > 0 ? (
                <strong style={{ color: "#F44336" }}>
                  {labels.rowErrors.replace(
                    "{count}",
                    String(preview.errors.length),
                  )}
                </strong>
              ) : null}
            </div>

            {preview.errors && preview.errors.length > 0 ? (
              <details style={{ marginBottom: 12, fontSize: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                  {labels.rowErrors.replace(
                    "{count}",
                    String(preview.errors.length),
                  )}
                </summary>
                <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
                  {preview.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {preview.proposed_players &&
            preview.proposed_players.length > 0 ? (
              <div style={{ overflowX: "auto", marginBottom: 12 }}>
                <table className="ps-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>{labels.teamColumn}</th>
                      <th>{labels.nameColumn}</th>
                      <th>{labels.lastnameColumn}</th>
                      <th>{labels.numberColumn}</th>
                      <th>{labels.gender}</th>
                      <th>{labels.nationality}</th>
                      <th>{labels.other}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.proposed_players.map((p, i) => (
                      <tr key={i}>
                        <td>{p.team_name ?? "—"}</td>
                        <td>{p.first_name}</td>
                        <td>{p.last_name}</td>
                        <td>{p.jersey_number ?? "—"}</td>
                        <td>{displayValue(p.gender)}</td>
                        <td>{displayValue(p.nationality)}</td>
                        <td>{displayValue(p.other)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="ps-btn ps-btn--primary"
                onClick={handleConfirmImport}
                disabled={busy || (preview.players_to_create ?? 0) === 0}
              >
                {labels.confirmImport}
              </button>
              <button
                type="button"
                className="ps-btn ps-btn--ghost"
                onClick={handleBackToIdle}
                disabled={busy}
              >
                {labels.backToIdle}
              </button>
            </div>
          </div>
        ) : null}

        {/* Stage 2 committing indicator */}
        {stage === "committing" ? (
          <div style={{ fontSize: 13, color: "var(--ps-text-muted)" }}>
            {labels.loading}…
          </div>
        ) : null}
      </div>

      {/* Existing roster */}
      <div className="ps-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <h2 style={{ fontSize: 18, margin: 0 }}>{labels.players}</h2>
          <CsvButton
            filename={`tournament-${tournamentId}-roster`}
            label={labels.exportCsv}
            variant="ghost"
            rows={roster.map((r) => ({
              team: r.team_name,
              first_name: r.first_name,
              last_name: r.last_name,
              number: r.jersey_number ?? "",
              gender: r.gender ?? "",
              nationality: r.nationality ?? "",
              other: r.other ?? "",
            }))}
          />
        </div>

        {roster.length === 0 ? (
          <p style={{ color: "var(--ps-text-muted)", margin: 0 }}>
            No players yet.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="ps-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Name</th>
                  <th>Number</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.id}>
                    <td>{r.team_name}</td>
                    <td>
                      {r.first_name} {r.last_name}
                    </td>
                    <td>{r.jersey_number ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
