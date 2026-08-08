import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { AppShell } from "@/app/_components/AppShell";
import {
  formatDate,
  gamesApi,
  teamsApi,
  tournamentsApi,
  type Game,
} from "@/utils/api";
import { getServerLocale } from "@/utils/i18n-server";
import { getAuthedUser } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type Params = { id: string };

/** Round sizes for a single-elim pyramid: 1, 2, 4… with any leftover games
 * folded into the first (largest) round. E.g. 8 → [4,2,1,1], 7 → [4,2,1]. */
function buildRoundSizes(total: number): number[] {
  const fromEnd: number[] = [];
  let remaining = total;
  let size = 1;
  while (remaining >= size) {
    fromEnd.push(size);
    remaining -= size;
    size *= 2;
  }
  if (remaining > 0) fromEnd.push(remaining);
  return fromEnd.reverse();
}

/** Label a round by its position: QF / SF / Finals / Placement, or "Round of N". */
function roundLabel(sizes: number[], index: number): string {
  const count = sizes.length;
  const hasPlacement =
    count >= 2 && sizes[count - 1] === 1 && sizes[count - 2] === 1;
  if (hasPlacement && index === count - 1) return "Placement";
  const fromEnd = (hasPlacement ? count - 1 : count) - index;
  if (fromEnd === 1) return "Finals";
  if (fromEnd === 2) return "Semifinals";
  if (fromEnd === 3) return "Quarterfinals";
  if (fromEnd === 4) return "Round of 16";
  if (fromEnd === 5) return "Round of 32";
  return `Round ${index + 1}`;
}

/** Group games by round for the bracket view (earliest games first). */
function groupRounds(games: Game[]) {
  // Sort by start time (if known) then by id, so the earliest fixtures are
  // assigned to the first (largest) round.
  const sorted = [...games].sort((a, b) => {
    const at = a.start_time ? Date.parse(a.start_time) : Number.POSITIVE_INFINITY;
    const bt = b.start_time ? Date.parse(b.start_time) : Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    return a.id - b.id;
  });

  const sizes = buildRoundSizes(sorted.length);
  return sizes.map((size, rIndex) => ({
    label: roundLabel(sizes, rIndex),
    games: sorted.splice(0, size),
  }));
}

/**
 * Draws the tree links between two adjacent rounds using CSS border lines.
 * Each left-round match gets a horizontal stub; each pair of stubs is joined
 * by a vertical stem that merges into a single line feeding the next round.
 * Positions are percentage-based so they line up with the `space-around`
 * layout of the matches (which centers match i of a round of N at (i+.5)/N).
 */
function ConnectorColumn({ leftCount }: { leftCount: number }) {
  const nodes: React.ReactNode[] = [];
  const center = (i: number) => ((i + 0.5) / leftCount) * 100;

  for (let i = 0; i + 1 < leftCount; i += 2) {
    const y1 = center(i);
    const y2 = center(i + 1);
    const yMid = (y1 + y2) / 2;
    nodes.push(
      <span key={i} className="ps-bracket__line ps-bracket__line--h" style={{ top: `${y1}%`, left: 0, width: "50%" }} />,
      <span key={`${i}-b`} className="ps-bracket__line ps-bracket__line--h" style={{ top: `${y2}%`, left: 0, width: "50%" }} />,
      <span key={`${i}-v`} className="ps-bracket__line ps-bracket__line--v" style={{ top: `${y1}%`, left: "50%", height: `${y2 - y1}%` }} />,
      <span key={`${i}-m`} className="ps-bracket__line ps-bracket__line--h" style={{ top: `${yMid}%`, left: "50%", width: "50%" }} />,
    );
  }
  // Odd round size: leave the last match with a stub, no merge.
  if (leftCount % 2 === 1) {
    const y = center(leftCount - 1);
    nodes.push(
      <span key="odd" className="ps-bracket__line ps-bracket__line--h" style={{ top: `${y}%`, left: 0, width: "50%" }} />,
    );
  }
  return <div className="ps-bracket__connector">{nodes}</div>;
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
  const trn = dict.tournament;
  const matchDict = dict.match;

  const { user, role } = await getAuthedUser(await cookies());
  void user;
  const canScore = role === "admin" || role === "scorekeeper";

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
  const rounds = groupRounds(bracketGames);

  return (
<AppShell
      brandSubtitle={`${tournament.name} · ${brk.title}`}
      footerText={common.footer}
      authLinks={[
        { label: trn.backToTournament, href: `/tournaments/${id}`, variant: "ghost" },
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
                  <div
                    key={g.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Link
                      href={`/games/${g.id}`}
                      className="ps-pill"
                      style={{
                        textDecoration: "none",
                        background: "var(--ps-surface-container-high)",
                      }}
                    >
                      {home?.name ?? "?"} {g.home_score}-{g.away_score}{" "}
                      {away?.name ?? "?"}
                    </Link>
                    {canScore ? (
                      <Link
                        href={`/admin/games/${g.id}/score`}
                        className="ps-btn ps-btn--ghost"
                        title={matchDict.scoreAdmin}
                        style={{ fontSize: 11, padding: "4px 10px" }}
                      >
                        {matchDict.score}
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="ps-card" style={{ padding: 16 }}>
          <div className="ps-bracket">
            {rounds.map((round, rIndex) => (
              <Fragment key={round.label}>
                <div className="ps-bracket__round">
                  <div className="ps-bracket__round-title">{round.label}</div>
                  <div className="ps-bracket__round-matches">
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
                    <div
                      key={g.id}
                      className="ps-bracket__match"
                      style={{
                        color: "inherit",
                        borderLeftColor:
                          winner === "home"
                            ? "var(--ps-secondary)"
                            : winner === "away"
                              ? "var(--ps-secondary)"
                              : "var(--ps-border)",
                      }}
                    >
                      <Link
                        href={`/games/${g.id}`}
                        style={{ textDecoration: "none", color: "inherit" }}
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
                      </Link>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          fontSize: 11,
                          color: "var(--ps-text-muted)",
                          marginTop: 4,
                        }}
                      >
                        <span>
                          {formatDate(g.start_time)}
                          {g.field_number
                            ? ` · ${common.field} ${g.field_number}`
                            : ""}
                        </span>
                        {canScore ? (
                          <Link
                            href={`/admin/games/${g.id}/score`}
                            title={matchDict.scoreAdmin}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textDecoration: "none",
                              color: "var(--ps-secondary)",
                            }}
                          >
                            {matchDict.score}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                  </div>
                </div>
                {rIndex < rounds.length - 1 ? (
                  <ConnectorColumn leftCount={round.games.length} />
                ) : null}
              </Fragment>
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
              ← {trn.backToTournament}
            </Link>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
