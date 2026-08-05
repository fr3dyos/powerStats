import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

export const LOCALES = ['en', 'es', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'ps_locale';

const localeSet = new Set<string>(LOCALES);

export function pickLocale(input: string | undefined | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  const lower = input.toLowerCase().trim();
  for (const locale of LOCALES) {
    if (locale.toLowerCase() === lower) return locale;
  }
  // Handle e.g. "pt-BR,pt;q=0.9,en;q=0.8"
  const first = lower.split(',')[0].split(';')[0].trim();
  for (const locale of LOCALES) {
    if (locale.toLowerCase() === first) return locale;
  }
  // Handle "en-US" -> "en"
  const base = first.split('-')[0];
  for (const locale of LOCALES) {
    if (locale.toLowerCase() === base) return locale;
  }
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async ({ locale }) => {
  const resolved = pickLocale(locale);

  try {
    const messages = (await import(`../messages/${resolved}.json`)).default;
    return { messages, locale: resolved };
  } catch {
    // Fallback to default locale if a translation file is missing
    const messages = (await import(`../messages/${DEFAULT_LOCALE}.json`)).default;
    return { messages, locale: DEFAULT_LOCALE };
  }
});
