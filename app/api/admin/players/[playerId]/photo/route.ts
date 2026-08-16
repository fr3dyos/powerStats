import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { playerId: string };

/**
 * Forward POST /api/admin/players/:playerId/photo → FastAPI
 * /players/:playerId/photo. Multipart upload; see the team-logo proxy for
 * the same pattern.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies(); // ensures we run inside the request cookie context
  const { playerId } = await ctx.params;

  const incoming = await req.formData().catch(() => null);
  if (!incoming) {
    return NextResponse.json(
      { detail: "Expected multipart/form-data" },
      { status: 400 },
    );
  }
  const file = incoming.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { detail: "Missing 'file' field" },
      { status: 400 },
    );
  }

  const form = new FormData();
  form.set("file", file);
  try {
    const data = await apiFetch(`/players/${playerId}/photo`, {
      method: "POST",
      body: form,
    });
    return NextResponse.json(data);
  } catch (err) {
    const status =
      (err as Error & { status?: number }).status ?? 500;
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}