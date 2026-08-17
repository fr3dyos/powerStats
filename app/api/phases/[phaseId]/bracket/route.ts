import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { params: Promise<{ phaseId: string }> };

/** Forward POST /api/phases/:phaseId/bracket → FastAPI /phases/:phaseId/bracket. */
export async function POST(req: NextRequest, { params }: Params) {
  await cookies();
  const { phaseId } = await params;
  const body = await req.json().catch(() => ({}));
  const persist = body?.persist ?? false;
  try {
    const data = await apiFetch(`/phases/${phaseId}/bracket`, {
      method: "POST",
      query: { persist: String(persist) },
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}
