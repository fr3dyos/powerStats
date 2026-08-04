import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Server-side Supabase client.
 *
 * Use this in Server Components, Route Handlers, and Server Actions. The
 * returned client is bound to the request's cookies so the user's session
 * is forwarded automatically.
 */
export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This is safe to ignore when middleware is refreshing user
            // sessions (which is the case in this project).
          }
        },
      },
    },
  );
};

/**
 * Read the current user *and* their verified JWT claims from the request
 * cookies, suitable for server-side authorization.
 *
 * Authorization is **preferentially** based on `supabase.auth.getClaims()`
 * (which verifies the signature against Supabase's JWKS) — the role comes
 * from `claims.app_metadata.role`.
 *
 * IMPORTANT for stability: if `getClaims()` comes back empty (e.g. a token
 * that was valid but momentarily failed signature verification, or a
 * refresh race on navigation), we fall back to `getSession()`/`getUser()`
 * so a *real* signed-in user is never treated as logged-out when the user
 * merely clicks a link. The verified-claims path is still preferred; the
 * fallback only kicks in when the preferred path returns nothing.
 *
 * Returns `null` for the user/claims when the caller is not signed in.
 */
export async function getAuthedUser(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const supabase = createClient(cookieStore);

  // Preferred path: verified JWT claims.
  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims) {
    const { data: userData } = await supabase.auth.getUser();
    const role =
      (claimsData.claims.app_metadata as Record<string, unknown> | undefined)
        ?.role ?? null;
    return {
      supabase,
      user: userData?.user ?? null,
      claims: claimsData.claims,
      role: typeof role === "string" ? role : null,
    };
  }

  // Fallback path: prefer a live session over treating the user as logged
  // out. This prevents random "signed out by clicking a link" redirects.
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    const { data: userData } = await supabase.auth.getUser();
    const appMeta = userData?.user?.app_metadata as
      | Record<string, unknown>
      | undefined;
    const role = appMeta?.role ?? null;
    return {
      supabase,
      user: userData?.user ?? null,
      claims: null,
      role: typeof role === "string" ? role : null,
    };
  }

  return { supabase, user: null, claims: null, role: null as string | null };
}
