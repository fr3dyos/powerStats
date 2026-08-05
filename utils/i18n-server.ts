import { cookies, headers } from 'next/headers';

import { getDictionary, pickLocale, LOCALE_COOKIE, type Locale } from '@/utils/i18n';

/**
 * Resolve the current locale from the request context.
 *
 * Priority: `ps_locale` cookie → `Accept-Language` header → `"en"`.
 * The locale cookie is set by the client-side `LanguageSwitcher` and the
 * middleware (so a first visit with a browser in Spanish/Portuguese is
 * picked up automatically).
 */
export async function resolveLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    const cookieLocale = store.get(LOCALE_COOKIE)?.value;
    if (cookieLocale) return pickLocale(cookieLocale);
  } catch {
    /* not in a request context */
  }

  try {
    const headerStore = await headers();
    const acceptLanguage = headerStore.get('accept-language');
    if (acceptLanguage) return pickLocale(acceptLanguage);
  } catch {
    /* not in a request context */
  }

  return 'en';
}

/**
 * Server-side helper used by Server Components to get the resolved locale
 * and its dictionary in one call.
 */
export async function getServerLocale() {
  const locale = await resolveLocale();
  return { locale, dict: getDictionary(locale) };
}
