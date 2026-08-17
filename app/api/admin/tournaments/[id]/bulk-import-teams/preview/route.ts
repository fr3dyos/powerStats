import { cookies } from "next/headers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const cookieStore = await cookies();
    const token = cookieStore.get("sb-token")?.value;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(
      `${apiUrl}/admin/tournaments/${id}/bulk-import-teams/preview`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      return Response.json(error, { status: res.status });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { detail: error instanceof Error ? error.message : "Preview failed" },
      { status: 500 }
    );
  }
}
