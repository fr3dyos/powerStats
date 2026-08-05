"use server";

import { revalidatePath } from "next/cache";

import { playersApi } from "@/utils/api";

export type CreatePlayerResult =
  | { ok: true; playerId: number }
  | { ok: false; error: string };

/**
 * Server action invoked by the Add-Player form on /admin/players.
 *
 * Forwards the create call to FastAPI (`POST /players`, which requires
 * scorekeeper auth — the apiFetch helper picks up the bearer token from
 * the Supabase session cookies). On success, revalidates the admin pages
 * so the new player shows up immediately.
 */
export async function createPlayerAction(
  formData: FormData,
): Promise<CreatePlayerResult> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const jerseyRaw = String(formData.get("jersey_number") ?? "").trim();
  const teamRaw = String(formData.get("team_id") ?? "").trim();

  if (!firstName || !lastName || !teamRaw) {
    return { ok: false, error: "requiredFields" };
  }

  const teamId = Number(teamRaw);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return { ok: false, error: "requiredFields" };
  }

  let jerseyNumber: number | null = null;
  if (jerseyRaw !== "") {
    const n = Number(jerseyRaw);
    if (Number.isInteger(n) && n >= 0 && n <= 999) {
      jerseyNumber = n;
    }
  }

  try {
    const player = await playersApi.create({
      first_name: firstName,
      last_name: lastName,
      jersey_number: jerseyNumber,
      team_id: teamId,
    });
    revalidatePath("/admin/players");
    revalidatePath(`/teams/${teamId}`);
    revalidatePath("/");
    return { ok: true, playerId: player.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    // The FastAPI 4xx/5xx responses come through as `API <status>: <detail>`
    // from the apiFetch wrapper. If the error indicates a duplicate
    // (status 400 with a uniqueness-shaped message), surface a friendlier
    // key so the UI can show the right copy.
    if (message.includes("400") && /duplicate|already exists|unique/i.test(message)) {
      return { ok: false, error: "playerExists" };
    }
    return { ok: false, error: "playerAddFailed" };
  }
}
