"use client";

import { useMemo, useState } from "react";

type Props<T> = {
  /** Free-text query the user is typing in. */
  query: string;
  onQueryChange: (next: string) => void;
  /** Placeholder for the search input. */
  placeholder: string;
  /** Optional label showing match count to the right of the search box. */
  countLabel?: string;
};

/**
 * Shared search input used by every list page. The filtering logic lives in
 * each caller — this component only owns the input + optional count.
 */
export function ListSearch<T>({
  query,
  onQueryChange,
  placeholder,
  countLabel,
}: Props<T>) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 16,
      }}
    >
      <input
        type="search"
        className="ps-input"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={placeholder}
        style={{ maxWidth: 320 }}
        aria-label={placeholder}
      />
      {countLabel ? <span className="ps-pill">{countLabel}</span> : null}
    </div>
  );
}

/**
 * Tiny pure helper that returns true if the lower-cased haystack matches the
 * lower-cased needle. Empty-needle matches everything.
 */
export function matchesQuery(
  needle: string,
  fields: Array<string | number | null | undefined>,
): boolean {
  const q = needle.toLowerCase().trim();
  if (!q) return true;
  return fields.some((f) =>
    String(f ?? "")
      .toLowerCase()
      .includes(q),
  );
}

/**
 * Common hook to manage a list query (useState + memoised filter using
 * `matchesQuery`).
 */
export function useFilteredRows<T>(
  rows: T[],
  pickSearchFields: (row: T) => Array<string | number | null | undefined>,
) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => rows.filter((r) => matchesQuery(query, pickSearchFields(r))),
    [rows, query, pickSearchFields],
  );
  return { query, setQuery, filtered };
}
