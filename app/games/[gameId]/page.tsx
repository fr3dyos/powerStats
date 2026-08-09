import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import {
  formatDate,
  gamesApi,
  playersApi,
  teamColor,
  type GameEvent,
} from "@/utils/api";
import { getServerLocale } from "@/utils/i18n-server";

export const dynamic = "force-dynamic";

type Params = { gameId: string };

const EVENT_LABEL_KEY: Record<GameEvent["event_type"], string> = {
  goal: "goal",
  assist: "assist",
  defense: "defense",
  timeout: "timeout",
  half: "half",
};

type PlayerAgg = {
  goals: number;
  assists: number;
  defenses: number;
  power: number;
};

/**
 * Simple step-line chart of the cumulative score for each team over the
 * length of the match. The x axis is match time in minutes (from each goal
 * event's `time_elapsed`, which the backend stores in seconds); the y axis is
 * the running goal count. Pure SVG, no charting dependency.
 */
function MatchEvolution({
  homeName,
  awayName,
  homeAccent,
  awayAccent,
  homeTimes,
  awayTimes,
  timeLimitMinutes,
  minLabel,
}: {
  homeName: string;
  awayName: string;
  homeAccent: string | null;
  awayAccent: string | null;
  homeTimes: number[];
  awayTimes: number[];
  timeLimitMinutes: number | null;
  minLabel: string;
}) {
  const W = 640;
  const H = 230;
  const PAD_L = 40;
  const PAD_R = 20;
  const PAD_T = 18;
  const PAD_B = 30;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const all = [...homeTimes, ...awayTimes];
  if (all.length === 0) return null;

  const maxGoals = Math.max(homeTimes.length, awayTimes.length, 1);
  const maxX = Math.max(10, ...all, timeLimitMinutes ?? 0) || Math.max(...all, 10);
  const x = (t: number) => PAD_L + (t / maxX) * plotW;
  const y = (s: number) => PAD_T + plotH - (s / maxGoals) * plotH;

  const pathFor = (times: number[]) => {
    const pts = [`${PAD_L},${y(0)}`];
    times.forEach((t, i) => {
      pts.push(`${x(t)},${y(i)}`, `${x(t)},${y(i + 1)}`);
    });
    pts.push(`${PAD_L + plotW},${y(times.length)}`);
    return pts.join(" ");
  };

  // Grid: vertical lines every 10 minutes, horizontal lines per goal.
  const vGrid = [];
  for (let t = 10; t <= maxX; t += 10) {
    vGrid.push(
      <line
        key={`v${t}`}
        x1={x(t)}
        y1={PAD_T}
        x2={x(t)}
        y2={PAD_T + plotH}
        stroke="var(--ps-border)"
        strokeWidth={1}
        strokeDasharray="3 4"
      />,
    );
  }
  const hGrid = [];
  for (let s = 1; s <= maxGoals; s++) {
    hGrid.push(
      <line
        key={`h${s}`}
        x1={PAD_L}
        y1={y(s)}
        x2={PAD_L + plotW}
        y2={y(s)}
        stroke="var(--ps-border)"
        strokeWidth={1}
        strokeDasharray="3 4"
      />,
    );
  }
  const xTicks = [];
  for (let t = 10; t <= maxX; t += 10) {
    xTicks.push(
      <text
        key={`xt${t}`}
        x={x(t)}
        y={H - 8}
        textAnchor="middle"
        fontSize={10}
        fill="var(--ps-text-muted)"
      >
        {t}
      </text>,
    );
  }
  const yTicks = [];
  for (let s = 1; s <= maxGoals; s++) {
    yTicks.push(
      <text
        key={`yt${s}`}
        x={PAD_L - 6}
        y={y(s) + 3}
        textAnchor="end"
        fontSize={10}
        fill="var(--ps-text-muted)"
      >
        {s}
      </text>,
    );
  }

  // Header labels drawn side-by-side at the top of the chart.
  const awayLabelX = PAD_L + Math.min(homeName.length, 18) * 7 + 16;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${homeName} vs ${awayName}`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {vGrid}
      {hGrid}
      {/* Away first so home draws on top */}
      <polyline
        points={pathFor(awayTimes)}
        fill="none"
        stroke={awayAccent ?? "var(--ps-text-muted)"}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <polyline
        points={pathFor(homeTimes)}
        fill="none"
        stroke={homeAccent ?? "var(--ps-text)"}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {/* Goal dots */}
      {awayTimes.map((t, i) => (
        <circle
          key={`a${i}`}
          cx={x(t)}
          cy={y(i + 1)}
          r={3.5}
          fill={awayAccent ?? "var(--ps-text-muted)"}
        />
      ))}
      {homeTimes.map((t, i) => (
        <circle
          key={`h${i}`}
          cx={x(t)}
          cy={y(i + 1)}
          r={3.5}
          fill={homeAccent ?? "var(--ps-text)"}
        />
      ))}
      <text x={PAD_L} y={12} fontSize={11} fontWeight={700} fill={homeAccent ?? "var(--ps-text)"}>
        {homeName}
      </text>
      <text x={awayLabelX} y={12} fontSize={11} fontWeight={700} fill={awayAccent ?? "var(--ps-text-muted)"}>
        {awayName}
      </text>
      <text
        x={PAD_L + plotW / 2}
        y={H - 4}
        textAnchor="middle"
        fontSize={11}
        fill="var(--ps-text-muted)"
      >
        {minLabel}
      </text>
      {xTicks}
      {yTicks}
    </svg>
  );
}

export default async function PublicMatchPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { dict } = await getServerLocale();
  const c = dict.common;
  const m = dict.match;
  const nav = dict.navigation;

  const { gameId: raw } = await params;
  const gameId = Number(raw);
  if (!Number.isFinite(gameId)) notFound();

  const game = await gamesApi.get(gameId).catch(() => null);
  if (!game) notFound();

  const home = game.home_team;
  const away = game.away_team;
  const accentHome = teamColor(home.name);
  const accentAway = teamColor(away.name);

  // Fetch rosters so we can resolve player names, attribute goals to a side,
  // and link every name to its profile page.
  const [homePlayers, awayPlayers] = await Promise.all([
    playersApi.listByTeam(home.id).catch(() => []),
    playersApi.listByTeam(away.id).catch(() => []),
  ]);
  const homeIds = new Set(homePlayers.map((p) => p.id));
  const awayIds = new Set(awayPlayers.map((p) => p.id));
  const playerNameMap = new Map<number, string>();
  for (const p of [...homePlayers, ...awayPlayers]) {
    const name = `${p.first_name} ${p.last_name}`.trim();
    playerNameMap.set(p.id, name);
  }
  const playerTeamMap = new Map<number, { id: number; name: string }>();
  for (const p of homePlayers) playerTeamMap.set(p.id, { id: home.id, name: home.name });
  for (const p of awayPlayers) playerTeamMap.set(p.id, { id: away.id, name: away.name });

  const status: "live" | "completed" | "scheduled" = game.is_completed
    ? "completed"
    : game.home_score > 0 || game.away_score > 0
      ? "live"
      : "scheduled";

  const events = game.game_events ?? [];

  // --- Per-player aggregates from this match's events only.
  const playerAgg = new Map<number, PlayerAgg>();
  for (const ev of events) {
    if (!ev.player_id) continue;
    const agg = playerAgg.get(ev.player_id) ?? { goals: 0, assists: 0, defenses: 0, power: 0 };
    if (ev.event_type === "goal") agg.goals += 1;
    else if (ev.event_type === "assist") agg.assists += 1;
    else if (ev.event_type === "defense") agg.defenses += 1;
    playerAgg.set(ev.player_id, agg);
  }
  for (const agg of playerAgg.values()) {
    // Same weighting as the league-wide power score in /rankings.
    agg.power = agg.goals + agg.assists * 0.7 + agg.defenses * 0.5;
  }

  // Player of the Match = the highest-power participant with any event.
  let pom: { id: number; name: string; teamId: number; teamName: string; agg: PlayerAgg } | null = null;
  for (const [pid, agg] of playerAgg) {
    const team = playerTeamMap.get(pid);
    if (!team || agg.goals + agg.assists + agg.defenses === 0) continue;
    const entry = {
      id: pid,
      name: playerNameMap.get(pid) ?? `#${pid}`,
      teamId: team.id,
      teamName: team.name,
      agg,
    };
    if (!pom || agg.power > pom.agg.power) pom = entry;
  }

  // Top scorers / assisters for this match only (ranked, top 10).
  const rankPlayers = (key: "goals" | "assists", other: "goals" | "assists") =>
    [...playerAgg.entries()]
      .filter(([, a]) => a[key] > 0)
      .sort((a, b) => b[1][key] - a[1][key] || b[1][other] - a[1][other])
      .slice(0, 10);
  const scorers = rankPlayers("goals", "assists");
  const assisters = rankPlayers("assists", "goals");

  // --- Match evolution: cumulative goal times (minutes) per side.
  const toMinutes = (ev: GameEvent) =>
    ev.time_elapsed == null ? null : ev.time_elapsed / 60;
  const homeGoalTimes = events
    .filter((ev) => ev.event_type === "goal" && homeIds.has(ev.player_id))
    .map(toMinutes)
    .filter((t): t is number => t != null)
    .sort((a, b) => a - b);
  const awayGoalTimes = events
    .filter((ev) => ev.event_type === "goal" && awayIds.has(ev.player_id))
    .map(toMinutes)
    .filter((t): t is number => t != null)
    .sort((a, b) => a - b);

  const renderLeaderCell = (pid: number, rank: number, value: number) => (
    <tr key={pid}>
      <td className="ps-table__num">{rank + 1}</td>
      <td>
        <Link
          href={`/players/${pid}`}
          style={{ color: "var(--ps-text)", fontWeight: 600 }}
        >
          {playerNameMap.get(pid) ?? `#${pid}`}
        </Link>
        {playerTeamMap.get(pid) ? (
          <span style={{ color: "var(--ps-text-muted)", fontSize: 11, display: "block" }}>
            <Link
              href={`/teams/${playerTeamMap.get(pid)!.id}`}
              style={{ color: "inherit" }}
            >
              {playerTeamMap.get(pid)!.name}
            </Link>
          </span>
        ) : null}
      </td>
      <td className="ps-table__num" style={{ textAlign: "right" }}>
        {value}
      </td>
    </tr>
  );

  return (
    <AppShell
      brandSubtitle={`${home.name} vs ${away.name} · ${m.title}`}
      footerText={c.footer}
      authLinks={[
        {
          label: m.backToTournament,
          href: game.tournament ? `/tournaments/${game.tournament.id}` : "/tournaments",
          variant: "ghost",
        },
        {
          label: m.backToBracket,
          href: game.tournament
            ? `/tournaments/${game.tournament.id}/bracket`
            : "/tournaments",
          variant: "ghost",
        },
        { label: nav.rankings, href: "/rankings", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link
              href={`/teams/${home.id}`}
              className="ps-disc ps-disc--lg"
              style={{
                background: accentHome ?? undefined,
                color: "#fff",
                borderColor: accentHome ?? undefined,
                textDecoration: "none",
              }}
            >
              {home.name.slice(0, 2).toUpperCase()}
            </Link>
            <span
              style={{
                fontFamily: "Montserrat, Inter, sans-serif",
                fontWeight: 800,
                fontSize: 28,
              }}
            >
              vs
            </span>
            <Link
              href={`/teams/${away.id}`}
              className="ps-disc ps-disc--lg"
              style={{
                background: accentAway ?? undefined,
                color: "#fff",
                borderColor: accentAway ?? undefined,
                textDecoration: "none",
              }}
            >
              {away.name.slice(0, 2).toUpperCase()}
            </Link>
          </div>
          <div>
            <span className="ps-section__eyebrow">
              {game.tournament?.name ?? c.tournament} · {m.gameLabel} #{game.id}
            </span>
            <h1 style={{ marginTop: 4 }}>
              <Link
                href={`/teams/${home.id}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {home.name}
              </Link>{" "}
              vs{" "}
              <Link
                href={`/teams/${away.id}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {away.name}
              </Link>
            </h1>
            <p style={{ color: "var(--ps-text-muted)", marginTop: 4 }}>
              {formatDate(game.start_time)}
              {game.field_number ? ` · ${c.field} ${game.field_number}` : ""} ·{" "}
              {status === "live"
                ? c.liveNow
                : status === "completed"
                  ? c.completed
                  : c.scheduled}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value ps-stat-tile__value--accent">
              {game.home_score}
            </span>
            <Link
              href={`/teams/${home.id}`}
              className="ps-stat-tile__label"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {home.name}
            </Link>
          </div>
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value ps-stat-tile__value--accent">
              {game.away_score}
            </span>
            <Link
              href={`/teams/${away.id}`}
              className="ps-stat-tile__label"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {away.name}
            </Link>
          </div>
          <div className="ps-stat-tile">
            <span className="ps-stat-tile__value">
              {game.time_limit ? `${game.time_limit}′` : "—"}
            </span>
            <span className="ps-stat-tile__label">{m.timeLimit}</span>
          </div>
        </div>

        {/* Player of the Match */}
        {pom ? (
          <div
            className="ps-card"
            style={{
              padding: 20,
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              borderLeftWidth: 3,
              borderLeftColor: "var(--ps-secondary)",
            }}
          >
            <span
              className="ps-disc ps-disc--lg"
              style={{
                background: "var(--ps-secondary)",
                color: "#fff",
                borderColor: "var(--ps-secondary)",
                fontWeight: 800,
              }}
            >
              ★
            </span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <span className="ps-section__eyebrow">{m.playerOfTheMatch}</span>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
                <Link
                  href={`/players/${pom.id}`}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {pom.name}
                </Link>
              </div>
              <div style={{ color: "var(--ps-text-muted)", fontSize: 13 }}>
                <Link href={`/teams/${pom.teamId}`} style={{ color: "inherit" }}>
                  {pom.teamName}
                </Link>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { label: c.goals, value: pom.agg.goals },
                { label: c.assists, value: pom.agg.assists },
                { label: c.defenses, value: pom.agg.defenses },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    textAlign: "center",
                    minWidth: 64,
                    padding: "8px 12px",
                    borderRadius: 12,
                    background: "var(--ps-surface-container-high)",
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "var(--ps-text-muted)" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Top scorers / assists for this match */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
            <header
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--ps-border)",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {m.topScorers}
            </header>
            {scorers.length === 0 ? (
              <p style={{ color: "var(--ps-text-muted)", padding: 16, fontSize: 13 }}>
                {m.noEvents}
              </p>
            ) : (
              <table className="ps-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{c.player}</th>
                    <th style={{ textAlign: "right" }}>{c.goals}</th>
                  </tr>
                </thead>
                <tbody>
                  {scorers.map(([pid, agg], i) => renderLeaderCell(pid, i, agg.goals))}
                </tbody>
              </table>
            )}
          </div>

          <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
            <header
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--ps-border)",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {m.topAssists}
            </header>
            {assisters.length === 0 ? (
              <p style={{ color: "var(--ps-text-muted)", padding: 16, fontSize: 13 }}>
                {m.noEvents}
              </p>
            ) : (
              <table className="ps-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{c.player}</th>
                    <th style={{ textAlign: "right" }}>{c.assists}</th>
                  </tr>
                </thead>
                <tbody>
                  {assisters.map(([pid, agg], i) => renderLeaderCell(pid, i, agg.assists))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Match evolution graph */}
        {homeGoalTimes.length + awayGoalTimes.length > 0 ? (
          <div className="ps-card" style={{ padding: 16, marginBottom: 24 }}>
            <header
              style={{
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>{m.matchEvolution}</span>
              <span style={{ fontSize: 12, color: "var(--ps-text-muted)" }}>
                {homeGoalTimes.length}–{awayGoalTimes.length}
              </span>
            </header>
            <MatchEvolution
              homeName={home.name}
              awayName={away.name}
              homeAccent={accentHome}
              awayAccent={accentAway}
              homeTimes={homeGoalTimes}
              awayTimes={awayGoalTimes}
              timeLimitMinutes={game.time_limit}
              minLabel={m.minutesShort}
            />
          </div>
        ) : null}

        <div className="ps-card" style={{ padding: 0, overflow: "hidden" }}>
          <header
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--ps-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ fontSize: 18 }}>{m.events}</h2>
            <span className="ps-pill">
              {events.length} {c.gamesPlayed}
            </span>
          </header>
          {events.length === 0 ? (
            <p style={{ color: "var(--ps-text-muted)", padding: 16, fontSize: 13 }}>
              {m.noEvents}
            </p>
          ) : (
            <table className="ps-table">
              <thead>
                <tr>
                  <th>{m.period}</th>
                  <th>{m.event}</th>
                  <th>{c.player}</th>
                  <th style={{ textAlign: "right" }}>{m.points}</th>
                </tr>
              </thead>
              <tbody>
                {events
                  .slice()
                  .sort((a, b) => (a.id - b.id))
                  .map((ev) => (
                    <tr key={ev.id}>
                      <td className="ps-table__num">{ev.period ?? "—"}</td>
                      <td>{EVENT_LABEL_KEY[ev.event_type]}</td>
                      <td>
                        {ev.player_id ? (
                          <Link
                            href={`/players/${ev.player_id}`}
                            style={{ color: "var(--ps-text)", fontWeight: 600 }}
                          >
                            {playerNameMap.get(ev.player_id) ?? `#${ev.player_id}`}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="ps-table__num" style={{ textAlign: "right" }}>
                        {ev.points}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: 24 }}>
          <Link
            href={
              game.tournament
                ? `/tournaments/${game.tournament.id}`
                : "/tournaments"
            }
            className="ps-btn ps-btn--ghost"
          >
            ← {m.backToTournament}
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
