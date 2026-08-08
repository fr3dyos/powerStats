# PowerStats — Comprehensive Page Map

> Current state vs ideal state. Every page, every button, every function.

---

## Database Tables (PostgreSQL / Supabase)

| Table | RLS | Policies | Notes |
|---|---|---|---|
| tournaments | ✅ ON | public read | 3 rows |
| teams | ✅ ON | public read | 14 rows |
| players | ✅ ON | public read | ~100+ rows |
| games | ✅ ON | public read | 46 rows; clock columns just added |
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
- **Components:** AppShell → RankingsClient
- **Buttons:** Tournament filter dropdown, Teams/Players tab toggle, CSV export
- **Data:** Aggregates wins/losses/PF/PA/power across all tournaments
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 3. `/tournaments` — Tournament Browser
- **Status:** ✅ Fully functional
- **Components:** AppShell → TournamentBrowser
- **Features:** Search, filter, team counts, game status badges
- **Links:** Click → `/tournaments/{id}`
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 4. `/tournaments/[id]` — Tournament Detail
- **Status:** ✅ Fully functional
- **Features:** Overview, standings, schedule, bracket link
- **Links:** Bracket, public leaderboard, game details
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 5. `/tournaments/[id]/bracket` — Bracket Visualization
- **Status:** ✅ Fully functional
- **Features:** SVG bracket with game results
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 6. `/tournaments/[id]/public` — Public Leaderboard
- **Status:** ✅ Fully functional
- **Features:** Standings, stats, spirit scores
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 7. `/teams` — Public Teams
- **Status:** ⚠️ Partially functional
- **Buttons:** "New team" toggle, inline create form, Edit link, Delete button
- **Issues:**
  - Create form hardcodes `tournament_id=1` (should have a tournament picker)
  - Stats show all zeros (backend doesn't have a stats endpoint for teams)
  - League field is optional text input (not connected to any data)
- **i18n:** ❌ Hardcoded English strings ("Teams", "Team name", "League", etc.)

### 8. `/teams/[id]` — Team Detail
- **Status:** ✅ Fully functional
- **Features:** Player roster, game history
- **i18n:** ✅ Uses dictionary lookups

### 9. `/games` — Public Games
- **Status:** ✅ Fully functional
- **Features:** Game table with date, matchup, score, tournament, status
- **Buttons:** "New game" toggle (placeholder), "View" link, "Enter result" link
- **i18n:** ❌ Hardcoded English strings ("Games", "Date", "Matchup", etc.)

### 10. `/games/[id]` — Game Detail
- **Status:** ✅ Fully functional
- **Features:** Full game record with events
- **i18n:** ✅ Uses dictionary lookups
- **Fix applied:** Events table now resolves player names from both team rosters
  (`playerNameMap`), so the "Player" column shows names instead of raw IDs.

### 11. `/players/[id]` — Player Profile
- **Status:** ✅ Fully functional
- **Features:** Player info, per-tournament stats, game events
- **i18n:** ✅ Uses dictionary lookups

---

## Admin Pages (auth required: admin or scorekeeper)

### 12. `/admin/login` — Login
- **Status:** ✅ Fully functional
- **Features:** Email/password form, Supabase Auth
- **No AppShell** (intentional — pre-auth)
- **i18n:** ✅ Uses dictionary lookups

### 13. `/admin` — Admin Dashboard
- **Status:** ✅ Fully functional
- **Features:**
  - 5 navigation tiles (Tournaments, Teams, Players, Live Scoring, Schedules)
  - Unscored games widget
  - Recently completed widget
  - Upcoming games widget
- **Buttons:** Sign out, links to each section
- **i18n:** ✅ Uses dictionary lookups
- **Fixes applied:**
  - Tournaments tile now links to `/admin/tournaments` (was public `/tournaments`)
  - Live Scoring tile now links to `/admin/games` (the game selector dashboard), not a hard-coded game
- **Missing:** Nothing

### 13b. `/admin/games` — Scorekeeping Dashboard / Game Selector
- **Status:** ✅ Fully functional
- **Features:** Table of all games with tournament filter dropdown, status badges, date, matchup, score
- **Buttons:** "Score" → `/admin/games/[id]/score` (live scoring console), "View" → `/games/[id]` (public), "New game" → `/admin/tournaments/[id]/games/new`
- **Purpose:** Central entry point for scorekeepers to choose which game to score
- **i18n:** ✅ Uses dictionary lookups
- **Missing:** Nothing

### 14. `/admin/teams` — Admin Team Management
- **Status:** ✅ Fully functional
- **Features:** Team table, edit links, create button
- **Buttons:** "New team" → `/admin/teams/new`, Edit → `/admin/teams/[id]/edit`
- **i18n:** ❌ Some hardcoded strings

### 15. `/admin/teams/new` — Create Team
- **Status:** ✅ Fully functional
- **Form fields:** Name, Tournament select, Logo URL
- **Actions:** Submit → POST /api/teams, Cancel → back
- **i18n:** ✅ Uses dictionary lookups

### 16. `/admin/teams/[id]/edit` — Edit Team
- **Status:** ✅ Fully functional
- **Form fields:** Name, Tournament select, Logo URL
- **Actions:** Save → PUT, Delete → DELETE
- **i18n:** ✅ Uses dictionary lookups

### 17. `/admin/players` — Admin Player Management
- **Status:** ✅ Fully functional
- **Features:** Player table, add form, edit links
- **Buttons:** "Add player" inline form, Edit → `/admin/players/[id]/edit`
- **i18n:** ❌ Some hardcoded strings

### 18. `/admin/players/[id]/edit` — Edit Player
- **Status:** ✅ Fully functional
- **Form fields:** First name, Last name, Jersey number, Team select
- **Actions:** Save → PUT, Delete → DELETE (admin only)
- **i18n:** ✅ Uses dictionary lookups

### 19. `/admin/tournaments` — Admin Tournament List
- **Status:** ✅ Fully functional
- **Features:** Tournament table with status badges
- **Buttons:** "New tournament" → `/admin/tournaments/new`, Edit → `/admin/tournaments/[id]/edit`
- **i18n:** ❌ Some hardcoded strings

### 20. `/admin/tournaments/new` — Create Tournament
- **Status:** ✅ Fully functional
- **Form fields:** Name, dates, location, description
- **Actions:** Submit → POST, Cancel → back
- **i18n:** ✅ Uses dictionary lookups

### 21. `/admin/tournaments/[id]/edit` — Edit Tournament
- **Status:** ✅ Fully functional
- **Form fields:** Name, dates, location, description, phases
- **Actions:** Save → PUT, Delete → DELETE, Generate bracket, Generate round-robin
- **i18n:** ✅ Uses dictionary lookups
- **Fix applied:** Was failing with "no edition was possible" because 4 Next.js API
  proxy routes were missing. Created:
  - `app/api/tournaments/[id]/route.ts` (GET/PUT/DELETE)
  - `app/api/tournaments/[id]/phases/route.ts` (GET/POST)
  - `app/api/phases/[phaseId]/round-robin/route.ts` (POST)
  - `app/api/phases/[phaseId]/bracket/route.ts` (POST)

### 22. `/admin/tournaments/[id]/games/new` — Create Games
- **Status:** ✅ Fully functional
- **Features:** Dual mode — single game form + bulk CSV upload
- **Form fields:** Home team, Away team, Start time, Field number, Game rule, Score/Time limit
- **CSV mode:** Paste CSV, preview table, template download
- **Actions:** Submit → POST /games or POST /games/batch
- **i18n:** ✅ Uses dictionary lookups

### 23. `/admin/games/[id]/score` — Live Scoring Console
- **Status:** ✅ Fully functional
- **Features:**
  - Live score display with +1 buttons
  - Player event recording (goal, assist, defense)
  - Half advance, timeout/end-timeout
  - End game
  - Live/chronometer toggle
- **API routes:** 6 Next.js proxy routes for scoring actions
- **i18n:** ✅ Uses dictionary lookups

### 24. `/forgot-password` — Forgot Password
- **Status:** ✅ Fully functional
- **No AppShell** (intentional — pre-auth)

### 25. `/reset-password` — Reset Password
- **Status:** ✅ Fully functional
- **No AppShell** (intentional — pre-auth)

---

## Issues Summary

### Critical (Fixed)
1. ✅ **RLS disabled on 12 tables** — NOW FIXED
2. ✅ **Games table missing clock columns** — NOW FIXED (migration applied)
3. ✅ **SECURITY DEFINER on `player_token_balances` / `team_token_balances` views** — NOW FIXED
   (`ALTER VIEW ... SET (security_invoker = true)`; security advisor clean)
4. ✅ **Tournament edit "no edition possible"** — NOW FIXED (4 missing API proxy routes created)
5. ✅ **Admin dashboard wrong links** — NOW FIXED (Tournaments tile → `/admin/tournaments`,
   Live Scoring tile → `/admin/games`)
6. ✅ **Game events table showed player IDs instead of names** — NOW FIXED (roster name lookup on `/games/[id]`)

### Bug Fixes Needed
7. **Teams page create form hardcodes tournament_id=1** — should use tournament picker
8. **Teams page stats all zeros** — need to compute from games data

### i18n Gaps (hardcoded English)
9. `/teams` page: "Teams", "Team name", "League", "W", "L", "Power score", etc.
10. `/games` page: "Games", "Date", "Matchup", "Score", "Tournament", "Status", etc.
11. Various admin pages have mixed i18n coverage

### Enhancement Opportunities
12. Team-level stats aggregation (wins/losses/power score from games)
13. CSV bulk import for teams and players
14. Real-time game clock timer
15. Phase management UI in tournament edit
16. Spirit score collection UI per game
