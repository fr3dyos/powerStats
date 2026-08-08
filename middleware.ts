import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import {
  LOCALE_COOKIE,
  LOCALES,
  pickLocale,
  type Locale,
} from "@/utils/i18n";

/**
 * Routes that require an authenticated user. Only the `/admin` panel
 * requires sign-in — `/teams`, `/players`, `/games`, `/tournaments` and
 * `/rankings` are public. Role checks (admin / scorekeeper) stay inside
 * the page handlers; the middleware only enforces "signed in or not"
 * for the admin panel.
 */
const PROTECTED_PREFIXES = [
  "/admin",
];

/** Public auth flows that live under protected prefixes must stay reachable
 *  while anonymous — otherwise nobody can ever sign in. */
const AUTH_PATHS = new Set([
  "/admin/login",
  "/forgot-password",
  "/reset-password",
]);

const isProtected = (pathname: string): boolean =>
  !AUTH_PATHS.has(pathname) &&
  PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

/** Resolve locale with priority: URL > cookie > Accept-Language > "en". */
function resolveLocale(request: NextRequest): Locale {
  const firstSegment = request.nextUrl.pathname.split("/")[1] ?? "";
  if (LOCALES.includes(firstSegment as Locale)) return firstSegment as Locale;
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale) return pickLocale(cookieLocale);
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) return pickLocale(acceptLanguage);
  return "en";
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Refresh the Supabase session so downstream server components see a
  // valid cookie. We need this BEFORE the auth check below.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let isAuthed = false;
  if (supabaseUrl && supabasePublishableKey) {
    const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          request.cookies.set({ name, value: "", ...options });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    isAuthed = !!data.user;
  }

  // Anonymous traffic to a protected route → bounce to home with an
  // explicit error code so the page can render a sign-in CTA. We use a
  // dedicated redirect (302) rather than rewriting so external links
  // visibly land on `/`.
  if (isProtected(request.nextUrl.pathname) && !isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("error", "auth");
    return NextResponse.redirect(url);
  }

  // Persist the resolved locale so the next render picks it up.
  const locale = resolveLocale(request);
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};