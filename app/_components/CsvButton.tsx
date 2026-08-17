"use client";

import Papa from "papaparse";

type Props = {
  /**
   * Stable identifier used as the React `key` if a parent renders multiple
   * buttons. Not strictly required, but recommended.
   */
  filename: string;
  /** Header row + data rows. Each row should be an object so Papa can derive headers. */
  rows: Array<Record<string, unknown>>;
  /** Localised button label, e.g. "Export CSV". */
  label: string;
  /** Optional variant — defaults to ghost. */
  variant?: "ghost" | "secondary" | "primary";
};

export function CsvButton({ filename, rows, label, variant = "ghost" }: Props) {
  const onClick = () => {
    if (!rows || rows.length === 0) {
      // Empty export — still produce a CSV with just the headers from the first
      // object in callers' expectations, but if the caller passes zero rows
      // we just no-op rather than ship an empty file.
      return;
    }
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!rows || rows.length === 0}
      className={`ps-btn ps-btn--${variant}`}
      style={{ fontSize: 12 }}
    >
      {label}
    </button>
  );
}
