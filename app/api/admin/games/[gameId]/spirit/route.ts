import { NextRequest, NextResponse } from "next/server";

import { apiFetch } from "@/utils/api";

type Params = { gameId: string };

/**
 * Forward PUT /api/admin/games/:gameId/spirit → FastAPI
 * /admin/games/:gameId/spirit.
 *
 * Records per-side WFDF spirit scores (0–10) for a finished game so the
 * standings engine can average them into ``spirit_average``. Either side
 * may be omitted to update only one team.
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  const { gameId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { detail: "Body must be JSON." },
      { status: 400 },
    );
  }
  try {
    const data = await apiFetch(`/admin/games/${gameId}/spirit`, {
      method: "PUT",
      body,
    });
    return NextResponse.json(data);
  } catch (err) {
    const status =
      (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}
