import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { playerId: string };

/**
 * Forward DELETE /api/admin/players/:playerId → FastAPI /players/:playerId.
 * Admin-only; the FastAPI route guards with `require_admin`.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies(); // ensures we run inside the request cookie context
  const { playerId } = await ctx.params;

  try {
    await apiFetch(`/players/${playerId}`, { method: "DELETE" });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}
