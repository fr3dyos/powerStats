import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

/** Forward GET /api/teams → FastAPI /teams (supports ?tournament_id filter). */
export async function GET(req: NextRequest) {
  await cookies();
  const tournamentId = req.nextUrl.searchParams.get("tournament_id");
  try {
    const data = await apiFetch("/teams", {
      query: tournamentId ? { tournament_id: tournamentId } : {},
    });
    return NextResponse.json(data);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}

/** Forward POST /api/teams → FastAPI /teams. */
export async function POST(req: NextRequest) {
  await cookies();
  const body = await req.json().catch(() => ({}));
  try {
    const data = await apiFetch("/teams", { method: "POST", body });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}
