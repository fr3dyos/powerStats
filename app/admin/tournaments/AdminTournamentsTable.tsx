"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { formatDate, formatDateRange, type Game, type Team, type Tournament } from "@/utils/api";

type Row = {
  tournament: Tournament;
  teams: Team[];
  games: Game[];
};

// Plain-text labels are passed in from the server parent so the client
// component does not need to depend on the i18n runtime. The shape mirrors
// the keys already on `dict.adminTournaments` plus a few new toolbar labels.
type Labels = {
  name: string;
  dates: string;
  teams: string;
  games: string;
  actions: string;
  status: string;
  phaseRoundRobin: string;
  phaseBracket: string;
  phasePending: string;
  phaseInProgress: string;
  phaseCompleted: string;
  notStarted: string;
  inProgress: string;
  completed: string;
  viewTournament: string;
  viewBracket: string;
  newTournament: string;
  editSelected: string;
  deleteSelected: string;
  selectAll: string;
  selectRow: string;
  noneSelected: string;
  oneSelected: string;
  manySelected: string;
  deleteConfirm: string;
};

type AdminTournamentsTableProps = {
  rows: Row[];
  labels: Labels;
};

export default function AdminTournamentsTable({
  rows,
  labels,
}: AdminTournamentsTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const allIds = useMemo(() => rows.map((r) => r.tournament.id), [rows]);
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Pick the first selected row for placeholders that only accept a single
  // target. Buttons stay disabled when nothing is selected so the user is
  // never sent to a placeholder URL blindly.
  const firstSelectedId = useMemo(() => {
    return allIds.find((id) => selectedIds.has(id));
  }, [allIds, selectedIds]);

  const onNew = () => {
    router.push("/admin/tournaments/new");
  };

  const onEditSelected = () => {
    if (firstSelectedId === undefined) return;
    router.push(`/admin/tournaments/${firstSelectedId}/edit`);
  };

  const onDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    // Placeholder: real implementation will trigger a delete flow. We only
    // guard against accidental clicks with a confirm prompt so the UX feels
    // intentional while the API endpoint is still being built.
    const confirmMessage = labels.deleteConfirm.replace(
      "{count}",
      String(selectedIds.size),
    );
    if (typeof window !== "undefined" && window.confirm(confirmMessage)) {
      window.alert("Delete selected: not yet implemented.");
    }
  };

  const selectedCountLabel =
    selectedIds.size === 0
      ? labels.noneSelected
      : selectedIds.size === 1
        ? labels.oneSelected
        : labels.manySelected.replace("{count}", String(selectedIds.size));

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
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="ps-btn ps-btn--primary"
            onClick={onNew}
          >
            {labels.newTournament}
          </button>
          <button
            type="button"
            className="ps-btn ps-btn--secondary"
            onClick={onEditSelected}
            disabled={firstSelectedId === undefined}
          >
            {labels.editSelected}
          </button>
          <button
            type="button"
            className="ps-btn ps-btn--secondary"
            onClick={onDeleteSelected}
            disabled={selectedIds.size === 0}
          >
            {labels.deleteSelected}
          </button>
        </div>
        <span
          aria-live="polite"
          style={{
            fontSize: 12,
            color: "var(--ps-text-muted)",
          }}
        >
          {selectedCountLabel}
        </span>
      </div>

      <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="ps-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label={labels.selectAll}
                />
              </th>
              <th>{labels.name}</th>
              <th>{labels.dates}</th>
              <th style={{ textAlign: "right" }}>{labels.teams}</th>
              <th style={{ textAlign: "right" }}>{labels.games}</th>
              <th style={{ textAlign: "right" }}>{labels.actions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ tournament, teams: tlist, games: glist }) => {
              const completed = glist.filter((g) => g.is_completed).length;
              const isSelected = selectedIds.has(tournament.id);
              return (
                <tr key={tournament.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(tournament.id)}
                      aria-label={`${labels.selectRow} ${tournament.name}`}
                    />
                  </td>
                  <td>
                    <Link
                      href={`/tournaments/${tournament.id}`}
                      style={{
                        color: "var(--ps-text)",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      {tournament.name}
                    </Link>
                    {tournament.location ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--ps-text-muted)",
                        }}
                      >
                        {tournament.location}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <span style={{ fontSize: 13 }}>
                      {formatDateRange(tournament.start_date, tournament.end_date)}
                    </span>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ps-text-muted)",
                      }}
                    >
                      {formatDate(tournament.start_date)} → {formatDate(tournament.end_date)}
                    </div>
                  </td>
                  <td className="ps-table__num" style={{ textAlign: "right" }}>
                    {tlist.length}
                  </td>
                  <td className="ps-table__num" style={{ textAlign: "right" }}>
                    {completed}/{glist.length}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      href={`/tournaments/${tournament.id}`}
                      style={{
                        fontSize: 12,
                        color: "var(--ps-accent)",
                        marginRight: 12,
                      }}
                    >
                      {labels.viewTournament}
                    </Link>
                    <Link
                      href={`/tournaments/${tournament.id}/bracket`}
                      style={{
                        fontSize: 12,
                        color: "var(--ps-accent)",
                      }}
                    >
                      {labels.viewBracket}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
