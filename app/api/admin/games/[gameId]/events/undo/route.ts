import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { gameId: string };

/**
 * Forward POST /api/admin/games/:gameId/events/undo → FastAPI
 * /games/:gameId/events/undo.
 *
 * Removes the most recently recorded event for the game. The FastAPI side
 * owns the policy (which event types can be undone, half-boundary rules, etc.)
 * — this route is a thin pass-through.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies();
  const { gameId } = await ctx.params;
  try {
    const data = await apiFetch(`/games/${gameId}/events/undo`, {
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
