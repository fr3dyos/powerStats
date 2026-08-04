import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import {
  formatDate,
  gamesApi,
  teamsApi,
  tournamentsApi,
  type Game,
} from "@/utils/api";
import { getServerLocale } from "@/utils/i18n-server";

export const dynamic = "force-dynamic";

type Params = { id: string };

/** Group games by round label (e.g. "4tos", "semis", "Final") for the bracket view. */
function groupRounds(
  games: Game[],
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
    games: Game[];
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
  const { dict } = await getServerLocale();
  const common = dict.common;
  const brk = dict.bracket;
  const nav = dict.navigation;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();

  const [tournament, teams, games] = await Promise.all([
    tournamentsApi.get(id).catch(() => null),
    teamsApi.listByTournament(id).catch(() => []),
    gamesApi.listByTournament(id).catch(() => []),
  ]);
  if (!tournament) notFound();

  const teamMap = new Map<number, { id: number; name: string }>(
    teams.map((t) => [t.id, { id: t.id, name: t.name }] as const),
  );
  const bracketGames = games.filter((g) => g.start_time !== null);
  const liveGames = games.filter((g) => !g.is_completed);
  const rounds = groupRounds(bracketGames, teamMap);

  return (
    <AppShell
      brandSubtitle={`${tournament.name} · Bracket`}
      footerText={common.footer}
      authLinks={[
        { label: "← Tournament hub", href: `/tournaments/${id}`, variant: "ghost" },
        { label: nav.rankings, href: "/rankings", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <div className="ps-section">
          <span className="ps-section__eyebrow">{brk.eyebrow}</span>
          <h1>{brk.title}</h1>
          <p>{brk.subtitle}</p>
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
              <span className="ps-live-pill">{common.liveNow}</span>
              <strong>{liveGames.length}</strong>
              <span style={{ color: "var(--ps-text-muted)" }}>
                {liveGames.length === 1 ? common.game : common.games}{" "}
                {common.inProgress}
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
                        {g.field_number ? ` · ${common.field} ${g.field_number}` : ""}
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
            <h3>{brk.noBracketGames}</h3>
            <p>{brk.noBracketGamesCopy}</p>
            <Link
              href={`/tournaments/${id}`}
              className="ps-btn"
              style={{ marginTop: 12 }}
            >
              ← {common.backToTournament}
            </Link>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
