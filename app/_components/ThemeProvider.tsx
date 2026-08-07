
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light";

export const THEME_COOKIE = "ps_theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start from the same value the server renders ("dark") so the first
  // client render matches the server HTML. The persisted theme is read in a
  // mount effect — never during render — to avoid hydration mismatches.
  const [theme, setThemeState] = useState<Theme>("dark");
  const hasApplied = useRef(false);

  // On mount, adopt the theme the inline no-flash script already applied,
  // so light-theme users don't get stuck in dark mode.
  useEffect(() => {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`),
    );
    const value = match?.[1];
    if (value === "light" || value === "dark") setThemeState(value);
  }, []);

  // Apply the theme attribute + color-scheme and persist it. The initial
  // state is already applied by the no-flash script, so skip the first run.
  useEffect(() => {
    if (!hasApplied.current) {
      hasApplied.current = true;
      return;
    }
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "dark",
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}
