"use client";

import { useState } from "react";

const TEMPLATE = `team,team_against,score_1,score_2,score_3,score_4,score_5
Calculus Crew,Byte Brigade,4,3,4,4,4
Byte Brigade,Calculus Crew,4,4,3,3,4
`;

type Props = {
  endpoint: string;
  submitLabel: string;
  templateLabel: string;
  pasteLabel: string;
  fileLabel: string;
  successLabel: string;
  failureLabel: string;
  helpLabel: string;
};

type Report = {
  created?: unknown[];
  updated?: unknown[];
  errors?: unknown[];
  [k: string]: unknown;
};

export default function SpiritImportPanel({
  endpoint,
  submitLabel,
  templateLabel,
  pasteLabel,
  fileLabel,
  successLabel,
  failureLabel,
  helpLabel,
}: Props) {
  const [pasted, setPasted] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setReport(null);
    setError(null);
    try {
      let res: Response;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        res = await fetch(endpoint, { method: "POST", body: form });
      } else if (pasted.trim()) {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ filename: "spirit.csv", content: pasted }),
        });
      } else {
        setError(failureLabel);
        setBusy(false);
        return;
      }
      const data: Report = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          (data as { detail?: string }).detail ??
            `HTTP ${res.status}: ${failureLabel}`,
        );
      } else {
        setReport(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : failureLabel);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ps-card" style={{ padding: 16 }}>
      <p style={{ fontSize: 12, color: "var(--ps-text-muted)" }}>{helpLabel}</p>
      <p style={{ fontSize: 12 }}>
        <strong>{templateLabel}</strong>
      </p>
      <pre
        style={{
          fontSize: 11,
          padding: 10,
          background: "var(--ps-surface-container-low)",
          border: "1px solid var(--ps-divider)",
          borderRadius: 6,
          overflowX: "auto",
        }}
      >
        {TEMPLATE}
      </pre>

      <fieldset
        style={{
          border: "1px solid var(--ps-divider)",
          borderRadius: 6,
          padding: 10,
          marginBottom: 12,
        }}
      >
        <legend style={{ fontSize: 12, fontWeight: 600 }}>{pasteLabel}</legend>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={6}
          style={{
            width: "100%",
            fontFamily: "var(--ps-font-mono)",
            fontSize: 12,
            padding: 6,
            borderRadius: 4,
            border: "1px solid var(--ps-divider)",
            background: "var(--ps-surface-container-low)",
          }}
          placeholder={"team,team_against,score_1,score_2,..."}
        />
      </fieldset>

      <fieldset
        style={{
          border: "1px solid var(--ps-divider)",
          borderRadius: 6,
          padding: 10,
          marginBottom: 12,
        }}
      >
        <legend style={{ fontSize: 12, fontWeight: 600 }}>{fileLabel}</legend>
        <input
          type="file"
          accept=".csv,.xlsx,text/csv"
          onChange={(e) =>
            setFile(e.target.files ? e.target.files[0] ?? null : null)
          }
        />
      </fieldset>

      <button
        type="button"
        className="ps-btn ps-btn--primary"
        onClick={submit}
        disabled={busy || (!pasted.trim() && !file)}
      >
        {busy ? "…" : submitLabel}
      </button>

      {error ? (
        <p style={{ color: "var(--ps-error, #c0392b)", marginTop: 12 }}>
          {error}
        </p>
      ) : null}

      {report ? (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "var(--ps-success, #1f7a3a)" }}>{successLabel}</p>
          <pre
            style={{
              fontSize: 11,
              padding: 10,
              background: "var(--ps-surface-container-low)",
              border: "1px solid var(--ps-divider)",
              borderRadius: 6,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(report, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
