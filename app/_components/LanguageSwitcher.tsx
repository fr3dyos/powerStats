"use client";

import { useI18n } from "@/app/_components/I18nProvider";
import { LOCALES, type Locale } from "@/utils/i18n";

const LABELS: Record<Locale, string> = {
  en: "EN",
  es: "ES",
  "pt-BR": "PT",
};

const FULL: Record<Locale, string> = {
  en: "English",
  es: "Español",
  "pt-BR": "Português (BR)",
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div
      className="ps-lang-switcher"
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          className={`ps-lang-btn${l === locale ? " ps-lang-btn--active" : ""}`}
          aria-pressed={l === locale}
          title={FULL[l]}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
