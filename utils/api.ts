/**
 * Tiny REST client for the FastAPI backend.
 *
 * Used by Server Components and Route Handlers to read data without going
 * through Supabase directly. The base URL comes from
 * ``NEXT_PUBLIC_API_URL`` (defaults to the local dev server).
 *
 * Auth: when a Supabase JWT is present in the request cookies we forward
 * it to the FastAPI backend as a Bearer token so role-gated endpoints
 * (``require_scorekeeper`` / ``require_admin``) still authorize correctly.
 *
 * This module imports `next/headers`, so it is **server-only**. Client
 * components should import types and helpers (formatters, `teamColor`,
 * `computeStandings`, etc.) from `./api-shared` instead.
 */

import { cookies } from "next/headers";

// Re-export the client-safe surface so existing server-side callers that
// import types/helpers from `./api` keep working without changes.
export * from "./api-shared";
// Pull types in explicitly so the wrappers below can reference them. The
// `export *` above only re-exports — it doesn't make the names visible to
// the type checker inside this module.
import type {
  Game,
  GameEvent,
  Player,
  Team,
  Tournament,
} from "./api-shared";

const DEFAULT_BASE_URL = "http://localhost:8000";

export type ApiBaseOptions = {
  /** Base URL override; defaults to NEXT_PUBLIC_API_URL or localhost:8000. */
  baseUrl?: string;
};

function resolveBaseUrl(override?: string): string {
  if (override) return override.replace(/\/+$/, "");
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  return DEFAULT_BASE_URL;
}

/**
 * Base64-url decode a Supabase JWT payload cookie fragment.
 *
 * Supabase stores its session (for both the browser and SSR clients) in a
 * cookie named ``sb-<project-ref>-auth-token`` whose value is a base64-url
 * encoded JSON array: ``["<access_token>","<refresh_token>",...]``. We only
 * need the first element (the JWT).
 */
function decodeSupabaseCookieValue(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
      return parsed[0];
    }
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed.access_token === "string") {
      return parsed.access_token;
    }
  } catch {
    /* not a base64 JSON array — fall through */
  }
  return null;
}

/** Read the Supabase access token from the request cookies (if any). */
async function readBearerToken(): Promise<string | null> {
  try {
    const store = await cookies();
    const all = store.getAll();
    for (const { name, value } of all) {
      // Supabase SSR/auth-js stores the session in a cookie named
      // `sb-<project-ref>-auth-token`.
      if (name.startsWith("sb-") && name.endsWith("-auth-token")) {
        const token = decodeSupabaseCookieValue(value);
        if (token) return token;
      }
    }
    // Fallback candidates (legacy / manually curated names).
    const legacyCandidates = [
      "sb-access-token",
      "supabase-auth-token",
      "sb-auth-token",
    ];
    for (const name of legacyCandidates) {
      const value = store.get(name)?.value;
      if (value) {
        if (value.startsWith("{")) {
          try {
            const parsed = JSON.parse(value);
            if (parsed?.access_token) return parsed.access_token;
          } catch {
            /* fall through */
          }
        }
        return value;
      }
    }
  } catch {
    /* not in a request context */
  }
  return null;
}

export type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Skip auth forwarding (used for fully public endpoints). */
  anonymous?: boolean;
  /** Extra headers to merge into the request. */
  headers?: Record<string, string>;
  /** Abort signal. */
  signal?: AbortSignal;
  /** Query string params. */
  query?: Record<string, string | number | boolean | undefined | null>;
};

/** Type-safe wrapper around fetch for the FastAPI backend. */
export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
  base: ApiBaseOptions = {},
): Promise<T> {
  const baseUrl = resolveBaseUrl(base.baseUrl);
  const url = new URL(path.startsWith("/") ? path : `/${path}`, `${baseUrl}/`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (!options.anonymous) {
    const token = await readBearerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    // Next.js caches GETs by default in Server Components; opt out per request.
    cache: "no-store",
  });

  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    const message =
      typeof detail === "object" && detail !== null && "detail" in detail
        ? String((detail as { detail: unknown }).detail)
        : res.statusText;
    const err = new Error(`API ${res.status}: ${message}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- High-level helpers ----------

export const tournamentsApi = {
  list: (limit = 100) =>
    apiFetch<Tournament[]>("/tournaments", { query: { limit } }),
  get: (id: number) => apiFetch<Tournament & { teams: Team[] }>(`/tournaments/${id}`),
};

export const teamsApi = {
  listByTournament: (tournamentId: number) =>
    apiFetch<Team[]>("/teams", { query: { tournament_id: tournamentId } }),
  get: (id: number) =>
    apiFetch<Team & { players: Player[]; home_games: Game[]; away_games: Game[] }>(
      `/teams/${id}`,
    ),
};

export const playersApi = {
  listByTeam: (teamId: number) =>
    apiFetch<Player[]>("/players", { query: { team_id: teamId } }),
  create: (input: {
    first_name: string;
    last_name: string;
    jersey_number: number | null;
    team_id: number;
  }) =>
    apiFetch<Player>("/players", {
      method: "POST",
      body: input,
    }),
  get: (id: number) =>
    apiFetch<Player & { game_events: GameEvent[] }>(`/players/${id}`),
  stats: (id: number) =>
    apiFetch<{
      player: { id: number; first_name: string; last_name: string; jersey_number: number | null; team_id: number };
      total_tournaments: number;
      per_tournament: Array<{
        tournament_id: number;
        tournament_name: string | null;
        games_played: number;
        goals: number;
        assists: number;
        defenses: number;
        goals_conceded: number;
      }>;
      totals: {
        games_played: number;
        goals: number;
        assists: number;
        defenses: number;
        goals_conceded: number;
      };
    }>(`/players/${id}/stats`),
};

export const gamesApi = {
  listByTournament: (tournamentId: number) =>
    apiFetch<Game[]>("/games", { query: { tournament_id: tournamentId } }),
  get: (id: number) =>
    apiFetch<
      Game & {
        home_team: Team;
        away_team: Team;
        tournament: Tournament;
        game_events: GameEvent[];
      }
    >(`/games/${id}`),
  events: (id: number) => apiFetch<GameEvent[]>(`/games/${id}/events`),
};