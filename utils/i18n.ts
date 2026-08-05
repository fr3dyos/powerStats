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

// Dictionary type: flat key-value pairs for translations.
export type Dictionary = Record<string, string>;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import('../messages/en.json').then((m) => m.default),
  es: () => import('../messages/es.json').then((m) => m.default),
  'pt-BR': () => import('../messages/pt-BR.json').then((m) => m.default),
};

export function getDictionary(locale: Locale): Dictionary {
  // For client-side synchronous access we need the dictionaries pre-loaded.
  // In practice the app loads them dynamically; this function is provided
  // for compatibility with the existing app code that calls it synchronously.
  // The actual dictionary loading is handled by the I18nProvider and
  // server components via dynamic import.
  const cache = (globalThis as any).__i18n_cache ??= {};
  if (cache[locale]) return cache[locale];
  // Fallback: return empty dict; the provider will populate it.
  return {};
}

export async function loadDictionary(locale: Locale): Promise<Dictionary> {
  const cache = (globalThis as any).__i18n_cache ??= {};
  if (!cache[locale]) {
    cache[locale] = await dictionaries[locale]();
  }
  return cache[locale];
}
