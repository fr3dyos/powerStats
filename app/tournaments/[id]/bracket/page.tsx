import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import {
  formatDate,
  gamesApi,
  teamsApi,
  tournamentsApi,
} from "@/utils/api";

export const dynamic = "force-dynamic";

type Params = { id: string };

/** Group games by round label (e.g. "4tos", "semis", "Final") for the bracket view. */
function groupRounds(
  games: Array<{
    id: number;
    home_team_id: number;
    away_team_id: number;
    home_score: number;
    away_score: number;
    is_completed: boolean;
    start_time: string | null;
  }>,
  teamMap: Map<number, { id: number; name: string }>,
) {
  const total = games.length;
  const roundSize: Record<number, { label: string; size: number }> = {
    4: { label: "Semifinals", size: 2 },
    5: { label: "Semifinals", size: 2 },
    6: { label: "Quarterfinals + semis + finals", size: 3 },
    7: { label: "Quarterfinals + semis + finals", size: 4 },
  };
  const defaultRounds = (n: number) => {
    if (n >= 7) return 4; // QF + SF + F + 3rd-place
    if (n >= 4) return 3; // SF + F + 3rd-place
    return 2;
  };
  const roundCount = roundSize[total]?.size ?? defaultRounds(total);

  // Sort by start time (if known) then by id, then split into rounds of
  // increasing size (smaller earliest rounds come first).
  const sorted = [...games].sort((a, b) => {
    const at = a.start_time ? Date.parse(a.start_time) : Number.POSITIVE_INFINITY;
    const bt = b.start_time ? Date.parse(b.start_time) : Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    return a.id - b.id;
  });

  const rounds: Array<{
    label: string;
    games: typeof sorted;
  }> = [];

  const labels =
    roundCount === 4
      ? ["Quarterfinals", "Semifinals", "Finals", "Placement"]
      : roundCount === 3
        ? ["Semifinals", "Finals", "Placement"]
        : ["Bracket", "Finals"];

  let cursor = 0;
  for (let r = 0; r < roundCount; r++) {
    const slice = Math.max(1, Math.round(sorted.length / roundCount));
    const gamesInRound = sorted.slice(cursor, cursor + slice);
    cursor += slice;
    rounds.push({ label: labels[r] ?? `Round ${r + 1}`, games: gamesInRound });
  }
  // Anything left goes into the last round.
  if (cursor < sorted.length && rounds.length > 0) {
    rounds[rounds.length - 1].games.push(...sorted.slice(cursor));
  }
  return rounds;
}

export default async function TournamentBracketPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();

  const [tournament, teams, games] = await Promise.all([
    tournamentsApi.get(id).catch(() => null),
    teamsApi.listByTournament(id).catch(() => []),
    gamesApi.listByTournament(id).catch(() => []),
  ]);
  if (!tournament) notFound();

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const bracketGames = games.filter((g) => g.start_time !== null);
  const liveGames = games.filter((g) => !g.is_completed);
  const rounds = groupRounds(bracketGames, teamMap);

  return (
    <AppShell
      brandSubtitle={`${tournament.name} · Bracket`}
      authLinks={[
        { label: "← Tournament hub", href: `/tournaments/${id}`, variant: "ghost" },
        { label: "Stats", href: `/tournaments/${id}/public`, variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <div className="ps-section">
          <span className="ps-section__eyebrow">Tournament bracket</span>
          <h1>Playoffs &amp; live rounds</h1>
          <p>
            Every fixture from the bracket phase — quarterfinals, semifinals,
            finals, and the consolation games that decide 3rd and 5th place.
          </p>
        </div>

        {liveGames.length > 0 ? (
          <div
            className="ps-card"
            style={{
              borderColor: "var(--ps-lime)",
              borderLeftWidth: 3,
              borderLeftColor: "var(--ps-lime)",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span className="ps-live-pill">Live now</span>
              <strong>{liveGames.length}</strong>
              <span style={{ color: "var(--ps-text-muted)" }}>
                {liveGames.length === 1 ? "game" : "games"} in progress
              </span>
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              {liveGames.map((g) => {
                const home = teamMap.get(g.home_team_id);
                const away = teamMap.get(g.away_team_id);
                return (
                  <Link
                    key={g.id}
                    href={`/admin/games/${g.id}/score`}
                    className="ps-pill"
                    style={{
                      textDecoration: "none",
                      background: "var(--ps-surface-container-high)",
                    }}
                  >
                    {home?.name ?? "?"} {g.home_score}-{g.away_score}{" "}
                    {away?.name ?? "?"}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="ps-card" style={{ padding: 16 }}>
          <div className="ps-bracket">
            {rounds.map((round) => (
              <div key={round.label} className="ps-bracket__round">
                <div className="ps-bracket__round-title">{round.label}</div>
                {round.games.map((g) => {
                  const home = teamMap.get(g.home_team_id);
                  const away = teamMap.get(g.away_team_id);
                  const winner =
                    g.is_completed && g.home_score !== g.away_score
                      ? g.home_score > g.away_score
                        ? "home"
                        : "away"
                      : null;
                  return (
                    <Link
                      key={g.id}
                      href={`/admin/games/${g.id}/score`}
                      className="ps-bracket__match"
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                        borderLeftColor:
                          winner === "home"
                            ? "var(--ps-secondary)"
                            : winner === "away"
                              ? "var(--ps-secondary)"
                              : "var(--ps-border)",
                      }}
                    >
                      <div
                        className={
                          winner === "home"
                            ? "ps-bracket__team ps-bracket__team--winner"
                            : "ps-bracket__team"
                        }
                      >
                        <span>{home?.name ?? "TBD"}</span>
                        <span className="ps-bracket__team-score">
                          {g.home_score}
                        </span>
                      </div>
                      <div
                        className={
                          winner === "away"
                            ? "ps-bracket__team ps-bracket__team--winner"
                            : "ps-bracket__team"
                        }
                      >
                        <span>{away?.name ?? "TBD"}</span>
                        <span className="ps-bracket__team-score">
                          {g.away_score}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--ps-text-muted)",
                          marginTop: 4,
                        }}
                      >
                        {formatDate(g.start_time)}
                        {g.field_number ? ` · Field ${g.field_number}` : ""}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {bracketGames.length === 0 ? (
          <div
            className="ps-card"
            style={{ marginTop: 24, textAlign: "center" }}
          >
            <h3>No bracket games yet</h3>
            <p>
              Use the admin dashboard to generate the bracket once the round-robin
              finishes.
            </p>
            <Link
              href={`/tournaments/${id}`}
              className="ps-btn"
              style={{ marginTop: 12 }}
            >
              ← Back to tournament hub
            </Link>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
