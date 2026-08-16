import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { phaseId: string };

/**
 * Forward PUT /api/phases/:phaseId → FastAPI /phases/:phaseId.
 *
 * Partial update of a phase (name, status, config, status_mode, phase_order).
 * Used by the tournament edit form to drive the new "edit phase" modal.
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies();
  const { phaseId } = await ctx.params;
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { detail: "Body must be JSON." },
      { status: 400 },
    );
  }
  try {
    const data = await apiFetch(`/phases/${phaseId}`, {
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

/**
 * Forward DELETE /api/phases/:phaseId → FastAPI /phases/:phaseId.
 *
 * Removes a phase. Caller is expected to be a scorekeeper+; FastAPI owns
 * the access policy.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies();
  const { phaseId } = await ctx.params;
  try {
    await apiFetch<void>(`/phases/${phaseId}`, { method: "DELETE" });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const status =
      (err as Error & { status?: number }).status ?? 500;
    const detail =
      err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}
