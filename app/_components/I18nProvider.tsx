"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import {
  getDictionary,
  LOCALE_COOKIE,
  pickLocale,
  type Dictionary,
  type Locale,
} from "@/utils/i18n";

type I18nContextValue = {
  locale: Locale;
  dict: Dictionary;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale: initialLocale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const dict = useMemo(() => getDictionary(locale), [locale]);

  // Keep the <html lang> attribute in sync with the active locale.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      // Persist the choice in a cookie so server components re-render in
      // the new locale on the next navigation / refresh.
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    },
    [router],
  );

  const value = useMemo(
    () => ({ locale, dict, setLocale }),
    [locale, dict, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback so the hook can be used outside the provider (e.g. auth pages
    // that render dictionaries directly). Defaults to the browser locale.
    return {
      locale: pickLocale(typeof window !== "undefined" ? window.navigator.language : undefined),
      dict: getDictionary(
        pickLocale(typeof window !== "undefined" ? window.navigator.language : undefined),
      ),
      setLocale: () => {},
    };
  }
  return ctx;
}
