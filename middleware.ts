import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { LOCALE_COOKIE, LOCALES, pickLocale, type Locale } from "@/utils/i18n";

/**
 * Resolve the locale for a request with priority:
 *   URL segment → `ps_locale` cookie → `Accept-Language` header → "en".
 *
 * A URL locale segment (e.g. `/es/tournaments`) wins over everything else;
 * the resolved value is then persisted to the `ps_locale` cookie so the
 * server components render in the same language on the next navigation.
 */
function resolveLocale(request: NextRequest): Locale {
  // 1. URL segment (e.g. /es, /pt-BR).
  const firstSegment = request.nextUrl.pathname.split("/")[1] ?? "";
  const urlLocale = LOCALES.find((l) => l === firstSegment);
  if (urlLocale) return urlLocale;

  // 2. Cookie.
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale) return pickLocale(cookieLocale);

  // 3. Accept-Language header.
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) return pickLocale(acceptLanguage);

  // 4. Default.
  return "en";
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  // Always persist the resolved locale so the cookie stays in sync with the
  // URL/detection chain and the first render is localized.
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
    /*
     * Run middleware on all paths except static assets / Next internals.
     * Adjust the matcher to protect specific routes if needed.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
