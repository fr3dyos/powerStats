import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { gameId: string };

/** Forward POST /api/admin/games/:gameId/timeout → FastAPI /games/:gameId/timeout. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies();
  const { gameId } = await ctx.params;
  const params: Record<string, string> = {};
  const team = req.nextUrl.searchParams.get("team");
  const tn = req.nextUrl.searchParams.get("timeout_number");
  const te = req.nextUrl.searchParams.get("time_elapsed");
  const period = req.nextUrl.searchParams.get("period");
  if (team) params.team = team;
  if (tn) params.timeout_number = tn;
  if (te) params.time_elapsed = te;
  if (period) params.period = period;
  try {
    const data = await apiFetch(`/games/${gameId}/timeout`, {
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