import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { phaseId: string };

/**
 * Forward POST /api/phases/:phaseId/advance → FastAPI
 * /phases/:phaseId/advance.
 *
 * Promotes the top-N teams from each group into the target phase. Used by the
 * bracket page's "advance winner" controls to populate consolation slots.
 *
 * Required query params (forwarded): target_phase_id, teams_per_group
 * (optional, defaults to phase config).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies();
  const { phaseId } = await ctx.params;
  const url = new URL(req.url);
  const target = url.searchParams.get("target_phase_id");
  const teamsPerGroup = url.searchParams.get("teams_per_group");
  if (!target) {
    return NextResponse.json(
      { detail: "target_phase_id query param is required." },
      { status: 400 },
    );
  }
  try {
    const data = await apiFetch(`/phases/${phaseId}/advance`, {
      method: "POST",
      query: {
        target_phase_id: Number(target),
        teams_per_group: teamsPerGroup ? Number(teamsPerGroup) : undefined,
      },
    });
    return NextResponse.json(data);
  } catch (err) {
    const status =
      (err as Error & { status?: number }).status ?? 500;
    const detail =
      err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}
