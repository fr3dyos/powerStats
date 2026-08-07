/**
 * Client-safe API surface: type definitions, formatting helpers, and color
 * helpers shared between server and client components.
 *
 * Anything that touches the network (`apiFetch`, the typed `*Api` wrappers)
 * lives in `./api.ts` because it depends on `next/headers` cookies for auth
 * forwarding and is therefore server-only.
 *
 * Server Components and Route Handlers should keep importing from
 * `./api`; client components should import the helpers and types from
 * here so they don't pull `next/headers` into the browser bundle.
 */

export type GameRule = "time_limit" | "score_limit";

export type Tournament = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  location: string | null;
  description: string | null;
  created_at: string;
  updated_at: string | null;
};

export type Team = {
  id: number;
  name: string;
  tournament_id: number;
  logo_url: string | null;
  created_at: string;
  updated_at: string | null;
};

export type Player = {
  id: number;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  team_id: number;
  created_at: string;
  updated_at: string | null;
};

export type Game = {
  id: number;
  tournament_id: number;
  home_team_id: number;
  away_team_id: number;
  start_time: string | null;
  end_time: string | null;
  home_score: number;
  away_score: number;
  game_rule: GameRule;
  time_limit: number | null;
  score_limit: number | null;
  field_number: number | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string | null;
  home_team?: Team;
  away_team?: Team;
};

export type GameEventType =
  | "goal"
  | "assist"
  | "defense"
  | "timeout"
  | "half"
  | "substitution";

export type GameEvent = {
  id: number;
  game_id: number;
  player_id: number;
  event_type: GameEventType;
  points: number;
  time_elapsed: number | null;
  period: number | null;
  created_at: string;
};

export type PlayerTournamentStats = {
  id: number;
  player_id: number;
  tournament_id: number;
  games_played: number;
  goals: number;
  assists: number;
  defenses: number;
  goals_conceded: number;
  created_at: string;
  updated_at: string | null;
};

export type PhaseType = "round_robin" | "bracket";

export type PhaseStatus = "pending" | "in_progress" | "completed";

export type Phase = {
  id: number;
  tournament_id: number;
  name: string;
  phase_order: number;
  phase_type: PhaseType;
  status: PhaseStatus;
  status_mode: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string | null;
};

/** Compute a Round-Robin "W-L / Diff / GF / GA" standings table. */
export function computeStandings(teams: Team[], games: Game[]) {
  const rows = new Map<
    number,
    { team: Team; wins: number; losses: number; gf: number; ga: number; diff: number; played: number }
  >();
  for (const team of teams) {
    rows.set(team.id, {
      team,
      wins: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      diff: 0,
      played: 0,
    });
  }
  for (const game of games) {
    const home = rows.get(game.home_team_id);
    const away = rows.get(game.away_team_id);
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    home.gf += game.home_score;
    home.ga += game.away_score;
    away.gf += game.away_score;
    away.ga += game.home_score;
    if (game.home_score === game.away_score) continue;
    if (game.home_score > game.away_score) {
      home.wins += 1;
      away.losses += 1;
    } else {
      away.wins += 1;
      home.losses += 1;
    }
  }
  for (const row of rows.values()) row.diff = row.gf - row.ga;
  return [...rows.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return b.gf - a.gf;
  });
}

/** Format an ISO timestamp into a short human label. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

/** Format a date range from two ISO timestamps. */
export function formatDateRange(start: string, end: string): string {
  return `${formatDate(start)} → ${formatDate(end)}`;
}

/** Format a player full name; tolerates missing parts. */
export function formatPlayerName(p: Pick<Player, "first_name" | "last_name">): string {
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
}

/** Color hint for a team name (matches the HatRio color teams). */
export function teamColor(name: string | undefined | null): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("amarelo") || n.includes("yellow")) return "#FFC107";
  if (n.includes("azul") || n.includes("blue")) return "#2196F3";
  if (n.includes("cinza") || n.includes("gray")) return "#9E9E9E";
  if (n.includes("rosa") || n.includes("pink")) return "#EC407A";
  if (n.includes("verde") || n.includes("green")) return "#4CAF50";
  if (n.includes("vermelho") || n.includes("red")) return "#F44336";
  return null;
}