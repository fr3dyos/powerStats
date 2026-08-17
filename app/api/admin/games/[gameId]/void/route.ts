import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { gameId: string };

/** Forward POST /api/admin/games/:gameId/void → FastAPI /games/:gameId/void. */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies();
  const { gameId } = await ctx.params;
  try {
    const data = await apiFetch(`/games/${gameId}/void`, {
      method: "POST",
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
