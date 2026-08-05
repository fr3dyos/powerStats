import en from '../messages/en.json';
import es from '../messages/es.json';
import ptBR from '../messages/pt-BR.json';

export const LOCALES = ['en', 'es', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'ps_locale';

const dictionaries: Record<Locale, typeof en> = { en, es, 'pt-BR': ptBR };
export type Dictionary = typeof en;

export function pickLocale(input: string | undefined | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  const lower = input.toLowerCase().trim();
  for (const locale of LOCALES) if (locale.toLowerCase() === lower) return locale;
  const first = lower.split(',')[0].split(';')[0].trim();
  for (const locale of LOCALES) if (locale.toLowerCase() === first) return locale;
  const base = first.split('-')[0];
  for (const locale of LOCALES) if (locale.toLowerCase() === base) return locale;
  return DEFAULT_LOCALE;
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}
