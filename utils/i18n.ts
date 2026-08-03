import en from "@/en.json";
import es from "@/es.json";
import ptBR from "@/pt-BR.json";

export type Locale = "en" | "es" | "pt-BR";

const dictionaries: Record<Locale, Record<string, any>> = {
  en,
  es,
  "pt-BR": ptBR,
};

export function getDictionary(locale: Locale) {
  return dictionaries[locale] ?? dictionaries.en;
}

export function pickLocale(input?: string | null | undefined): Locale {
  if (!input) return "en";
  const lower = input.toLowerCase();
  if (lower.startsWith("es")) return "es";
  if (lower.startsWith("pt")) return "pt-BR";
  return "en";
}

export type Dictionary = ReturnType<typeof getDictionary>;
