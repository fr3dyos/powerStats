"use client";

import { useEffect, useMemo, useState } from "react";
// `crypto.randomUUID` is available in all modern browsers + Node 19+; we
// fall back to a Math.random-based id for older runtimes (tests, SSR).
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
  existing_teams?: Array<{
    id: number;
    name: string;
    tournament_id: number;
  }>;
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

/**
 * One editable row in the preview table. Mirrors the shape of
 * `proposed_players[i]` so the panel can re-send it to the backend as
 * `edited_players`. The `rowId` is a stable React key generated
 * client-side; the backend ignores it.
 */
type EditablePlayer = {
  rowId: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  team_name: string;
  gender: string;
  nationality: string;
  other: string;
  // Sentinel: when true, the team cell is rendering the free-text
  // input instead of the picker. Lets us keep the user's cursor
  // position when they switch modes.
  teamIsNew: boolean;
};

type BulkImportReport = {
  teams_created?: number;
  players_created?: number;
  teams?: Team[];
  players?: Player[];
  errors?: Array<{ row: number; reason: string }> | string[];
  [k: string]: unknown;
};

// Canonical fields the bulk-import recognizes. Each entry is paired with
// the i18n label key the panel uses to render its dropdown. The order
// here is the order the user sees in the mapping UI.
type CanonicalField = {
  key: string;
  labelKey:
    | "nameColumn"
    | "lastnameColumn"
    | "numberColumn"
    | "teamColumn"
    | "gender"
    | "nationality"
    | "other";
  required: boolean;
  // Extra canonical aliases the auto-detector should match (besides
  // the key itself, case-insensitive).
  aliases?: string[];
};

const CANONICAL_FIELDS: CanonicalField[] = [
  { key: "player name", labelKey: "nameColumn", required: true },
  {
    key: "player lastname",
    labelKey: "lastnameColumn",
    required: true,
    aliases: ["player last name"],
  },
  { key: "player number", labelKey: "numberColumn", required: true },
  { key: "team", labelKey: "teamColumn", required: true },
  { key: "gender", labelKey: "gender", required: false },
  { key: "nationality", labelKey: "nationality", required: false },
  { key: "other", labelKey: "other", required: false },
];

type Stage = "idle" | "mapping" | "previewing" | "previewed" | "committing";

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
    mappingTitle: string;
    mappingHelp: string;
    noColumn: string;
    requiredField: string;
    removeRow: string;
    newTeam: string;
    rowInvalid: string;
  };
};

/**
 * Build a best-effort initial column map from a list of CSV headers.
 * Returns a record keyed by canonical field name, value = the matched
 * header (case-insensitive). Fields with no match get an empty string,
 * which the UI surfaces as "(no column)".
 */
function autoDetectColumnMap(headers: string[]): Record<string, string> {
  const lookup = new Map<string, string>();
  for (const h of headers) {
    lookup.set(h.toLowerCase().trim(), h);
  }
  const out: Record<string, string> = {};
  for (const field of CANONICAL_FIELDS) {
    const candidates = [field.key, ...(field.aliases ?? [])];
    let matched = "";
    for (const c of candidates) {
      const hit = lookup.get(c.toLowerCase().trim());
      if (hit) {
        matched = hit;
        break;
      }
    }
    out[field.key] = matched;
  }
  return out;
}

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

  // Three-step staging state: idle -> mapping -> previewing -> previewed ->
  // committing. The user picks the column mapping before the preview call
  // so the backend can read whatever headers the file actually uses.
  const [stage, setStage] = useState<Stage>("idle");
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<BulkImportPreview | null>(null);
  // Editable mirror of preview.proposed_players. Populated when /preview
  // returns so the user can fix typos (especially team) before commit.
  // The stable rowId lets React keys survive row removals without index
  // collisions.
  const [editablePlayers, setEditablePlayers] = useState<EditablePlayer[]>([]);

  // Build the team-picker option list: existing tournament teams +
  // teams the CSV proposed to create (de-duplicated by name).
  const teamOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ name: string; source: "existing" | "proposed" }> = [];
    for (const t of preview?.existing_teams ?? []) {
      const k = t.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ name: t.name, source: "existing" });
    }
    for (const t of preview?.proposed_teams ?? []) {
      const k = t.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ name: t.name, source: "proposed" });
    }
    return out;
  }, [preview]);

  // Pre-compute which rowIds are invalid so the Confirm button can be
  // disabled without scanning the array on every render.
  const invalidRowIds = useMemo(() => {
    const out = new Set<string>();
    for (const row of editablePlayers) {
      if (!row.first_name.trim() || !row.last_name.trim() || !row.team_name.trim()) {
        out.add(row.rowId);
      }
    }
    return out;
  }, [editablePlayers]);

  // Mutators for editable rows. Each takes the rowId and a partial patch.
  const updateEditablePlayer = (
    rowId: string,
    patch: Partial<EditablePlayer>,
  ) => {
    setEditablePlayers((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  };

  const removeEditablePlayer = (rowId: string) => {
    setEditablePlayers((prev) => prev.filter((row) => row.rowId !== rowId));
  };

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

  const resetImportState = () => {
    setMessage(null);
    setPreview(null);
    setParsedRows([]);
    setHeaders([]);
    setColumnMap({});
    setEditablePlayers([]);
    setStage("idle");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      resetImportState();
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
      resetImportState();
    }
  };

  /**
   * Read the file and parse it as CSV with the first row treated as the
   * header row. Returns the parsed rows + the raw header list.
   * Throws on parse error or an empty file.
   *
   * We intentionally do NOT validate the headers here: in the new flow
   * the user picks which CSV column maps to each canonical field, so
   * the column names in the file are free-form.
   */
  const parseFile = async (
    f: File,
  ): Promise<{ rows: Record<string, string>[]; headers: string[] }> => {
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

    // Papa.parse lowercases nothing for us, so we read headers off the
    // first row's keys verbatim, trimmed.
    const rawHeaders = Object.keys(rows[0] || {})
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    if (rawHeaders.length === 0) {
      throw new Error("File has no header row");
    }

    return { rows, headers: rawHeaders };
  };

  /**
   * Step 1: parse the file and present the column-mapping UI. After
   * auto-detection the user can override any dropdown before clicking
   * "Preview import".
   */
  const handleOpenMapping = async () => {
    if (!file) {
      setMessage({ ok: false, text: "Please select a file" });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const { rows, headers: fileHeaders } = await parseFile(file);
      setParsedRows(rows);
      setHeaders(fileHeaders);
      setColumnMap(autoDetectColumnMap(fileHeaders));
      setStage("mapping");
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Parse failed",
      });
    } finally {
      setBusy(false);
    }
  };

  // Required fields the user must map before continuing to preview.
  const missingRequired = useMemo(() => {
    return CANONICAL_FIELDS.filter(
      (f) => f.required && !columnMap[f.key],
    ).map((f) => f.key);
  }, [columnMap]);

  /**
   * Step 2: send the parsed rows + the user-supplied column map to the
   * /preview endpoint. The backend normalizes each row using the map.
   */
  const handlePreviewImport = async () => {
    if (!file || stage !== "mapping") return;

    if (missingRequired.length > 0) {
      setMessage({
        ok: false,
        text: `Map the required columns: ${missingRequired.join(", ")}`,
      });
      return;
    }

    setBusy(true);
    setStage("previewing");
    setMessage(null);
    setPreview(null);

    try {
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/bulk-import/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ players: parsedRows, column_map: columnMap }),
        },
      );

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail ?? "Preview failed");
      }

      const previewData: BulkImportPreview = await res.json();
      setPreview(previewData);
      // Seed the editable rows from the proposed players. Each row gets
      // a stable rowId so React keys stay unique even after removals.
      const seeded: EditablePlayer[] = (previewData.proposed_players ?? []).map(
        (p) => ({
          rowId:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `row-${Math.random().toString(36).slice(2, 10)}`,
          first_name: p.first_name ?? "",
          last_name: p.last_name ?? "",
          jersey_number: p.jersey_number ?? null,
          team_name: p.team_name ?? "",
          gender: p.gender ?? "",
          nationality: p.nationality ?? "",
          other: p.other ?? "",
          // Start in picker mode; the user can switch to free-text by
          // selecting the "(new team…)" option.
          teamIsNew: false,
        }),
      );
      setEditablePlayers(seeded);
      setStage("previewed");
    } catch (err) {
      // Stay in mapping so the user can adjust columns without re-uploading.
      setStage("mapping");
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Preview failed",
      });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Step 3: persist the same rows + column map the user just previewed.
   * The backend returns the updated teams list so we can sync the parent.
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
          body: JSON.stringify({
            players: parsedRows,
            column_map: columnMap,
            // Authoritative: any cell edits the admin made in the
            // preview override the raw CSV values. The backend uses
            // this branch and skips the column-normalize step.
            edited_players: editablePlayers.map((row) => ({
              first_name: row.first_name,
              last_name: row.last_name,
              jersey_number: row.jersey_number,
              team_name: row.team_name,
              gender: row.gender,
              nationality: row.nationality,
              other: row.other,
            })),
          }),
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
      setEditablePlayers([]);
      setParsedRows([]);
      setHeaders([]);
      setColumnMap({});
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
    setEditablePlayers([]);
    setMessage(null);
  };

  const handleBackToMapping = () => {
    setStage("mapping");
    setPreview(null);
    setEditablePlayers([]);
    setMessage(null);
  };

  // Render one dropdown for a canonical field.
  const renderMappingRow = (field: CanonicalField) => {
    const labelText = labels[field.labelKey];
    return (
      <div
        key={field.key}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          alignItems: "center",
          padding: "8px 0",
          borderBottom: "1px solid var(--ps-border)",
        }}
      >
        <label
          htmlFor={`map-${field.key}`}
          style={{
            fontSize: 13,
            fontWeight: field.required ? 600 : 400,
          }}
        >
          {labelText}
          {field.required ? (
            <span
              aria-label={labels.requiredField}
              style={{ color: "#F44336", marginLeft: 4 }}
            >
              *
            </span>
          ) : null}
        </label>
        <select
          id={`map-${field.key}`}
          className="ps-input"
          value={columnMap[field.key] ?? ""}
          onChange={(e) =>
            setColumnMap((prev) => ({
              ...prev,
              [field.key]: e.target.value,
            }))
          }
          disabled={busy}
        >
          <option value="">{labels.noColumn}</option>
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>
    );
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

        {/* Stage 1: idle. Show "Map columns" button. */}
        {stage === "idle" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="ps-btn ps-btn--primary"
              onClick={handleOpenMapping}
              disabled={busy || !file}
            >
              {labels.mappingTitle}
            </button>
            {file && (
              <button
                type="button"
                className="ps-btn ps-btn--ghost"
                onClick={() => {
                  setFile(null);
                  resetImportState();
                }}
                disabled={busy}
              >
                {labels.cancel}
              </button>
            )}
          </div>
        ) : null}

        {/* Stage 2: column mapping. Show dropdowns + preview button. */}
        {stage === "mapping" || stage === "previewing" ? (
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
                fontSize: 13,
                color: "var(--ps-text-muted)",
                marginBottom: 8,
              }}
            >
              {labels.mappingHelp}
            </div>
            <div style={{ marginBottom: 12 }}>
              {CANONICAL_FIELDS.map(renderMappingRow)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="ps-btn ps-btn--primary"
                onClick={handlePreviewImport}
                disabled={
                  busy ||
                  stage === "previewing" ||
                  missingRequired.length > 0
                }
              >
                {stage === "previewing" ? labels.loading : labels.previewImport}
              </button>
              <button
                type="button"
                className="ps-btn ps-btn--ghost"
                onClick={handleBackToIdle}
                disabled={busy}
              >
                {labels.cancel}
              </button>
            </div>
          </div>
        ) : null}

        {/* Stage 3: preview table + confirm button. */}
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

            {editablePlayers.length > 0 ? (
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
                      <th aria-label={labels.removeRow} />
                    </tr>
                  </thead>
                  <tbody>
                    {editablePlayers.map((row) => {
                      const invalid = invalidRowIds.has(row.rowId);
                      const rowHighlight = invalid
                        ? "rgba(244, 67, 54, 0.06)"
                        : "transparent";
                      return (
                        <tr key={row.rowId} style={{ background: rowHighlight }}>
                          <td>
                            {row.teamIsNew ? (
                              <input
                                type="text"
                                className="ps-input"
                                style={{ minWidth: 120, fontSize: 12 }}
                                value={row.team_name}
                                placeholder={labels.newTeam}
                                onChange={(e) =>
                                  updateEditablePlayer(row.rowId, {
                                    team_name: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              <select
                                className="ps-input"
                                style={{ minWidth: 120, fontSize: 12 }}
                                value={row.team_name}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  if (next === "__new_team__") {
                                    updateEditablePlayer(row.rowId, {
                                      teamIsNew: true,
                                      team_name: "",
                                    });
                                  } else {
                                    updateEditablePlayer(row.rowId, {
                                      team_name: next,
                                      teamIsNew: false,
                                    });
                                  }
                                }}
                              >
                                <option value="" disabled>
                                  {labels.teamColumn}
                                </option>
                                {teamOptions.map((opt) => (
                                  <option key={opt.name} value={opt.name}>
                                    {opt.name}
                                  </option>
                                ))}
                                <option value="__new_team__">
                                  {labels.newTeam}
                                </option>
                              </select>
                            )}
                          </td>
                          <td>
                            <input
                              type="text"
                              className="ps-input"
                              style={{ minWidth: 100, fontSize: 12 }}
                              value={row.first_name}
                              onChange={(e) =>
                                updateEditablePlayer(row.rowId, {
                                  first_name: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="ps-input"
                              style={{ minWidth: 100, fontSize: 12 }}
                              value={row.last_name}
                              onChange={(e) =>
                                updateEditablePlayer(row.rowId, {
                                  last_name: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="ps-input"
                              style={{ minWidth: 70, fontSize: 12 }}
                              value={
                                row.jersey_number == null
                                  ? ""
                                  : String(row.jersey_number)
                              }
                              onChange={(e) => {
                                const raw = e.target.value;
                                updateEditablePlayer(row.rowId, {
                                  jersey_number:
                                    raw === "" ? null : Number(raw),
                                });
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="ps-input"
                              style={{ minWidth: 70, fontSize: 12 }}
                              value={row.gender}
                              onChange={(e) =>
                                updateEditablePlayer(row.rowId, {
                                  gender: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="ps-input"
                              style={{ minWidth: 90, fontSize: 12 }}
                              value={row.nationality}
                              onChange={(e) =>
                                updateEditablePlayer(row.rowId, {
                                  nationality: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="ps-input"
                              style={{ minWidth: 110, fontSize: 12 }}
                              value={row.other}
                              onChange={(e) =>
                                updateEditablePlayer(row.rowId, {
                                  other: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="ps-btn ps-btn--ghost"
                              style={{ padding: "2px 8px", fontSize: 12 }}
                              onClick={() => removeEditablePlayer(row.rowId)}
                              disabled={busy}
                              aria-label={labels.removeRow}
                              title={labels.removeRow}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {invalidRowIds.size > 0 ? (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "#F44336",
                    }}
                  >
                    {labels.rowInvalid}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="ps-btn ps-btn--primary"
                onClick={handleConfirmImport}
                disabled={
                  busy ||
                  editablePlayers.length === 0 ||
                  invalidRowIds.size > 0
                }
              >
                {labels.confirmImport}
              </button>
              <button
                type="button"
                className="ps-btn ps-btn--ghost"
                onClick={handleBackToMapping}
                disabled={busy}
              >
                {labels.backToIdle}
              </button>
            </div>
          </div>
        ) : null}

        {/* Stage 4: committing indicator. */}
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
