import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

/** Forward GET /api/tournaments → FastAPI /tournaments. */
export async function GET(req: NextRequest) {
  await cookies();
  const limit = req.nextUrl.searchParams.get("limit") ?? "100";
  try {
    const data = await apiFetch("/tournaments", { query: { limit } });
    return NextResponse.json(data);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}

/** Forward POST /api/tournaments → FastAPI /tournaments. */
export async function POST(req: NextRequest) {
  await cookies();
  const body = await req.json().catch(() => ({}));
  try {
    const data = await apiFetch("/tournaments", { method: "POST", body });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}
