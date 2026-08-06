"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatPlayerName, teamColor, type Player, type Team } from "@/utils/api-shared";

type PlayerRow = Player & { team: Team | undefined };

type Labels = {
  player: string;
  team: string;
  jersey: string;
  actions: string;
  searchPlayers: string;
  edit: string;
  delete: string;
  deleteComingSoon: string;
  noPlayerMatches: string;
};

type AdminPlayersTableProps = {
  rows: PlayerRow[];
  labels: Labels;
};

export default function AdminPlayersTable({ rows, labels }: AdminPlayersTableProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) => {
      const name = formatPlayerName(p).toLowerCase();
      const teamName = p.team?.name.toLowerCase() ?? "";
      return name.includes(q) || teamName.includes(q);
    });
  }, [rows, query]);

  const handleDelete = (player: PlayerRow) => {
    // Backend not implemented yet — surface the placeholder so the user
    // sees the action exists rather than a silent click.
    if (typeof window === "undefined") return;
    const playerName = formatPlayerName(player);
    window.alert(`${labels.deleteComingSoon}\n\n${playerName}`);
  };

  return (
    <>
      <div
        className="ps-card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
          padding: 12,
        }}
      >
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            flex: 1,
            minWidth: 220,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ps-text-muted)",
            }}
          >
            {labels.searchPlayers}
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchPlayers}
            className="ps-input"
            autoComplete="off"
          />
        </label>
        <span
          aria-live="polite"
          style={{
            fontSize: 12,
            color: "var(--ps-text-muted)",
          }}
        >
          {filtered.length}/{rows.length}
        </span>
      </div>

      <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="ps-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>{labels.player}</th>
              <th>{labels.team}</th>
              <th style={{ textAlign: "right" }}>{labels.jersey}</th>
              <th style={{ textAlign: "right" }}>{labels.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "center",
                    color: "var(--ps-text-muted)",
                    fontSize: 13,
                    padding: 16,
                  }}
                >
                  {labels.noPlayerMatches}
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => {
                const accent = teamColor(p.team?.name);
                return (
                  <tr key={p.id}>
                    <td className="ps-table__rank">{i + 1}</td>
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
                            background: accent ?? undefined,
                            color: "#fff",
                            borderColor: accent ?? undefined,
                          }}
                        >
                          {p.team?.name.slice(0, 2).toUpperCase() ?? "—"}
                        </span>
                        {formatPlayerName(p)}
                      </Link>
                    </td>
                    <td>
                      {p.team ? (
                        <Link
                          href={`/teams/${p.team.id}`}
                          style={{ color: "var(--ps-text)" }}
                        >
                          {p.team.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="ps-table__num" style={{ textAlign: "right" }}>
                      {p.jersey_number ?? "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          gap: 6,
                          justifyContent: "flex-end",
                        }}
                      >
                        <Link
                          href={`/admin/players/${p.id}/edit`}
                          className="ps-btn ps-btn--ghost"
                          aria-label={`${labels.edit}: ${formatPlayerName(p)}`}
                          title={labels.edit}
                          style={{
                            fontSize: 12,
                            padding: "4px 10px",
                          }}
                        >
                          {labels.edit}
                        </Link>
                        <button
                          type="button"
                          className="ps-btn ps-btn--ghost"
                          onClick={() => handleDelete(p)}
                          aria-label={`${labels.delete}: ${formatPlayerName(p)}`}
                          title={labels.delete}
                          style={{
                            fontSize: 12,
                            padding: "4px 10px",
                          }}
                        >
                          {labels.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}