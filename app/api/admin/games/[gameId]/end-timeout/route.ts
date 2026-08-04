import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { gameId: string };

/** Forward POST /api/admin/games/:gameId/end-timeout → FastAPI /games/:gameId/end-timeout. */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies();
  const { gameId } = await ctx.params;
  try {
    const data = await apiFetch(`/games/${gameId}/end-timeout`, {
      method: "POST",
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