import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { id: string };

/**
 * Forward POST /api/admin/tournaments/:id/bulk-import/commit → FastAPI
 * /admin/tournaments/:id/bulk-import/commit.
 *
 * Persists a previously previewed CSV roster import. The admin UI must
 * call /preview first, show the proposed teams + players, and only POST
 * here once the user has confirmed.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies();
  const { id } = await ctx.params;

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
    const data = await apiFetch(
      `/admin/tournaments/${id}/bulk-import/commit`,
      { method: "POST", body },
    );
    return NextResponse.json(data);
  } catch (err) {
    const status =
      (err as Error & { status?: number }).status ?? 500;
    const detail =
      err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}
