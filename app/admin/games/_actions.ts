"use server";

import { revalidatePath } from "next/cache";

import { gamesApi, type GameCreateInput } from "@/utils/api";

export type CreateGameResult =
  | { ok: true; gameId: number }
  | { ok: false; error: string };

function parseOptionalInt(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Server action invoked by the Schedule-a-Game form.
 * Forwards the create call to FastAPI `POST /games` (scorekeeper+ auth).
 */
export async function createGameAction(
  formData: FormData,
): Promise<CreateGameResult> {
  const tournamentRaw = String(formData.get("tournament_id") ?? "").trim();
  const homeRaw = String(formData.get("home_team_id") ?? "").trim();
  const awayRaw = String(formData.get("away_team_id") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "").trim();
  const fieldRaw = String(formData.get("field_number") ?? "").trim();
  const gameRule = String(formData.get("game_rule") ?? "").trim();

  const tournamentId = Number(tournamentRaw);
  const homeTeamId = Number(homeRaw);
  const awayTeamId = Number(awayRaw);
  if (
    !Number.isInteger(tournamentId) ||
    tournamentId <= 0 ||
    !Number.isInteger(homeTeamId) ||
    homeTeamId <= 0 ||
    !Number.isInteger(awayTeamId) ||
    awayTeamId <= 0
  ) {
    return { ok: false, error: "requiredFields" };
  }
  if (homeTeamId === awayTeamId) {
    return { ok: false, error: "sameTeam" };
  }
  if (gameRule !== "TIME_LIMIT" && gameRule !== "SCORE_LIMIT") {
    return { ok: false, error: "requiredFields" };
  }

  const timeLimit = parseOptionalInt(String(formData.get("time_limit") ?? ""));
  const scoreLimit = parseOptionalInt(String(formData.get("score_limit") ?? ""));
  const fieldNumber = parseOptionalInt(fieldRaw);
  if (gameRule === "TIME_LIMIT" && timeLimit === null) {
    return { ok: false, error: "requiredFields" };
  }
  if (gameRule === "SCORE_LIMIT" && scoreLimit === null) {
    return { ok: false, error: "requiredFields" };
  }

  const input: GameCreateInput = {
    tournament_id: tournamentId,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    game_rule: gameRule,
    time_limit: timeLimit,
    score_limit: scoreLimit,
    field_number: fieldNumber,
  };
  if (startTime) input.start_time = new Date(startTime).toISOString();

  try {
    const game = await gamesApi.create(input);
    revalidatePath("/admin/tournaments");
    revalidatePath(`/tournaments/${tournamentId}`);
    revalidatePath(`/tournaments/${tournamentId}/bracket`);
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, gameId: game.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message.includes("400") && /same team/i.test(message)) {
      return { ok: false, error: "sameTeam" };
    }
    return { ok: false, error: "gameCreateFailed" };
  }
}

export type CreateGamesBatchResult =
  | { ok: true; created: number }
  | { ok: false; error: string };

/**
 * Server action invoked by the CSV bulk-upload flow. The client parses the
 * CSV into rows (home/away resolved to team ids); this action forwards them
 * to FastAPI `POST /games/batch`.
 */
export async function createGamesBatchAction(
  tournamentId: number,
  games: Omit<GameCreateInput, "tournament_id">[],
): Promise<CreateGamesBatchResult> {
  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    return { ok: false, error: "requiredFields" };
  }
  if (games.length === 0) {
    return { ok: false, error: "invalidCsv" };
  }
  try {
    const created = await gamesApi.createMany(tournamentId, games);
    revalidatePath("/admin/tournaments");
    revalidatePath(`/tournaments/${tournamentId}`);
    revalidatePath(`/tournaments/${tournamentId}/bracket`);
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, created: created.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message.includes("400")) {
      return { ok: false, error: "invalidCsv" };
    }
    return { ok: false, error: "gamesCreateFailed" };
  }
}
