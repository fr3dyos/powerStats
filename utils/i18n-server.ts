import { cookies, headers } from 'next/headers';
import { getDictionary, pickLocale, LOCALE_COOKIE, type Locale } from '@/utils/i18n';

export async function resolveLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    const cookieLocale = store.get(LOCALE_COOKIE)?.value;
    if (cookieLocale) return pickLocale(cookieLocale);
  } catch {}
  try {
    const headerStore = await headers();
    const acceptLanguage = headerStore.get('accept-language');
    if (acceptLanguage) return pickLocale(acceptLanguage);
  } catch {}
  return 'en';
}

export async function getServerLocale() {
  const locale = await resolveLocale();
  return { locale, dict: getDictionary(locale) };
}
