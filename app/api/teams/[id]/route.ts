import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { id: string };

/** Forward DELETE /api/teams/:id → FastAPI /teams/:id. */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies();
  const { id } = await ctx.params;
  try {
    await apiFetch(`/teams/${id}`, { method: "DELETE" });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}
