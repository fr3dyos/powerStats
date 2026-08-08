import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { gameId: string };

/** Forward GET /api/admin/games/:gameId → FastAPI /games/:gameId. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies(); // ensures we run inside the request cookie context
  const { gameId } = await ctx.params;
  try {
    const data = await apiFetch(`/games/${gameId}`);
    return NextResponse.json(data);
  } catch (err) {
    const status =
      (err as Error & { status?: number }).status ?? 500;
    const detail =
      err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}

/**
 * Forward PUT /api/admin/games/:gameId → FastAPI /games/:gameId.
 * Used by the scorekeeper console to toggle the "live" flag and to
 * start/pause/reset the game clock.
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies(); // ensures we run inside the request cookie context
  const { gameId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    const data = await apiFetch(`/games/${gameId}`, {
      method: "PUT",
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