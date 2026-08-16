import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "@/utils/api";

/**
 * Forward POST /api/auth/login → FastAPI /auth/login.
 *
 * Supabase auth remains the canonical admin login path used by
 * `app/admin/login/page.tsx`; this proxy is a thin fallback for clients that
 * want to authenticate against the FastAPI backend directly (e.g. an upcoming
 * mobile app). It does not set any cookies — the caller is responsible for
 * storing the returned token.
 */
export async function POST(req: NextRequest) {
  await cookies();
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
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body,
      // Public endpoint — no JWT forwarding.
      anonymous: true,
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
