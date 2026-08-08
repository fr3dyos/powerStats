import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

/** Forward GET /api/games → FastAPI /games (supports ?tournament_id filter). */
export async function GET(req: NextRequest) {
  await cookies();
  const tournamentId = req.nextUrl.searchParams.get("tournament_id");
  try {
    const data = await apiFetch("/games", {
      query: tournamentId ? { tournament_id: tournamentId } : {},
    });
    return NextResponse.json(data);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}
