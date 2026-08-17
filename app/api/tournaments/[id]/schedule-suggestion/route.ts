import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { params: Promise<{ id: string }> };

/** Forward POST /api/tournaments/:id/schedule-suggestion → FastAPI /tournaments/:id/schedule-suggestion. */
export async function POST(req: NextRequest, { params }: Params) {
  await cookies();
  const { id } = await params;
  const incomingUrl = new URL(req.url);
  const query: Record<string, string> = {};
  for (const [key, value] of incomingUrl.searchParams.entries()) {
    query[key] = value;
  }
  try {
    const data = await apiFetch(`/tournaments/${id}/schedule-suggestion`, {
      method: "POST",
      query,
      body: {},
    });
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}
