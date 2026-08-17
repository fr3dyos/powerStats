"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { teamColor, type Team } from "@/utils/api-shared";
import { ListSearch, matchesQuery } from "@/app/_components/ListSearch";

type TournamentGroup = {
  tournament: { id: number; name: string };
  teams: Team[];
};

type Labels = {
  searchPlaceholder: string;
  teamCount: string;
  noTeams: string;
  editTeam: string;
};

export function AdminTeamsFilterableList({
  groups,
  labels,
}: {
  groups: TournamentGroup[];
  labels: Labels;
}) {
  const [query, setQuery] = useState("");

  const visibleGroups = useMemo(
    () =>
      groups
        .map((g) => ({
          tournament: g.tournament,
          teams: g.teams.filter((t) =>
            matchesQuery(query, [t.name, g.tournament.name]),
          ),
        }))
        .filter(
          (g) => matchesQuery(query, [g.tournament.name]) || g.teams.length > 0,
        ),
    [groups, query],
  );

  const totalVisible = visibleGroups.reduce((acc, g) => acc + g.teams.length, 0);

  return (
    <>
      <div className="ps-card" style={{ marginBottom: 16, padding: 12 }}>
        <ListSearch
          query={query}
          onQueryChange={setQuery}
          placeholder={labels.searchPlaceholder}
          countLabel={`${totalVisible} match(es)`}
        />
      </div>
      {visibleGroups.length === 0 ? (
        <div className="ps-card" role="status">
          <p style={{ margin: 0 }}>No teams match "{query}".</p>
        </div>
      ) : (
        <div
          className="ps-card-list"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {visibleGroups.map(({ tournament, teams: tlist }) => (
            <div key={tournament.id} className="ps-card">
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <h3 style={{ fontSize: 16 }}>{tournament.name}</h3>
                <span className="ps-pill">
                  {labels.teamCount.replace("{count}", String(tlist.length))}
                </span>
              </header>
              {tlist.length === 0 ? (
                <p style={{ color: "var(--ps-text-muted)", fontSize: 13 }}>
                  {labels.noTeams}
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {tlist.map((t) => {
                    const accent = teamColor(t.name);
                    return (
                      <li
                        key={t.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <Link
                          href={`/teams/${t.id}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            color: "var(--ps-text)",
                            textDecoration: "none",
                            fontWeight: 600,
                            flex: 1,
                            minWidth: 0,
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
                            {t.name.slice(0, 2).toUpperCase()}
                          </span>
                          {t.name}
                        </Link>
                        <Link
                          href={`/admin/teams/${t.id}/edit`}
                          className="ps-btn ps-btn--ghost"
                          aria-label={`${labels.editTeam}: ${t.name}`}
                          title={labels.editTeam}
                          style={{
                            fontSize: 12,
                            padding: "4px 10px",
                          }}
                        >
                          {labels.editTeam}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
