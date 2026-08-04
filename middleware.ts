import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { LOCALE_COOKIE, pickLocale } from "@/utils/i18n";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  // If the user hasn't chosen a locale yet, seed the `ps_locale` cookie from
  // the browser's `Accept-Language` header so the first render is localized.
  const locale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (!locale) {
    const acceptLanguage = request.headers.get("accept-language");
    if (acceptLanguage) {
      const detected = pickLocale(acceptLanguage);
      response.cookies.set(LOCALE_COOKIE, detected, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
  }

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
