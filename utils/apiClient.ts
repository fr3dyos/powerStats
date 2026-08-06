/**
 * Browser-side API client.
 *
 * Thin wrapper around `fetch` that:
 *   - Prefixes every call with the Next.js `/api` proxy base.
 *   - Sends/accepts JSON.
 *   - Throws a typed `ApiError` on non-2xx so callers can `try/catch`.
 *   - Returns `undefined` for 204 No Content.
 *
 * Resource helpers (`teamsApi.list`, `playersApi.get`, etc.) are kept
 * deliberately small: they accept typed inputs and return typed outputs,
 * matching the server-side `utils/api.ts` shape so swapping one for the
 * other is mostly an import change.
 *
 * Why a separate client module: the server-side `apiFetch` pulls in
 * `next/headers` for cookie-to-Bearer translation and must never end up
 * in a client bundle. This client assumes the browser always goes
 * through the Next.js `/api/*` proxy, so no cookie parsing is needed.
 */

const BASE = "/api";

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  query?: Query,
): Promise<T> {
  const url = new URL(`${BASE}${path}`, typeof window === "undefined" ? "http://localhost" : window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const init: RequestInit = {
    method,
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  };
  if (body !== undefined) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url.toString(), init);
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
    throw new ApiError(res.status, message, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Entity helpers -------------------------------------------------

export type Team = {
  id: number;
  name: string;
  tournament_id: number;
  logo_url: string | null;
};

export type Player = {
  id: number;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  team_id: number;
};

export type Game = {
  id: number;
  tournament_id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  is_completed: boolean;
  start_time: string | null;
};

export type Tournament = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
};

export const teamsApi = {
  list: (q?: { tournament_id?: number }) =>
    request<Team[]>("GET", "/teams", undefined, q),
  get: (id: number) => request<Team>(`GET`, `/teams/${id}`),
  create: (input: { name: string; tournament_id: number }) =>
    request<Team>("POST", "/teams", input),
  remove: (id: number) => request<void>("DELETE", `/teams/${id}`),
};

export const playersApi = {
  list: (q?: { team_id?: number }) =>
    request<Player[]>("GET", "/players", undefined, q),
  get: (id: number) => request<Player>("GET", `/players/${id}`),
  create: (input: Omit<Player, "id">) =>
    request<Player>("POST", "/players", input),
};

export const gamesApi = {
  list: (q?: { tournament_id?: number }) =>
    request<Game[]>("GET", "/games", undefined, q),
  get: (id: number) => request<Game>("GET", `/games/${id}`),
  recordEvent: (id: number, input: { event_type: string; player_id: number; period: number }) =>
    request<Game>("POST", `/games/${id}/events`, input),
};

export const tournamentsApi = {
  list: (limit = 50) =>
    request<Tournament[]>("GET", "/tournaments", undefined, { limit }),
  get: (id: number) => request<Tournament>("GET", `/tournaments/${id}`),
  create: (input: Omit<Tournament, "id">) =>
    request<Tournament>("POST", "/tournaments", input),
};

export const rankingsApi = {
  teams: () => request<Array<Team & { wins: number }>>("GET", "/rankings/teams"),
  players: () =>
    request<Array<Player & { goals: number }>>("GET", "/rankings/players"),
};
