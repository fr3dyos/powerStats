"use server";

import { revalidatePath } from "next/cache";

import { teamsApi } from "@/utils/api";

export type CreateTeamResult =
  | { ok: true; teamId: number }
  | { ok: false; error: string };

/**
 * Server action invoked by the Add-Team form on /admin/teams/new.
 * Forwards the create call to FastAPI `POST /teams` (scorekeeper+ auth).
 */
export async function createTeamAction(
  formData: FormData,
): Promise<CreateTeamResult> {
  const name = String(formData.get("name") ?? "").trim();
  const tournamentRaw = String(formData.get("tournament_id") ?? "").trim();
  const logoUrl = String(formData.get("logo_url") ?? "").trim();
  // Optional uploaded file; if present we POST it to FastAPI after create
  // so the team's ``logo_url`` ends up pointing at the storage bucket.
  const logoFile = formData.get("logo_file");

  if (!name || !tournamentRaw) {
    return { ok: false, error: "requiredFields" };
  }

  const tournamentId = Number(tournamentRaw);
  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    return { ok: false, error: "requiredFields" };
  }

  try {
    const team = await teamsApi.create({
      name,
      tournament_id: tournamentId,
      ...(logoUrl ? { logo_url: logoUrl } : {}),
    });
    if (logoFile instanceof File && logoFile.size > 0) {
      try {
        await teamsApi.uploadLogo(team.id, logoFile);
      } catch (uploadErr) {
        // The team was created but the logo upload failed. Surface a soft
        // failure so the user knows the team exists but the logo didn't
        // stick — they can re-upload from the edit page.
        console.error("team logo upload failed", uploadErr);
      }
    }
    revalidatePath("/admin/teams");
    revalidatePath(`/tournaments/${tournamentId}`);
    revalidatePath("/");
    return { ok: true, teamId: team.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message.includes("400") && /duplicate|already exists|unique/i.test(message)) {
      return { ok: false, error: "teamExists" };
    }
    return { ok: false, error: "teamAddFailed" };
  }
}

export type UpdateTeamResult =
  | { ok: true; teamId: number }
  | { ok: false; error: string };

export async function updateTeamAction(
  teamId: number,
  formData: FormData,
): Promise<UpdateTeamResult> {
  const name = String(formData.get("name") ?? "").trim();
  const tournamentRaw = String(formData.get("tournament_id") ?? "").trim();
  const logoUrl = String(formData.get("logo_url") ?? "").trim();
  const logoFile = formData.get("logo_file");

  if (!name || !tournamentRaw) {
    return { ok: false, error: "requiredFields" };
  }

  const tournamentId = Number(tournamentRaw);
  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    return { ok: false, error: "requiredFields" };
  }

  try {
    const team = await teamsApi.update(teamId, {
      name,
      tournament_id: tournamentId,
      ...(logoUrl ? { logo_url: logoUrl } : {}),
    });
    if (logoFile instanceof File && logoFile.size > 0) {
      try {
        await teamsApi.uploadLogo(team.id, logoFile);
      } catch (uploadErr) {
        console.error("team logo upload failed", uploadErr);
      }
    }
    revalidatePath("/admin/teams");
    revalidatePath(`/tournaments/${tournamentId}`);
    revalidatePath(`/teams/${teamId}`);
    revalidatePath("/");
    return { ok: true, teamId: team.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message.includes("400") && /duplicate|already exists|unique/i.test(message)) {
      return { ok: false, error: "teamExists" };
    }
    return { ok: false, error: "teamUpdateFailed" };
  }
}

export type DeleteTeamResult = { ok: true } | { ok: false; error: string };

export async function deleteTeamAction(
  teamId: number,
): Promise<DeleteTeamResult> {
  try {
    await teamsApi.remove(teamId);
    revalidatePath("/admin/teams");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message.includes("403")) {
      return { ok: false, error: "deleteForbidden" };
    }
    return { ok: false, error: "teamDeleteFailed" };
  }
}
