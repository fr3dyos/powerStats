"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

type Team = {
  id: number;
  name: string;
  tournament_id: number;
};

type BulkImportTeamsPreview = {
  teams_to_create?: number;
  proposed_teams?: Array<{ name: string; tournament_id: number }>;
  existing_teams?: Array<{ id: number; name: string; tournament_id: number }>;
  errors?: Array<{ row: number; reason: string }>;
};

type EditableTeam = {
  rowId: string;
  team_name: string;
  logo_url: string;
  teamIsNew: boolean;
};

type Stage = "idle" | "mapping" | "previewing" | "previewed" | "committing";

type Props = {
  tournamentId: number;
  labels: {
    importRoster: string;
    uploadCSVXLSX: string;
    dragDropHint: string;
    submit: string;
    cancel: string;
    loading: string;
    previewImport: string;
    confirmImport: string;
    backToIdle: string;
    teamsToCreate: string;
    rowErrors: string;
    mappingTitle: string;
    mappingHelp: string;
    noColumn: string;
    requiredField: string;
    removeRow: string;
    newTeam: string;
    rowInvalid: string;
  };
};

const CANONICAL_FIELDS = [
  { key: "team", required: true, aliases: ["name", "team_name"] },
  { key: "logo_url", required: false, aliases: ["logo", "logo_url"] },
];

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

export default function TeamsBulkImportPanel({ tournamentId, labels }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [dragActive, setDragActive] = useState(false);

  const [stage, setStage] = useState<Stage>("idle");
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<BulkImportTeamsPreview | null>(null);
  const [editableTeams, setEditableTeams] = useState<EditableTeam[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setStage("idle");
      setPreview(null);
      setEditableTeams([]);
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
      setStage("idle");
    }
  };

  const parseFile = async (
    f: File
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

    const rawHeaders = Object.keys(rows[0] || {})
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    if (rawHeaders.length === 0) {
      throw new Error("File has no header row");
    }

    return { rows, headers: rawHeaders };
  };

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

  const missingRequired = useMemo(() => {
    return CANONICAL_FIELDS.filter(
      (f) => f.required && !columnMap[f.key]
    ).map((f) => f.key);
  }, [columnMap]);

  const handlePreviewImport = async () => {
    if (!file || stage !== "mapping") return;

    if (missingRequired.length > 0) {
      setMessage({
        ok: false,
        text: `Map required columns: ${missingRequired.join(", ")}`,
      });
      return;
    }

    setBusy(true);
    setStage("previewing");
    setMessage(null);
    setPreview(null);

    try {
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/bulk-import-teams/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teams: parsedRows, column_map: columnMap }),
        }
      );

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail ?? "Preview failed");
      }

      const previewData: BulkImportTeamsPreview = await res.json();
      setPreview(previewData);

      const seeded: EditableTeam[] = (previewData.proposed_teams ?? []).map(
        (t) => ({
          rowId:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `row-${Math.random().toString(36).slice(2, 10)}`,
          team_name: t.name ?? "",
          logo_url: "",
          teamIsNew: false,
        })
      );
      setEditableTeams(seeded);
      setStage("previewed");
    } catch (err) {
      setStage("mapping");
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Preview failed",
      });
    } finally {
      setBusy(false);
    }
  };

  const teamOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ name: string }> = [];
    for (const t of preview?.existing_teams ?? []) {
      const k = t.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ name: t.name });
    }
    for (const t of preview?.proposed_teams ?? []) {
      const k = t.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ name: t.name });
    }
    return out;
  }, [preview]);

  const invalidRowIds = useMemo(() => {
    const out = new Set<string>();
    for (const row of editableTeams) {
      if (!row.team_name.trim()) {
        out.add(row.rowId);
      }
    }
    return out;
  }, [editableTeams]);

  const updateEditableTeam = (rowId: string, patch: Partial<EditableTeam>) => {
    setEditableTeams((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
    );
  };

  const removeEditableTeam = (rowId: string) => {
    setEditableTeams((prev) => prev.filter((row) => row.rowId !== rowId));
  };

  const handleConfirmImport = async () => {
    if (!preview || stage !== "previewed") return;

    setBusy(true);
    setStage("committing");
    setMessage(null);

    try {
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/bulk-import-teams/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teams: parsedRows,
            column_map: columnMap,
            edited_teams: editableTeams.map((row) => ({
              team_name: row.team_name,
              logo_url: row.logo_url,
            })),
          }),
        }
      );

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail ?? "Import failed");
      }

      const report = await res.json();
      const summary = labels.teamsToCreate
        ? `Imported ${report.teams_created} team(s).`
        : "Teams imported successfully!";
      setMessage({ ok: true, text: summary });

      setStage("idle");
      setPreview(null);
      setEditableTeams([]);
      setParsedRows([]);
      setHeaders([]);
      setColumnMap({});
      setFile(null);
    } catch (err) {
      setStage("previewed");
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Import failed",
      });
    } finally {
      setBusy(false);
    }
  };

  const renderMappingRow = (field: typeof CANONICAL_FIELDS[0]) => {
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
          {field.key}
          {field.required ? (
            <span style={{ color: "#F44336", marginLeft: 4 }}>*</span>
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
    <div className="ps-card" style={{ display: "grid", gap: 12 }}>
      <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 8 }}>
        Import Teams
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
          id="file-input-teams"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          disabled={busy}
          style={{ display: "none" }}
        />
        <label
          htmlFor="file-input-teams"
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
                setPreview(null);
                setEditableTeams([]);
              }}
              disabled={busy}
            >
              {labels.cancel}
            </button>
          )}
        </div>
      ) : null}

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
          <div style={{ fontSize: 13, color: "var(--ps-text-muted)", marginBottom: 8 }}>
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
                busy || stage === "previewing" || missingRequired.length > 0
              }
            >
              {stage === "previewing" ? labels.loading : labels.previewImport}
            </button>
            <button
              type="button"
              className="ps-btn ps-btn--ghost"
              onClick={() => {
                setStage("idle");
                setPreview(null);
                setEditableTeams([]);
              }}
              disabled={busy}
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      ) : null}

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
          <div style={{ fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
            {labels.teamsToCreate.replace(
              "{count}",
              String(preview.teams_to_create ?? 0)
            )}
          </div>

          {preview.errors && preview.errors.length > 0 ? (
            <details style={{ marginBottom: 12, fontSize: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                {labels.rowErrors.replace(
                  "{count}",
                  String(preview.errors.length)
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

          {editableTeams.length > 0 ? (
            <div style={{ overflowX: "auto", marginBottom: 12 }}>
              <table className="ps-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Logo URL</th>
                    <th aria-label={labels.removeRow} />
                  </tr>
                </thead>
                <tbody>
                  {editableTeams.map((row) => {
                    const invalid = invalidRowIds.has(row.rowId);
                    return (
                      <tr
                        key={row.rowId}
                        style={{
                          background: invalid
                            ? "rgba(244, 67, 54, 0.06)"
                            : "transparent",
                        }}
                      >
                        <td>
                          <input
                            type="text"
                            className="ps-input"
                            style={{ minWidth: 150, fontSize: 12 }}
                            value={row.team_name}
                            onChange={(e) =>
                              updateEditableTeam(row.rowId, {
                                team_name: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="ps-input"
                            style={{ minWidth: 200, fontSize: 12 }}
                            value={row.logo_url}
                            placeholder="https://..."
                            onChange={(e) =>
                              updateEditableTeam(row.rowId, {
                                logo_url: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ps-btn ps-btn--ghost"
                            style={{ padding: "2px 8px", fontSize: 12 }}
                            onClick={() => removeEditableTeam(row.rowId)}
                            disabled={busy}
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
                <div style={{ marginTop: 8, fontSize: 12, color: "#F44336" }}>
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
                busy || editableTeams.length === 0 || invalidRowIds.size > 0
              }
            >
              {labels.confirmImport}
            </button>
            <button
              type="button"
              className="ps-btn ps-btn--ghost"
              onClick={() => {
                setStage("mapping");
                setPreview(null);
                setEditableTeams([]);
              }}
              disabled={busy}
            >
              {labels.backToIdle}
            </button>
          </div>
        </div>
      ) : null}

      {stage === "committing" ? (
        <div style={{ fontSize: 13, color: "var(--ps-text-muted)" }}>
          {labels.loading}…
        </div>
      ) : null}
    </div>
  );
}
