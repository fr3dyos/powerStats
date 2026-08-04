import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { gameId: string };

/** Forward POST /api/admin/games/:gameId/advance-half → FastAPI /games/:gameId/advance-half. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies();
  const { gameId } = await ctx.params;
  const params: Record<string, string> = {};
  const te = req.nextUrl.searchParams.get("time_elapsed");
  if (te) params.time_elapsed = te;
  try {
    const data = await apiFetch(`/games/${gameId}/advance-half`, {
      method: "POST",
      query: params,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const status =
      (err as Error & { status?: number }).status ?? 500;
    const detail =
      err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}