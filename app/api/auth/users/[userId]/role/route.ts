import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

type Params = { userId: string };

/**
 * Forward PUT /api/auth/users/:userId/role → FastAPI
 * /auth/users/:userId/role.
 *
 * Updates the role of a registered user. Caller must already be an admin on
 * the FastAPI side; the proxy simply forwards the JWT.
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies();
  const { userId } = await ctx.params;
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
    const data = await apiFetch(`/auth/users/${userId}/role`, {
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
