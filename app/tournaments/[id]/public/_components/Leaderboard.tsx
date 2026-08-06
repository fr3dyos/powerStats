"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatPlayerName, teamColor, type Player, type Team } from "@/utils/api";

export type StatRow = {
  player: Player & { team: Team | undefined };
  value: number;
};

type SortDir = "desc" | "asc";

type LeaderboardProps = {
  title: string;
  rows: StatRow[];
  valueSuffix: string;
  labels: {
    csv: string;
    sort: string;
    rank: string;
    player: string;
    team: string;
  };
  filename: string;
};

function toCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function Leaderboard({
  title,
  rows,
  valueSuffix,
  labels,
  filename,
}: LeaderboardProps) {
  const [dir, setDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const sign = dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const byValue = (a.value - b.value) * sign;
      if (byValue !== 0) return byValue;
      const aName = a.player.team?.name ?? "";
      const bName = b.player.team?.name ?? "";
      return aName.localeCompare(bName);
    });
  }, [rows, dir]);

  const [shown, setShown] = useState(5);
  const visible = sorted.slice(0, shown);
  const hasMore = sorted.length > shown;

  const onExport = () => {
    const header = [labels.rank, labels.player, labels.team, valueSuffix];
    const body = sorted.map((row, i) => [
      String(i + 1),
      formatPlayerName(row.player),
      row.player.team?.name ?? "",
      String(row.value),
    ]);
    const lines = [header, ...body].map((cells) =>
      cells.map(toCsvCell).join(","),
    );
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filename}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ps-card">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          borderBottom: "1px solid var(--ps-border)",
          paddingBottom: 8,
          marginBottom: 8,
        }}
      >
        <h3
          className="ps-leaderboard__title"
          style={{ margin: 0, border: 0, padding: 0 }}
        >
          {title}
        </h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="ps-btn ps-btn--secondary"
            onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
            aria-label={labels.sort}
            title={labels.sort}
            style={{ fontSize: 12, padding: "4px 8px" }}
          >
            {dir === "desc" ? "↓" : "↑"}
          </button>
          <button
            type="button"
            className="ps-btn ps-btn--secondary"
            onClick={onExport}
            style={{ fontSize: 12, padding: "4px 8px" }}
          >
            {labels.csv}
          </button>
        </div>
      </div>

      <div className="ps-leaderboard">
        {sorted.length === 0 ? (
          <p
            style={{ color: "var(--ps-text-muted)", fontSize: 13, margin: 0 }}
          >
            {valueSuffix}
          </p>
        ) : (
          <>
            {visible.map((row, i) => (
              <Link
                key={row.player.id}
                href={`/players/${row.player.id}`}
                className="ps-leaderboard-row"
                style={{ textDecoration: "none" }}
              >
                <span
                  className={
                    i === 0 && dir === "desc"
                      ? "ps-leaderboard-row__rank ps-leaderboard-row__rank--top"
                      : "ps-leaderboard-row__rank"
                  }
                >
                  {i + 1}
                </span>
                <span
                  className="ps-disc ps-disc--sm"
                  style={{
                    background:
                      teamColor(row.player.team?.name) ?? undefined,
                    color: "#fff",
                    borderColor:
                      teamColor(row.player.team?.name) ?? undefined,
                  }}
                >
                  {row.player.team?.name.slice(0, 2).toUpperCase() ?? "—"}
                </span>
                <span>
                  <span className="ps-leaderboard-row__name">
                    {formatPlayerName(row.player)}
                  </span>
                  <span className="ps-leaderboard-row__meta">
                    {" "}
                    · {row.player.team?.name ?? "—"}
                  </span>
                </span>
                <span
                  className={
                    i === 0 && dir === "desc"
                      ? "ps-leaderboard-row__value ps-leaderboard-row__value--accent"
                      : "ps-leaderboard-row__value"
                  }
                >
                  {row.value}
                </span>
              </Link>
            ))}
            {hasMore ? (
              <button
                type="button"
                onClick={() => setShown((s) => s + 5)}
                className="ps-btn ps-btn--ghost"
                style={{
                  fontSize: 12,
                  padding: "6px 10px",
                  alignSelf: "flex-start",
                }}
              >
                {`+${sorted.length - shown} more`}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
