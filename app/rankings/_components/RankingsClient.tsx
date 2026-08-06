"use client";

// Rankings client: owns filter state, renders the table, and exports the
// currently-visible rows to CSV via a Blob URL. Data is pre-aggregated on
// the server so the client only deals with plain row objects.

import Link from "next/link";
import { useMemo, useState } from "react";

export type RankingRow = {
  id: number;
  subject: string;
  team: string | null;
  points: number;
  power: number;
  streak: number;
  tournamentIds: number[];
};

type TournamentOption = { id: number; name: string };

type Labels = {
  title: string;
  filterTournament: string;
  allTournaments: string;
  typeTeams: string;
  typePlayers: string;
  exportCsv: string;
  noData: string;
};

type Props = {
  tournaments: TournamentOption[];
  teams: RankingRow[];
  players: RankingRow[];
  labels: Labels;
};

type Mode = "teams" | "players";

const COLUMN_HEADERS: Record<string, string> = {
  subject: "Name",
  team: "Team",
  points: "Points",
  power: "Power score",
  streak: "Streak",
};

export function RankingsClient({
  tournaments,
  teams,
  players,
  labels,
}: Props) {
  const [mode, setMode] = useState<Mode>("teams");
  const [tournamentId, setTournamentId] = useState<"all" | number>("all");

  const source = mode === "teams" ? teams : players;

  // Filter rows by tournament membership; rows with no tournament
  // participation appear under "All tournaments".
  const visible = useMemo(() => {
    if (tournamentId === "all") return source;
    return source.filter((r) => r.tournamentIds.includes(tournamentId));
  }, [source, tournamentId]);

  // CSV cell escaping per RFC 4180.
  const csvEscape = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const exportCsv = () => {
    const header = Object.keys(COLUMN_HEADERS).join(",");
    const body = visible
      .map((r) =>
        [
          csvEscape(r.subject),
          csvEscape(r.team ?? "—"),
          csvEscape(r.points),
          csvEscape(r.power),
          csvEscape(r.streak),
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rankings-${mode}-${tournamentId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const renderRow = (row: RankingRow) => {
    const href =
      mode === "teams" ? `/teams/${row.id}` : `/players/${row.id}`;
    return (
      <tr key={row.id}>
        <td>
          <Link
            href={href}
            style={{ color: "var(--ps-text)", fontWeight: 600 }}
          >
            {row.subject}
          </Link>
        </td>
        <td>{row.team ?? "—"}</td>
        <td style={{ textAlign: "right" }}>{row.points}</td>
        <td style={{ textAlign: "right" }}>{row.power.toFixed(1)}</td>
        <td style={{ textAlign: "right" }}>
          {row.streak > 0 ? `W${row.streak}` : "—"}
        </td>
      </tr>
    );
  };

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{labels.title}</h1>
      </header>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        {/* Tournament filter */}
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--ps-text-muted)" }}>
            {labels.filterTournament}
          </span>
          <select
            value={String(tournamentId)}
            onChange={(e) =>
              setTournamentId(
                e.target.value === "all" ? "all" : Number(e.target.value),
              )
            }
            className="ps-input"
          >
            <option value="all">{labels.allTournaments}</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {/* Type toggle */}
        <div role="group" aria-label="Mode">
          <button
            type="button"
            onClick={() => setMode("teams")}
            aria-pressed={mode === "teams"}
            className={
              mode === "teams"
                ? "ps-btn ps-btn--primary"
                : "ps-btn ps-btn--ghost"
            }
          >
            {labels.typeTeams}
          </button>
          <button
            type="button"
            onClick={() => setMode("players")}
            aria-pressed={mode === "players"}
            className={
              mode === "players"
                ? "ps-btn ps-btn--primary"
                : "ps-btn ps-btn--ghost"
            }
          >
            {labels.typePlayers}
          </button>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          disabled={visible.length === 0}
          className="ps-btn ps-btn--secondary"
          style={{ marginLeft: "auto" }}
        >
          {labels.exportCsv}
        </button>
      </div>

      {visible.length === 0 ? (
        <p>{labels.noData}</p>
      ) : (
        <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="ps-table">
            <thead>
              <tr>
                <th>{COLUMN_HEADERS.subject}</th>
                <th>{COLUMN_HEADERS.team}</th>
                <th style={{ textAlign: "right" }}>{COLUMN_HEADERS.points}</th>
                <th style={{ textAlign: "right" }}>{COLUMN_HEADERS.power}</th>
                <th style={{ textAlign: "right" }}>{COLUMN_HEADERS.streak}</th>
              </tr>
            </thead>
            <tbody>{visible.map(renderRow)}</tbody>
          </table>
        </div>
      )}
    </main>
  );
}