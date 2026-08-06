"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  formatDateRange,
  teamColor,
  type Tournament,
} from "@/utils/api";

export type TournamentStatus = "upcoming" | "live" | "completed";

type StatusFilter = "all" | TournamentStatus;

type Copy = {
  teams: string;
  viewTournament: string;
  searchPlaceholder: string;
  filterAll: string;
  filterUpcoming: string;
  filterLive: string;
  filterCompleted: string;
  statusUpcoming: string;
  statusLive: string;
  statusCompleted: string;
  noMatches: string;
};

type Props = {
  tournaments: Tournament[];
  teamCounts: Record<number, number>;
  statuses: Record<number, TournamentStatus>;
  copy: Copy;
};

const FILTERS: { value: StatusFilter; key: keyof Pick<Copy, "filterAll" | "filterUpcoming" | "filterLive" | "filterCompleted"> }[] = [
  { value: "all", key: "filterAll" },
  { value: "upcoming", key: "filterUpcoming" },
  { value: "live", key: "filterLive" },
  { value: "completed", key: "filterCompleted" },
];

const STATUS_LABEL: Record<TournamentStatus, keyof Pick<Copy, "statusUpcoming" | "statusLive" | "statusCompleted">> = {
  upcoming: "statusUpcoming",
  live: "statusLive",
  completed: "statusCompleted",
};

export function TournamentBrowser({ tournaments, teamCounts, statuses, copy }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: tournaments.length, upcoming: 0, live: 0, completed: 0 };
    for (const t of tournaments) {
      const s = statuses[t.id];
      if (s) c[s] += 1;
    }
    return c;
  }, [tournaments, statuses]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tournaments.filter((t) => {
      if (status !== "all" && statuses[t.id] !== status) return false;
      if (!q) return true;
      const haystack = `${t.name ?? ""} ${t.location ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [tournaments, query, status, statuses]);

  return (
    <>
      <div
        className="ps-toolbar"
        role="search"
        aria-label="Filter tournaments"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          margin: "20px 0 16px",
        }}
      >
        <input
          type="search"
          className="ps-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.searchPlaceholder}
          aria-label={copy.searchPlaceholder}
          style={{ flex: "1 1 220px", minWidth: 200 }}
        />
        <div
          className="ps-lang-switcher"
          role="group"
          aria-label="Status filter"
          style={{ flexWrap: "wrap" }}
        >
          {FILTERS.map((f) => {
            const active = status === f.value;
            const label = copy[f.key];
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatus(f.value)}
                className={`ps-lang-btn${active ? " ps-lang-btn--active" : ""}`}
                aria-pressed={active}
              >
                {label} <span aria-hidden="true">({counts[f.value]})</span>
              </button>
            );
          })}
        </div>
      </div>

      {tournaments.length === 0 ? (
        <div className="ps-card">
          <h3>—</h3>
          <p>—</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="ps-card" role="status">
          <p style={{ margin: 0 }}>{copy.noMatches}</p>
        </div>
      ) : (
        <div className="ps-card-list">
          {visible.map((t) => {
            const accent = teamColor(t.name);
            const statusKey = statuses[t.id];
            const statusLabel = statusKey ? copy[STATUS_LABEL[statusKey]] : null;
            return (
              <Link
                key={t.id}
                href={`/tournaments/${t.id}`}
                className="ps-card ps-card--linked"
                style={{
                  borderLeft: accent
                    ? `3px solid ${accent}`
                    : "3px solid var(--ps-primary-container)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="ps-pill">
                      {teamCounts[t.id] ?? 0} {copy.teams}
                    </span>
                    {statusLabel ? (
                      <span
                        className="ps-pill"
                        data-status={statusKey}
                        style={{
                          background:
                            statusKey === "live"
                              ? "rgba(244, 67, 54, 0.15)"
                              : statusKey === "completed"
                                ? "var(--ps-surface-container-high)"
                                : "rgba(76, 175, 80, 0.15)",
                          color:
                            statusKey === "live"
                              ? "#F44336"
                              : statusKey === "completed"
                                ? "var(--ps-text-muted)"
                                : "#2E7D32",
                        }}
                      >
                        {statusKey === "live" ? "● " : ""}
                        {statusLabel}
                      </span>
                    ) : null}
                  </div>
                  <span
                    className="ps-card__icon"
                    aria-hidden="true"
                    style={{
                      background: accent ?? "var(--ps-surface-container-high)",
                      color: "#fff",
                    }}
                  >
                    {(t.name ?? "?").slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <h3 style={{ marginTop: 8 }}>{t.name}</h3>
                <p style={{ fontSize: 13 }}>
                  {formatDateRange(t.start_date, t.end_date)}
                </p>
                {t.location ? (
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--ps-text-muted)",
                      margin: 0,
                    }}
                  >
                    📍 {t.location}
                  </p>
                ) : null}
                <span className="ps-card__footer">{copy.viewTournament} →</span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
