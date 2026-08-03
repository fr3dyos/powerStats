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
 * IMPORTANT: this uses `supabase.auth.getClaims()` (which verifies the
 * signature against Supabase's JWKS) rather than `getSession()` (which is
 * not authoritative). The role used for authorization is the value of
 * `claims.app_metadata.role`.
 *
 * Returns `null` for the user/claims when the caller is not signed in.
 */
export async function getAuthedUser(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const supabase = createClient(cookieStore);
  // `getClaims` verifies the JWT signature; never trust `getSession()` for
  // authorization decisions.
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return { supabase, user: null, claims: null, role: null as string | null };
  }
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
