import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { params: Promise<{ id: string }> };

/** Forward GET /api/tournaments/:id/phases → FastAPI /tournaments/:id/phases. */
export async function GET(_req: NextRequest, { params }: Params) {
  await cookies();
  const { id } = await params;
  try {
    const data = await apiFetch(`/tournaments/${id}/phases`);
    return NextResponse.json(data);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}

/** Forward POST /api/tournaments/:id/phases → FastAPI /tournaments/:id/phases. */
export async function POST(req: NextRequest, { params }: Params) {
  await cookies();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const data = await apiFetch(`/tournaments/${id}/phases`, {
      method: "POST",
      body,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}
