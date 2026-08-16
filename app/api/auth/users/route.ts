import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

/**
 * Forward GET /api/auth/users → FastAPI /auth/users.
 *
 * Admin-only list of registered users (returned by `routers/auth.py`). Used
 * by the `/admin/users` page to render the role-management table.
 */
export async function GET(_req: NextRequest) {
  await cookies();
  try {
    const data = await apiFetch("/auth/users");
    return NextResponse.json(data);
  } catch (err) {
    const status =
      (err as Error & { status?: number }).status ?? 500;
    const detail =
      err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail }, { status });
  }
}
