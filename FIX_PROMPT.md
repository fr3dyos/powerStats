# PowerStats — Fix & Feature Prompt

This document is a single, self-contained prompt/instruction for a developer
or AI agent to implement the missing features and fix the existing issues in
the PowerStats repository. It is split into three workstreams:

1. **Language switching (i18n)** — make the app actually multi-language.
2. **Dark / light mode** — add a client-side theme toggle with persistence.
3. **Data fetching fixes & hardening** — resolve the pre-existing TypeScript
   errors and improve data hydration.

---

## 0. Context & Current State

**Stack:** Next.js 14 (App Router, React 18, TypeScript) + FastAPI (Python)
+ Postgres via Supabase. Frontend calls the FastAPI backend through
`utils/api.ts` (`apiFetch`), which forwards Supabase JWTs as Bearer tokens.
Auth roles are `admin` / `scorekeeper` / `public`.

### What already works
- `utils/i18n.ts` exposes `getDictionary(locale)` and `pickLocale(input)`.
  Translation assets exist in `en.json`, `es.json`, `pt-BR.json`.
- `utils/api.ts` has typed DTOs and helpers (`tournamentsApi`, `teamsApi`,
  `playersApi`, `gamesApi`, `computeStandings`, `formatDate`, etc.).
- All public and admin pages fetch data from the FastAPI backend correctly.
- A dark theme is defined in `app/globals.css` via `:root` `--ps-*` tokens.

### What is missing (the actual gaps to fill)
- **i18n is not wired end-to-end.** Every page calls
  `pickLocale(undefined)` which always returns `"en"`. There is:
  - no locale detection (cookie / `Accept-Language` / URL),
  - no locale persistence,
  - no language switcher UI,
  - no `html lang` synchronization (`app/layout.tsx` hardcodes `lang="en"`),
  - and most pages render hardcoded English strings instead of dictionary
    lookups.
- **Only a dark theme exists.** There is no light-mode token set, no
  `data-theme` attribute handling, no theme toggle, and no persistence.
- **Pre-existing TypeScript errors** (documented in `TODO.md`) in:
  `app/rankings/page.tsx`, `app/teams/[teamId]/page.tsx`,
  `app/tournaments/[id]/bracket/page.tsx`,
  `app/tournaments/[id]/public/page.tsx`, and `utils/api.ts`
  (`computeStandings` Map iteration / `Game` typing).

---

## 1. Workstream A — Language Switching (i18n)

### A1. Locale detection & session
- Add a locale cookie (e.g. `ps_locale`) to the request.
- In `middleware.ts` (or a new helper), detect the locale using this
  priority: **URL segment → cookie → `Accept-Language` header → `"en"`**.
- Keep `pickLocale` as the sanitizer that maps any detected value to a
  supported `Locale` (`"en" | "es" | "pt-BR"`).
- Persist the chosen locale to the cookie so it survives reloads/navigation.

### A2. Server-side dictionary resolution
- Create a server helper (e.g. `utils/i18n-server.ts`) that reads the
  request cookies/headers and returns `{ locale, dict }`.
- Replace every `getDictionary(pickLocale(undefined))` call in Server
  Components with the new helper so pages are rendered in the user's locale.

### A3. Client-side dictionary resolution & switcher
- Create a small client context/provider (e.g. `app/_components/I18nProvider`)
  that holds the current locale and dictionary, and exposes a `setLocale`
  function that writes the cookie and refreshes.
- Build a **language switcher** component (e.g.
  `app/_components/LanguageSwitcher.tsx`) with options for English,
  Português (BR), and Español. It must:
  - update the cookie,
  - call `router.refresh()` so server components re-render in the new locale,
  - update `<html lang>` via a `useEffect`.
- Mount the switcher in the `AppShell` header (and on the auth pages that
  don't use `AppShell`).

### A4. Translate hardcoded UI strings
- Audit every page and replace hardcoded UI copy with dictionary lookups.
  The dictionaries already cover `navigation`, `adminPanel`,
  `liveScoringConsole`, `publicStats`, `auth`, and `adminDashboard`.
- **Add missing keys** to `en.json`, `es.json`, and `pt-BR.json` for strings
  that are not yet translated (e.g. home/hero copy, tournament/team/player
  page labels, statuses like "Pending"/"Win"/"Loss", leaderboard titles,
  round labels, footer, etc.).
- Keep all three files in sync (same keys, translated values).

### A5. Metadata & `lang`
- Update `app/layout.tsx` to accept and apply the detected locale to the
  `<html lang>` attribute and to localized `metadata` title/description.

---

## 2. Workstream B — Dark / Light Mode

### B1. Light theme tokens
- In `app/globals.css`, add a `[data-theme="light"]` block (or a
  `:root[data-theme="light"]` selector) that overrides every `--ps-*`
  variable with a light-friendly palette:
  - light backgrounds (`--ps-bg`, `--ps-surface`, containers),
  - dark text (`--ps-text`, `--ps-text-muted`, `--ps-text-subtle`),
  - adjusted borders, shadows, and readable accent colors,
  - keep the brand accents (orange/teal/lime) but ensure contrast on light.
- Keep the existing dark values as the default `:root` (dark mode).

### B2. Theme provider & toggle
- Create a client theme provider (e.g. `app/_components/ThemeProvider.tsx`)
  that:
  - reads an initial theme from a cookie (`ps_theme`) or `localStorage`,
  - applies `data-theme` on `<html>` (and `color-scheme`),
  - exposes `theme` and `setTheme` (with `dark`, `light`, and optionally
    `system`),
  - listens to `prefers-color-scheme` when set to `system`,
  - persists the choice.
- Add a **theme toggle button** in the `AppShell` header (and auth pages)
  that cycles between light/dark and shows the current state icon.
- Avoid a flash of the wrong theme: inline a small script in `layout.tsx`
  (or set the attribute in the provider's initializer) so the theme is
  applied before first paint.

### B3. Accessibility & contrast
- Ensure all status colors, links, and focus rings have adequate contrast in
  both themes.
- Respect `prefers-reduced-motion`.

---

## 3. Workstream C — Data Fetching Fixes & Hardening

### C1. Fix pre-existing TypeScript errors
Resolve the errors noted in `TODO.md` without changing behavior:
- `utils/api.ts` — `computeStandings`: iterate `rows.values()` in a way that
  satisfies the `Map` typing; confirm `Game` DTO fields used by the sorting
  logic exist.
- `app/rankings/page.tsx` — fix the `Map` iteration / typing issues in the
  team/player aggregation.
- `app/teams/[teamId]/page.tsx` — resolve `Game` / `Team` typing issues.
- `app/tournaments/[id]/bracket/page.tsx` — resolve `games`/`teamMap` typing.
- `app/tournaments/[id]/public/page.tsx` — resolve `StatRow` / player typing.

### C2. Error handling & loading states
- Add a reusable `ErrorBoundary` and per-page loading skeletons for the
  public data pages so network/DB failures render a friendly message instead
  of a blank or crashed page.
- Consider a shared `EmptyState`/`ErrorState` component.

### C3. Optional data-fetching improvements
- Add a `revalidate`/stale-while-revalidate strategy where appropriate
  (public, non-auth pages) instead of `force-dynamic` everywhere, while
  keeping **admin/scorekeeper** pages dynamic.
- Ensure the FastAPI `GET` endpoints for public reads are truly `public`
  (no auth required) and that authenticated reads still forward the JWT.

---

## 4. Files Most Likely to Change

**i18n**
- `app/layout.tsx`
- `middleware.ts`
- `utils/i18n.ts` (extend) + new `utils/i18n-server.ts`
- new `app/_components/I18nProvider.tsx`, `LanguageSwitcher.tsx`
- `app/_components/AppShell.tsx`
- `en.json`, `es.json`, `pt-BR.json`
- all page files under `app/` (replace hardcoded strings)

**Theme**
- `app/globals.css`
- new `app/_components/ThemeProvider.tsx`, `ThemeToggle.tsx`
- `app/layout.tsx`
- `app/_components/AppShell.tsx`

**Data fetching**
- `utils/api.ts`
- `app/rankings/page.tsx`
- `app/teams/[teamId]/page.tsx`
- `app/tournaments/[id]/bracket/page.tsx`
- `app/tournaments/[id]/public/page.tsx`
- new shared error/loading components

---

## 5. Acceptance Criteria

- [ ] Selecting a language changes the UI immediately and persists across
      reloads/navigation; `<html lang>` matches the selection.
- [ ] All three locales (en / pt-BR / es) render fully translated public +
      admin pages with no untranslated hardcoded copy.
- [ ] A light/dark toggle switches the theme instantly, persists the choice,
      applies `data-theme`/`color-scheme`, and shows no flash of the wrong
      theme on load.
- [ ] Both themes are readable and meet contrast for all text/status colors.
- [ ] `npm run lint` and `npx tsc --noEmit` pass with **no errors**.
- [ ] Public pages still fetch all tournaments/teams/players/games from the
      backend without auth; admin/scorekeeper flows still work with the JWT.
- [ ] Network/DB failures render a friendly error state (no blank page).

---

## 6. Verification Steps

1. Backend: `uvicorn main:app --reload --port 8000` (ensure DB reachable).
2. Frontend: `npm run dev`, open `http://localhost:3000`.
3. Test language switching on home, tournaments, rankings, team, player,
   bracket, and admin pages.
4. Test theme toggle on the same pages.
5. Run `npx tsc --noEmit` and `npm run lint`; confirm zero errors.
6. Confirm admin live-scoring console still records events correctly.
