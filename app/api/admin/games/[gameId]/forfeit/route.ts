import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { gameId: string };

/** Forward POST /api/admin/games/:gameId/forfeit → FastAPI /games/:gameId/forfeit. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies();
  const { gameId } = await ctx.params;
  try {
    const body = await req.json().catch(() => ({}));
    const data = await apiFetch(`/games/${gameId}/forfeit`, {
      method: "POST",
      body,
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
