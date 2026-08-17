import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createClient } from "@/utils/supabase/server";

type Params = { id: string };

const DEFAULT_BASE_URL = "http://localhost:8000";

function resolveBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_API_URL;
  return (env ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
}

async function readAccessToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Forward POST /api/admin/tournaments/:id/spirit/import → FastAPI
 * /admin/tournaments/:id/spirit/import.
 *
 * Accepts either:
 * - A `multipart/form-data` body (the browser uploaded a CSV/XLSX file)
 * - A JSON body of the shape `{ filename, content }` where `content` is the
 *   raw CSV text the user pasted into the admin UI.
 *
 * Bypasses `apiFetch` because that helper always JSON-stringifies the body
 * and forces `Content-Type: application/json`, which would corrupt the
 * multipart upload.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  await cookies();
  const { id } = await ctx.params;
  const contentType = req.headers.get("content-type") ?? "";

  let form: FormData;
  try {
    if (contentType.startsWith("multipart/form-data")) {
      form = await req.formData();
    } else {
      const json = (await req.json()) as {
        filename?: string;
        content?: string;
      };
      const filename = json.filename ?? "spirit.csv";
      const content = (json.content ?? "").trim();
      if (!content) {
        return NextResponse.json(
          { detail: "No CSV content supplied." },
          { status: 400 },
        );
      }
      form = new FormData();
      form.append("file", new Blob([content], { type: "text/csv" }), filename);
    }
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }

  try {
    const baseUrl = resolveBaseUrl();
    const token = await readAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(
      `${baseUrl}/admin/tournaments/${id}/spirit/import`,
      {
        method: "POST",
        headers,
        body: form,
      },
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
