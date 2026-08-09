# PowerStats — Comprehensive Page Map

> Current state vs ideal state. Every page, every button, every function.

---

## Database Tables (PostgreSQL / Supabase)

| Table | RLS | Policies | Notes |
|---|---|---|---|
| tournaments | ✅ ON | public read | 3 rows |
| teams | ✅ ON | public read | 14 rows |
| players | ✅ ON | public read | ~100+ rows |
| games | ✅ ON | public read | 46 rows; clock columns added |
| game_events | ✅ ON | public read | ~1000+ rows |
| player_tournament_stats | ✅ ON | public read | per-tournament aggregations |
| phases | ✅ ON | public read | tournament phases |
| groups | ✅ ON | public read | round-robin groups |
| group_teams | ✅ ON | public read | group ↔ team join |
| spirit_scores | ✅ ON | public read | WFDF SOTG scores |
| token_rules | ✅ ON | public read | token economy rules |
| token_transactions | ✅ ON | public read | token ledger |

**Views:** `player_token_balances`, `team_token_balances` — read-only, **fixed** with
`security_invoker = true` (previously flagged as SECURITY DEFINER; migration applied, security advisor now clean).

---

## Backend API (FastAPI)

| Endpoint | Method | Auth | Status |
|---|---|---|---|
| `/tournaments` | GET | public | ✅ Works |
| `/tournaments` | POST | scorekeeper | ✅ Works |
| `/tournaments/{id}` | GET | public | ✅ Works |
| `/tournaments/{id}` | PUT | scorekeeper | ✅ Works |
| `/tournaments/{id}` | DELETE | admin | ✅ Works |
| `/tournaments/{id}/bracket` | POST | scorekeeper | ✅ Works |
| `/tournaments/{id}/round-robin` | POST | scorekeeper | ✅ Works |
| `/tournaments/{id}/schedule-suggestion` | POST | scorekeeper | ✅ Works |
| `/tournaments/{id}/phases` | GET/POST | public/scorekeeper | ✅ Works |
| `/tournaments/{id}/spirit-ranking` | GET | public | ✅ Works |
| `/teams` | GET | public | ✅ Works |
| `/teams` | POST | scorekeeper | ✅ Works |
| `/teams/{id}` | GET | public | ✅ Works |
| `/teams/{id}` | PUT | scorekeeper | ✅ Works |
| `/teams/{id}` | DELETE | admin | ✅ Works |
| `/teams/{id}/logo` | POST | scorekeeper | ✅ Works |
| `/players` | GET | public | ✅ Works |
| `/players` | POST | scorekeeper | ✅ Works |
| `/players/{id}` | GET | public | ✅ Works |
| `/players/{id}` | PUT | scorekeeper | ✅ Works |
| `/players/{id}` | DELETE | admin | ✅ Works |
| `/players/{id}/photo` | POST | scorekeeper | ✅ Works |
| `/players/{id}/stats` | GET | public | ✅ Works |
| `/games` | GET | public | ✅ Works |
| `/games` | POST | scorekeeper | ✅ Works |
| `/games/batch` | POST | scorekeeper | ✅ Works |
| `/games/{id}` | GET | public | ✅ Works |
| `/games/{id}` | PUT | scorekeeper | ✅ Works |
| `/games/{id}` | DELETE | admin | ✅ Works |
| `/games/{id}/events` | POST | scorekeeper | ✅ Works |
| `/games/{id}/events` | GET | public | ✅ Works |
| `/games/{id}/timeout` | POST | scorekeeper | ✅ Works |
| `/games/{id}/end-timeout` | POST | scorekeeper | ✅ Works |
| `/games/{id}/advance-half` | POST | scorekeeper | ✅ Works |
| `/games/{id}/end` | POST | scorekeeper | ✅ Works |
| `/phases/{id}` | GET/PUT/DELETE | varies | ✅ Works |
| `/phases/{id}/standings` | GET | public | ✅ Works |
| `/phases/{id}/groups/split` | POST | scorekeeper | ✅ Works |
| `/phases/{id}/round-robin` | POST | scorekeeper | ✅ Works |
| `/phases/{id}/bracket` | POST | scorekeeper | ✅ Works |
| `/phases/{id}/advance` | POST | scorekeeper | ✅ Works |
| `/auth/login` | POST | public | ✅ Works |
| `/auth/register` | POST | public | ✅ Works |
| `/auth/logout` | POST | auth'd | ✅ Works |
| `/auth/me` | GET | auth'd | ✅ Works |
| `/admin/users` | GET | admin | ✅ Works |
| `/admin/users/{id}/role` | PUT | admin | ✅ Works |

---

## Public Pages (no auth required)

### 1. `/` — Home
- **Status:** ✅ Fully functional
- **Components:** AppShell with hero CTA
- **Buttons:** "Browse tournaments", "View rankings", "Enter as admin"
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 2. `/rankings` — Cross-Tournament Rankings
- **Status:** ✅ Fully functional
- **Components:** AppShell → RankingsClient (client component)
- **Buttons:** Tournament filter dropdown, Teams/Players tab toggle, CSV export, year filter, sort toggle
- **Data:** Aggregates wins/losses/PF/PA/power across all tournaments
- **Team power formula:** `wins×2 + (PF-PA)/10`
- **Player power formula:** `goals + assists×0.7 + defenses×0.5`
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 3. `/tournaments` — Tournament Browser
- **Status:** ✅ Fully functional
- **Components:** AppShell → TournamentBrowser
- **Features:** Search, status filter tabs (All/Upcoming/Live/Completed), team counts, game progress badges
- **Links:** Click → `/tournaments/{id}`
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 4. `/tournaments/[id]` — Tournament Detail / Hub
- **Status:** ✅ Fully functional
- **Features:** Computed W-L standings table (top-4 highlighted), live game badges, format cards (round-robin/playoffs/leaderboards), phase standings link
- **Links:** Phase standings → `/tournaments/{id}/phases/{phaseId}/standings`, Bracket → `/tournaments/{id}/bracket`, Public stats → `/tournaments/{id}/public`
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 5. `/tournaments/[id]/bracket` — Bracket Visualization
- **Status:** ✅ Fully functional
- **Features:** Tree-style bracket (QF → SF → Finals), separate consolation brackets for placement games (3rd/5th/7th/9th), connector lines, live game badges, scorekeeper scoring links
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 6. `/tournaments/[id]/phases/[phaseId]/standings` — Phase Standings
- **Status:** ✅ Fully functional (NEW)
- **Features:** Per-phase standings computed by backend, multi-group display (Pool A/B), full columns: Pos, Team, P, W, D, L, GF, GA, Diff, Pts, Spirit; color-coded goal diff; tiebreakers section
- **Data:** `phasesApi.standings(phaseId)` → `GET /phases/{phaseId}/standings`
- **i18n:** ✅ `standings.*` keys (en/es/pt-BR)
- **Missing:** Nothing

### 7. `/tournaments/[id]/public` — Public Leaderboard
- **Status:** ✅ Fully functional
- **Features:** Per-tournament player leaderboard (goals/assists/defenses/power), team ranking, MVP highlights, search/filter
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 8. `/teams` — Public Teams
- **Status:** ✅ Fully functional
- **Features:** Team cards grouped by tournament, team color discs
- **Links:** Team → `/teams/{id}`
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 9. `/teams/[id]` — Team Profile
- **Status:** ✅ Fully functional (ENHANCED)
- **Features:**
  - Stat tiles: W-L-T, GF, PA, Diff (color-coded), GP, Roster Size, Power
  - Roster sorted by jersey number (links to `/players/[id]`)
  - Match history table (opponent, score, result badge)
  - Player stats table: Jersey, Player, GP, Goals, Assists, Defenses, per-game averages, Power score
  - Team MVP marked with ★
  - Admin actions (edit team, manage roster, upload logo)
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 10. `/games` — Public Games
- **Status:** ✅ Fully functional (ENHANCED)
- **Features:** Game table with resolved team names, scores, status badges, tournament grouping, date/time
- **Fix applied:** Team names now resolved from roster data; "enter result" link hidden for public
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 11. `/games/[id]` — Game Detail
- **Status:** ✅ Fully functional (ENHANCED)
- **Features:**
  - Score header with team color accents and status badge
  - **Player of the Match** — computed client-side via `goals + assists×0.7 + defenses×0.5`
  - Top scorers and top assists mini-tables
  - **Match Evolution SVG** — step-line chart of cumulative score over time; grid lines every 10 min; home/away color-coded; goal-time attribution via player roster membership
  - Full event list with timestamps
  - All player names link to `/players/[id]`, team names to `/teams/[id]`
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 12. `/players/[id]` — Player Profile
- **Status:** ✅ Fully functional
- **Features:** Player card (team, jersey), tournament history, per-tournament stats, goal/assist/defense averages, SOTG rating
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

---

## Auth Pages

### 13. `/admin/login` — Login
- **Status:** ✅ Fully functional
- **Features:** Email/password form, Supabase Auth
- **No AppShell** (intentional — pre-auth)
- **i18n:** ✅ Uses dictionary lookups

### 14. `/forgot-password` — Forgot Password
- **Status:** ✅ Fully functional
- **No AppShell** (intentional — pre-auth)

### 15. `/reset-password` — Reset Password
- **Status:** ✅ Fully functional
- **No AppShell** (intentional — pre-auth)

---

## Admin Pages (auth required: admin or scorekeeper)

All admin pages enforce auth via `getAuthedUser()` → redirect to `/admin/login` if unauthorized.

### 16. `/admin` — Admin Dashboard
- **Status:** ✅ Fully functional
- **Features:**
  - 5 navigation tiles (Tournaments, Teams, Players, Live Scoring, Schedules)
  - Unscored games widget with scoring links
  - Recently completed widget with game details
  - Upcoming games widget with field info
  - Role-aware display (admin vs scorekeeper)
  - Sign-out button
- **i18n:** ✅ Uses dictionary lookups

### 17. `/admin/tournaments` — Tournament Management
- **Status:** ✅ Fully functional
- **Features:** Sortable tournament table, multi-select with bulk actions, status badges, phase type labels
- **Buttons:** New tournament, edit/delete per-row, view tournament, view bracket
- **i18n:** ✅ Uses dictionary lookups

### 18. `/admin/tournaments/new` — Create Tournament
- **Status:** ✅ Fully functional
- **Form fields:** Name, location, description, start/end dates
- **i18n:** ✅ Uses dictionary lookups

### 19. `/admin/tournaments/[id]/edit` — Edit Tournament + Phases
- **Status:** ✅ Fully functional (FIXED)
- **Features:** Tournament metadata form, phases list with CRUD, phase status/type management, group splitting (round-robin), round-robin schedule generation, bracket generation
- **Fix applied:** Was failing with "no edition possible" — 4 missing API proxy routes created
- **i18n:** ✅ Uses dictionary lookups

### 20. `/admin/tournaments/[id]/games/new` — Schedule Games
- **Status:** ✅ Fully functional
- **Features:** Dual mode — single game form + bulk CSV upload
- **Form fields:** Home/Away team, start time, field number, game rule (time/score limit)
- **CSV mode:** Paste CSV, preview table, template download
- **i18n:** ✅ Uses dictionary lookups

### 21. `/admin/teams` — Team Management
- **Status:** ✅ Fully functional
- **Features:** Team cards grouped by tournament, team count badges, edit links
- **Buttons:** Add team → `/admin/teams/new`, Edit → `/admin/teams/{id}/edit`
- **i18n:** ✅ Uses dictionary lookups

### 22. `/admin/teams/new` — Create Team
- **Status:** ✅ Fully functional
- **Form fields:** Team name, tournament select, logo URL
- **i18n:** ✅ Uses dictionary lookups

### 23. `/admin/teams/[id]/edit` — Edit Team
- **Status:** ✅ Fully functional
- **Form fields:** Name, tournament select, logo URL
- **Actions:** Save → PUT, Delete → DELETE
- **i18n:** ✅ Uses dictionary lookups

### 24. `/admin/players` — Player Management
- **Status:** ✅ Fully functional
- **Features:** Searchable player table, inline "Add player" form, edit links
- **i18n:** ✅ Uses dictionary lookups

### 25. `/admin/players/[id]/edit` — Edit Player
- **Status:** ✅ Fully functional (FIXED)
- **Form fields:** First name, last name, jersey number, team select
- **Actions:** Save → PUT, Delete → DELETE (admin only)
- **Fix applied:** Update error resolved (API proxy route was missing or misconfigured)
- **i18n:** ✅ Uses dictionary lookups

### 26. `/admin/games` — Games Management / Scorekeeping Dashboard
- **Status:** ✅ Fully functional
- **Features:** Table of all games with tournament filter, status badges, date, matchup, score
- **Buttons:** Score → `/admin/games/{id}/score`, View → `/games/{id}`, New game
- **i18n:** ✅ Uses dictionary lookups

### 27. `/admin/games/[id]/score` — Live Scoring Console
- **Status:** ✅ Fully functional (FIXED)
- **Features:**
  - Live score display with +1 buttons
  - Player event recording (goal, assist, defense)
  - Half advance, timeout/end-timeout
  - End game
  - Live/chronometer toggle
- **Fix applied:** API 401 "Missing bearer token" error resolved — Supabase JWT now correctly forwarded to FastAPI backend
- **i18n:** ✅ Uses dictionary lookups

---

## API Proxy Routes (Next.js Route Handlers)

These proxy requests to FastAPI, forwarding the Supabase JWT:

| Route | Method | Purpose |
|---|---|---|
| `/api/admin/games/[gameId]/events` | POST | Record game events (goal/assist/defense) |
| `/api/admin/games/[gameId]/events/undo` | DELETE | Undo last event |
| `/api/admin/games/[gameId]/route` | PATCH | Update game metadata (timeout/half/end) |
| `/api/admin/games/[gameId]/advance-half` | POST | Advance to next half |
| `/api/admin/games/[gameId]/end` | POST | End the game |
| `/api/admin/games/[gameId]/end-timeout` | POST | End timeout |
| `/api/admin/games/[gameId]/timeout` | POST | Start timeout |
| `/api/games/route` | GET/POST | List/create games |
| `/api/teams/route` | GET/POST | List/create teams |
| `/api/teams/[id]/route` | GET/PUT/DELETE | Team CRUD |
| `/api/tournaments/route` | GET/POST | List/create tournaments |
| `/api/tournaments/[id]/route` | GET/PUT | Tournament CRUD |
| `/api/tournaments/[id]/phases/route` | GET/POST | List/create phases |
| `/api/phases/[phaseId]/bracket/route` | POST | Generate bracket |
| `/api/phases/[phaseId]/round-robin/route` | POST | Generate round-robin schedule |

---

## Shared Components (`app/_components/`)

| Component | Purpose |
|---|---|
| `AppShell.tsx` | Main layout wrapper (topbar, nav, footer) — used by every page |
| `AuthLockup.tsx` | Auth form layout (login/reset pages) |
| `EmptyState.tsx` | Generic empty state placeholder |
| `ErrorState.tsx` | Generic error state placeholder |
| `I18nProvider.tsx` | Client-side i18n context provider |
| `LanguageSwitcher.tsx` | Language dropdown (en/es/pt-BR) |
| `SignOutButton.tsx` | Client-side sign-out button |
| `ThemeProvider.tsx` | Dark/light mode context |
| `ThemeToggle.tsx` | Theme toggle button |

---

## Key Architectural Patterns

1. **`force-dynamic`** on every page — no static generation; auth context must be fresh per request.
2. **`AppShell`** is the universal layout — every page wraps content in it with `brandSubtitle`, `authLinks`, and optional `footerText`.
3. **`ps-admin` section** is the content container used by both admin and public pages.
4. **Team color accents** are generated via `teamColor(name)` from a deterministic hash → HSL color.
5. **Power formulas** are consistent across all surfaces:
   - **Players:** `goals + assists×0.7 + defenses×0.5`
   - **Teams:** `wins×2 + (PF-PA)/10`
6. **Match Evolution SVG** uses step-line chart; `time_elapsed` stored in seconds (backend) → minutes (display).
7. **Auth forwarding:** Server components read JWT from Supabase cookies via `readBearerToken()` → forwarded as Bearer token to FastAPI.
8. **i18n:** Dictionary-based (`messages/{en,es,pt-BR}.json`), loaded server-side via `getServerLocale()`.

---

## Issues Summary

### Critical (Fixed)
1. ✅ **RLS disabled on 12 tables** — Fixed via migration
2. ✅ **Games table missing clock columns** — Fixed via migration
3. ✅ **SECURITY DEFINER on views** — Fixed with `security_invoker = true`
4. ✅ **Tournament edit "no edition possible"** — 4 missing API proxy routes created
5. ✅ **Admin dashboard wrong links** — Tournaments → `/admin/tournaments`, Live Scoring → `/admin/games`
6. ✅ **Game events showed player IDs instead of names** — Roster name lookup on `/games/[id]`
7. ✅ **API 401 "Missing bearer token"** — Supabase JWT correctly forwarded to FastAPI
8. ✅ **Player edit update error** — API proxy route fixed

### Enhancements Completed
9. ✅ **Teams page** — Tournament picker, real stats from games data (W-L-T, GF, PA, Diff, Power)
10. ✅ **Games list** — Team names resolved, "enter result" hidden for public
11. ✅ **Game detail** — PoM, top scorers, evolution SVG graph, clickable name links
12. ✅ **Bracket page** — Consolation brackets (3rd/5th/7th/9th) for placement games
13. ✅ **Team profile** — Full player stats table with power, averages, MVP
14. ✅ **Phase standings page** — Backend-computed standings per phase/group
15. ✅ **i18n completeness** — All pages using dictionary lookups (en/es/pt-BR)
