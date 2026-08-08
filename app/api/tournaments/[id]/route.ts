import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { params: Promise<{ id: string }> };

/** Forward GET /api/tournaments/:id → FastAPI /tournaments/:id. */
export async function GET(_req: NextRequest, { params }: Params) {
  await cookies();
  const { id } = await params;
  try {
    const data = await apiFetch(`/tournaments/${id}`);
    return NextResponse.json(data);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}

/** Forward PUT /api/tournaments/:id → FastAPI /tournaments/:id. */
export async function PUT(req: NextRequest, { params }: Params) {
  await cookies();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const data = await apiFetch(`/tournaments/${id}`, {
      method: "PUT",
      body,
    });
    return NextResponse.json(data);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}

/** Forward DELETE /api/tournaments/:id → FastAPI /tournaments/:id. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  await cookies();
  const { id } = await params;
  try {
    await apiFetch(`/tournaments/${id}`, { method: "DELETE" });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}
