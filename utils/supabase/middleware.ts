import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Create an authenticated Supabase server client bound to a Next.js request.
 * Useful for Route Handlers / Server Components that operate on a request.
 *
 * @param request The incoming `NextRequest`.
 * @returns A configured Supabase client.
 */
export const createClient = (request: NextRequest) => {
  // Create an unmodified response
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    },
  );

  return supabase;
};

/**
 * Refresh the Supabase auth session on every matching request, and enforce
 * coarse-grained route protection for the admin area.
 *
 * `/admin` is gated at the middleware layer (in addition to the page-level
 * guard) so that the dashboard is never briefly rendered for non-admins.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    },
  );

  // IMPORTANT: Do not run any code between createServerClient and
  // supabase.auth.getUser(). This call refreshes the session and is what
  // keeps logged-in users signed in across requests.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Coarse-grained guard for the protected admin area. The page-level
  // server guard in `app/admin/page.tsx` is the authoritative check; this
  // is just a fast redirect to avoid flashing protected UI.
  const isProtectedAdmin =
    path.startsWith("/admin") &&
    path !== "/admin/login" &&
    path !== "/admin/login/";
  if (isProtectedAdmin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
