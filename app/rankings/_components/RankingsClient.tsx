"use client";

// Rankings client: owns filter state (tournament + team), column sorting and
// CSV export. Data is pre-aggregated on the server so the client only deals
// with plain row objects.

import Link from "next/link";
import { useMemo, useState } from "react";

export type RankingRow = {
  id: number;
  subject: string;
  team: string | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  goals: number;
  goalsAgainst: number;
  assists: number;
  defenses: number;
  goalsAvg: number;
  assistsAvg: number;
  defensesAvg: number;
  power: number;
  streak: number;
  mvp: string | null;
  tournamentIds: number[];
  /** Spirit (SOTG) average across all games the team has been scored in. */
  spiritAverage: number | null;
  /** Number of games the team has a spirit score recorded for. */
  spiritGames: number;
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
  filterTeam: string;
  allTeams: string;
  team: string;
  player: string;
  goals: string;
  assists: string;
  defenses: string;
  goalsAvg: string;
  assistsAvg: string;
  defensesAvg: string;
  mvp: string;
  power: string;
  gamesPlayed: string;
  gamesPlayedShort: string;
  sortToggle: string;
  wins: string;
  losses: string;
  pf: string;
  pa: string;
  streak: string;
  spirit: string;
};

type Props = {
  tournaments: TournamentOption[];
  teams: RankingRow[];
  players: RankingRow[];
  labels: Labels;
};

type Mode = "teams" | "players";

type SortKey =
  | "subject"
  | "team"
  | "gamesPlayed"
  | "wins"
  | "losses"
  | "goals"
  | "goalsAgainst"
  | "assists"
  | "defenses"
  | "goalsAvg"
  | "assistsAvg"
  | "defensesAvg"
  | "power"
  | "streak"
  | "mvp"
  | "spirit";

type ColumnDef = {
  key: SortKey;
  label: string;
  numeric: boolean;
  sortable: boolean;
};

function buildColumns(mode: Mode, labels: Labels): ColumnDef[] {
  if (mode === "teams") {
    return [
      { key: "subject", label: labels.team, numeric: false, sortable: true },
      { key: "gamesPlayed", label: labels.gamesPlayedShort, numeric: true, sortable: true },
      { key: "wins", label: labels.wins, numeric: true, sortable: true },
      { key: "losses", label: labels.losses, numeric: true, sortable: true },
      { key: "goals", label: labels.pf, numeric: true, sortable: true },
      { key: "goalsAgainst", label: labels.pa, numeric: true, sortable: true },
      { key: "goalsAvg", label: labels.goalsAvg, numeric: true, sortable: true },
      { key: "power", label: labels.power, numeric: true, sortable: true },
      { key: "spirit", label: labels.spirit, numeric: true, sortable: true },
      { key: "mvp", label: labels.mvp, numeric: false, sortable: true },
      { key: "streak", label: labels.streak, numeric: true, sortable: true },
    ];
  }
  return [
    { key: "subject", label: labels.player, numeric: false, sortable: true },
    { key: "team", label: labels.team, numeric: false, sortable: true },
    { key: "gamesPlayed", label: labels.gamesPlayedShort, numeric: true, sortable: true },
    { key: "goals", label: labels.goals, numeric: true, sortable: true },
    { key: "assists", label: labels.assists, numeric: true, sortable: true },
    { key: "defenses", label: labels.defenses, numeric: true, sortable: true },
    { key: "goalsAvg", label: labels.goalsAvg, numeric: true, sortable: true },
    { key: "assistsAvg", label: labels.assistsAvg, numeric: true, sortable: true },
    { key: "defensesAvg", label: labels.defensesAvg, numeric: true, sortable: true },
    // The MVP column is derived client-side (star on the top scorer), so it
    // is not sortable.
    { key: "power", label: labels.mvp, numeric: true, sortable: false },
    { key: "streak", label: labels.streak, numeric: true, sortable: true },
  ];
}

function getValue(row: RankingRow, key: SortKey): string | number {
  switch (key) {
    case "subject":
      return row.subject;
    case "team":
      return row.team ?? "—";
    case "gamesPlayed":
      return row.gamesPlayed;
    case "wins":
      return row.wins;
    case "losses":
      return row.losses;
    case "goals":
      return row.goals;
    case "goalsAgainst":
      return row.goalsAgainst;
    case "assists":
      return row.assists;
    case "defenses":
      return row.defenses;
    case "goalsAvg":
      return row.goalsAvg;
    case "assistsAvg":
      return row.assistsAvg;
    case "defensesAvg":
      return row.defensesAvg;
    case "power":
      return row.power;
    case "streak":
      return row.streak;
    case "mvp":
      return row.mvp ?? "—";
    case "spirit":
      // Rows without a spirit score sort to the bottom regardless of dir.
      return row.spiritAverage ?? -1;
  }
}

/** Trim trailing zeros from a rounded decimal (2.50 → 2.5, 2.00 → 2). */
function formatDecimal(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

const SORT_BUTTON_STYLE: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  color: "inherit",
  fontWeight: "inherit",
  fontFamily: "inherit",
  fontSize: "inherit",
  textAlign: "inherit",
};

export function RankingsClient({
  tournaments,
  teams,
  players,
  labels,
}: Props) {
  const [mode, setMode] = useState<Mode>("teams");
  const [tournamentId, setTournamentId] = useState<"all" | number>("all");
  const [teamFilter, setTeamFilter] = useState<"all" | string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("power");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const source = mode === "teams" ? teams : players;

  const columns = useMemo(() => buildColumns(mode, labels), [mode, labels]);

  // Team dropdown options are derived from the player rows (unique names).
  const teamOptions = useMemo(() => {
    const names = new Set<string>();
    for (const r of players) if (r.team) names.add(r.team);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [players]);

  // Filter by tournament membership and (players only) team name.
  const visible = useMemo(() => {
    let rows = source;
    if (tournamentId !== "all") {
      rows = rows.filter((r) => r.tournamentIds.includes(tournamentId));
    }
    if (mode === "players" && teamFilter !== "all") {
      rows = rows.filter((r) => r.team === teamFilter);
    }
    return rows;
  }, [source, tournamentId, teamFilter, mode]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const def = columns.find((c) => c.key === sortKey);
    const numeric = def?.numeric ?? false;
    const copy = [...visible];
    copy.sort((a, b) => {
      const va = getValue(a, sortKey);
      const vb = getValue(b, sortKey);
      if (numeric) {
        return (Number(va) - Number(vb)) * dir;
      }
      return String(va).localeCompare(String(vb)) * dir;
    });
    return copy;
  }, [visible, sortKey, sortDir, columns]);

  // MVP in players mode = the visible player with the highest power score.
  const playerMvpId = useMemo(() => {
    if (mode !== "players" || sorted.length === 0) return null;
    return sorted.reduce(
      (best, r) => (r.power > best.power ? r : best),
      sorted[0],
    ).id;
  }, [mode, sorted]);

  const onSort = (col: ColumnDef) => {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(col.key);
      setSortDir(col.numeric ? "desc" : "asc");
    }
  };

  // CSV cell escaping per RFC 4180.
  const csvEscape = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const exportCsv = () => {
    const header = columns.map((c) => csvEscape(c.label)).join(",");
    const body = sorted
      .map((r) =>
        columns
          .map((c) => {
            if (c.key === "subject") return csvEscape(r.subject);
            if (c.key === "mvp" && mode === "players") {
              return csvEscape(r.id === playerMvpId ? labels.mvp : "");
            }
            return csvEscape(getValue(r, c.key));
          })
          .join(","),
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

  const renderCell = (row: RankingRow, col: ColumnDef) => {
    if (col.key === "subject") {
      const href = mode === "teams" ? `/teams/${row.id}` : `/players/${row.id}`;
      return (
        <td>
          <Link
            href={href}
            style={{ color: "var(--ps-text)", fontWeight: 600 }}
          >
            {row.subject}
          </Link>
        </td>
      );
    }
    if (col.key === "mvp" && mode === "players") {
      const isMvp = row.id === playerMvpId;
      return (
        <td style={{ textAlign: "right" }}>
          {isMvp ? (
            <span style={{ color: "var(--ps-accent)", fontWeight: 700 }}>
              ★ {labels.mvp}
            </span>
          ) : (
            "—"
          )}
        </td>
      );
    }
    if (col.key === "mvp") {
      return <td>{row.mvp ?? "—"}</td>;
    }
    if (col.key === "spirit") {
      if (row.spiritAverage === null || row.spiritGames === 0) {
        return <td style={{ textAlign: "right" }}>—</td>;
      }
      return (
        <td style={{ textAlign: "right" }} title={`${row.spiritGames} games`}>
          {formatDecimal(row.spiritAverage)}
        </td>
      );
    }
    if (col.key === "streak") {
      return (
        <td style={{ textAlign: "right" }}>
          {row.streak > 0 ? `W${row.streak}` : "—"}
        </td>
      );
    }
    const v = getValue(row, col.key);
    return (
      <td style={col.numeric ? { textAlign: "right" } : undefined}>
        {typeof v === "number"
          ? col.numeric &&
            (col.key === "goalsAvg" ||
              col.key === "assistsAvg" ||
              col.key === "defensesAvg" ||
              col.key === "power")
            ? formatDecimal(v)
            : v
          : v}
      </td>
    );
  };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
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

        {/* Team filter (players mode only — each team row is already a team) */}
        {mode === "players" && (
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--ps-text-muted)" }}>
              {labels.filterTeam}
            </span>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="ps-input"
            >
              <option value="all">{labels.allTeams}</option>
              {teamOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}

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
          disabled={sorted.length === 0}
          className="ps-btn ps-btn--secondary"
          style={{ marginLeft: "auto" }}
        >
          {labels.exportCsv}
        </button>
      </div>

      {sorted.length === 0 ? (
        <p>{labels.noData}</p>
      ) : (
        <div className="ps-card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="ps-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={col.numeric ? { textAlign: "right" } : undefined}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort(col)}
                        style={SORT_BUTTON_STYLE}
                        aria-label={`${labels.sortToggle}: ${col.label}`}
                        title={labels.sortToggle}
                      >
                        {col.label}
                        {sortKey === col.key
                          ? sortDir === "asc"
                            ? " ▲"
                            : " ▼"
                          : ""}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.id}>
                  {columns.map((col) => (
                    <Fragment key={col.key}>{renderCell(row, col)}</Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

// Small local Fragment alias avoids importing React wholesale.
import { Fragment } from "react";
