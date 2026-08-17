"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { teamColor, formatPlayerName } from "@/utils/api";

type PlayerRow = {
  id: number;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  team_id: number;
  team_name: string | null;
};

type Labels = {
  searchPlaceholder: string;
  noPlayers: string;
  resultCount: string;
  name: string;
  jersey: string;
  team: string;
};

export function PlayersList({
  players,
  labels,
}: {
  players: PlayerRow[];
  labels: Labels;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return players;
    return players.filter((p) => {
      const full = `${p.first_name} ${p.last_name}`.toLowerCase();
      const teamName = (p.team_name ?? "").toLowerCase();
      const jersey = p.jersey_number != null ? String(p.jersey_number) : "";
      return (
        full.includes(q) ||
        teamName.includes(q) ||
        jersey.includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.first_name.toLowerCase().includes(q)
      );
    });
  }, [players, query]);

  return (
    <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--ps-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.searchPlaceholder}
          className="ps-input"
          style={{ maxWidth: 320 }}
          aria-label={labels.searchPlaceholder}
        />
        <span className="ps-pill">
          {labels.resultCount.replace("{count}", String(filtered.length))}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <p style={{ color: "var(--ps-text-muted)", margin: 0 }}>
            {labels.noPlayers}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="ps-table">
            <thead>
              <tr>
                <th>{labels.name}</th>
                <th style={{ textAlign: "right", width: 80 }}>{labels.jersey}</th>
                <th>{labels.team}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const teamName = p.team_name ?? "";
                const color = teamColor(teamName);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/players/${p.id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 10,
                          color: "var(--ps-text)",
                          fontWeight: 600,
                        }}
                      >
                        <span
                          className="ps-disc ps-disc--sm"
                          style={{
                            background: color ?? undefined,
                            color: "#fff",
                            borderColor: color ?? undefined,
                          }}
                        >
                          {(p.first_name[0] ?? "").toUpperCase()}
                          {(p.last_name[0] ?? "").toUpperCase()}
                        </span>
                        {formatPlayerName(p)}
                      </Link>
                    </td>
                    <td
                      className="ps-table__num"
                      style={{ textAlign: "right" }}
                    >
                      {p.jersey_number ?? "—"}
                    </td>
                    <td>{teamName || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
