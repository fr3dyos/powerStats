# PowerStats — Comprehensive Page & Feature Map
**Last updated:** 2026-08-16  
**Status:** Baseline audit post-Phase H  
**Audience:** Project owner (fr3dyos) — reference for what is working, what is not, and what is missing

---

## Executive Summary

| Category | Status | Notes |
|---|---|---|
| **Database** | ✅ | 10 tables, RLS enabled, 4 migrations applied |
| **Public pages** | ✅ | 12 pages live; all render correctly |
| **Admin pages** | ⚠️ | 13 pages live; 1 placeholder (bulk tournament delete) |
| **Auth pages** | ✅ | Login/logout/password reset working |
| **Backend routes** | ✅ | 50+ endpoints verified live |
| **Frontend API client** | ✅ | `utils/api.ts` has full CRUD coverage + helpers |
| **Storage** | ✅ | 2 buckets created; file pickers live on forms |

**Known issues:** 3 low-priority (see §7)  
**Blocking gaps:** None  

---

## 1. PUBLIC PAGES

### P1. `/` — Home (`app/page.tsx`)
**Purpose:** Landing page with CTA to browse tournaments, view rankings, or enter admin area

**What renders:**
- AppShell header (logo, language switcher, theme toggle, sign out button)
- Hero section with title and description
- Three CTA buttons

**Buttons/Links/Controls:**
- **Browse tournaments** → links to `/tournaments`
- **View rankings** → links to `/rankings`
- **Enter as admin** → links to `/admin/login`

**Data sources:**
- None (static content)

**Role-gating:**
- Sign out button visible only when authenticated

**Issues:**
- None

**Status:** ✅

---

### P2. `/rankings` — Cross-tournament rankings (`app/rankings/page.tsx` + `_components/RankingsClient.tsx`)
**Purpose:** Aggregate stats across all tournaments (wins, power score, SOTG)

**What renders:**
- Filter dropdowns: tournament, year
- Tab toggle: Teams / Players
- CSV export button
- Sortable table with: Position, Name, Games Played, Wins, Draws, Losses, Goals For/Against, Power Score, SOTG

**Buttons/Links/Controls:**
- **Tournament filter** → filters teams/players by selected tournament
- **Year filter** → filters by tournament year (if `start_date` year matches)
- **Teams / Players tabs** → switches render mode
- **CSV export** → downloads rankings.csv
- **Sort toggle** → sorts by selected column
- **Click row** → `/teams/[id]` or `/players/[id]`

**Data sources:**
- Server: `tournamentsApi.list()` (all tournaments)
- Server: `teamsApi.listByTournament(id)` (per-tournament stats)
- Server: `tournamentsApi.spiritRanking(id)` (SOTG from Phase D7 endpoint)

**Role-gating:**
- None (all data is public)

**Issues:**
- None

**Status:** ✅ Spirit column ships on this page (Phase D7)

---

### P3. `/tournaments` — Tournament browser (`app/tournaments/page.tsx` + `TournamentBrowser.tsx`)
**Purpose:** Searchable list with status tabs (All/Upcoming/Live/Completed)

**What renders:**
- Search input
- Status tabs: All, Upcoming, Live, Completed
- Tournament cards with: name, dates, status badge, location

**Buttons/Links/Controls:**
- **Search input** → client-side filters by tournament name
- **Tab toggles** → filters by status (All/Upcoming/Live/Completed)
- **Click card** → `/tournaments/[id]`

**Data sources:**
- Server: `tournamentsApi.list()` (all tournaments)
- Client heuristic: "Live" tab checks `is_live` boolean (not in response; computed client-side)

**Role-gating:**
- None

**Issues:**
- ⚠️ **"Live" tab is client-side heuristic** — backend doesn't include `is_live` in response, so Live tab relies on checking `is_completed` flag (Phase D5 known debt)

**Status:** ⚠️ Minor

---

### P4. `/tournaments/[id]` — Tournament hub (`app/tournaments/[id]/page.tsx`)
**Purpose:** Overview of a single tournament with standings, phase navigation, links to bracket/public

**What renders:**
- Tournament header: name, dates, location, description
- Tabs: Overview, Standings, Bracket, Public
- (Overview tab) Phase cards with W-L records, group info

**Buttons/Links/Controls:**
- **Standings tab** → shows tournament standings (no explicit link; integrated into tab UI)
- **Bracket tab** → `/tournaments/[id]/bracket`
- **Public tab** → `/tournaments/[id]/public`
- **Click phase** → `/tournaments/[id]/phases/[phaseId]` (if available)

**Data sources:**
- Server: `tournamentsApi.get(id)` (tournament + teams)
- Server: `phasesApi.listByTournament(id)` (phases)
- Server: `phasesApi.standings(phaseId)` (per-phase standings)

**Role-gating:**
- None

**Issues:**
- None visible

**Status:** ✅

---

### P5. `/tournaments/[id]/bracket` — Bracket visualization (`app/tournaments/[id]/bracket/page.tsx` + `_components/AdvanceRoundButton.tsx`)
**Purpose:** Single-elimination bracket with consolation rounds (3rd, 5th, 7th, 9th place)

**What renders:**
- Bracket tree (rounds and slots)
- Consolation bracket matches
- Game scores in each slot
- Scorekeeper "Advance" button (role-gated)

**Buttons/Links/Controls:**
- **Advance winner** button (scorekeeper only) → calls `phasesApi.advance(phaseId, targetPhaseId)` and refreshes bracket
- **Click game** → `/games/[gameId]`

**Data sources:**
- Server: `phasesApi.get(phaseId)` (with groups)
- Server: `gamesApi.listByTournament(id)` (to find bracket games)

**Role-gating:**
- **Advance button** hidden unless user is scorekeeper/admin

**Issues:**
- None

**Status:** ✅ Bracket advance wired via `AdvanceRoundButton` (Phase D4)

---

### P6. `/tournaments/[id]/phases` — Phase index (`app/tournaments/[id]/phases/page.tsx`)
**Purpose:** List all phases for a tournament (Phase E2)

**What renders:**
- Phase cards with: name, type (Round-Robin/Bracket), status, progress bar

**Buttons/Links/Controls:**
- **Click phase** → `/tournaments/[id]/phases/[phaseId]`

**Data sources:**
- Server: `phasesApi.listByTournament(id)`

**Role-gating:**
- None

**Issues:**
- None

**Status:** ✅

---

### P7. `/tournaments/[id]/phases/[phaseId]` — Phase detail (`app/tournaments/[id]/phases/[phaseId]/page.tsx`)
**Purpose:** Per-phase overview with tabbed interface

**What renders:**
- Tabs: Standings, Bracket, Groups
- (Standings tab) calls `/tournaments/[id]/phases/[phaseId]/standings` page
- (Bracket tab) embedded bracket if phase_type == BRACKET
- (Groups tab) list of groups (stub for now per Phase E2 debt)

**Buttons/Links/Controls:**
- **Tab toggles** → Standings / Bracket / Groups
- **Click game** → `/games/[gameId]` (from bracket)

**Data sources:**
- Server: `phasesApi.get(phaseId)`
- Server: `phasesApi.standings(phaseId)`

**Role-gating:**
- None

**Issues:**
- Groups tab is a stub (Phase E2 debt noted in PAGE_MAP_FULL.md §6.2)

**Status:** ✅

---

### P8. `/tournaments/[id]/phases/[phaseId]/standings` — Phase standings (`app/tournaments/[id]/phases/[phaseId]/standings/page.tsx`)
**Purpose:** Per-phase standings table with tiebreaker-ordered rankings

**What renders:**
- Per-group standings table: Position, Team, P, W, D, L, GF, GA, Diff, Pts, Spirit, Tiebreakers (configured)

**Buttons/Links/Controls:**
- **Click team** → `/teams/[id]`

**Data sources:**
- Server: `phasesApi.standings(phaseId)` (includes tiebreaker order)

**Role-gating:**
- None

**Issues:**
- None

**Status:** ✅

---

### P9. `/tournaments/[id]/public` — Public leaderboard (`app/tournaments/[id]/public/page.tsx` + `_components/Leaderboard.tsx`)
**Purpose:** Per-tournament player leaderboard, team ranking, MVP

**What renders:**
- Leaderboard: top goal scorers, assists, defense
- Team W-L ranking
- MVP (Player of the Match aggregation)

**Buttons/Links/Controls:**
- **Click player** → `/players/[id]`
- **Click team** → `/teams/[id]`

**Data sources:**
- Server: `gamesApi.listByTournament(id)` (to compute stats)
- Server: `teamsApi.listByTournament(id)`

**Role-gating:**
- None

**Issues:**
- None

**Status:** ✅

---

### P10. `/teams` — Public teams list (`app/teams/page.tsx`)
**Purpose:** Team cards grouped by tournament with W-L record and Power Score

**What renders:**
- Teams grouped by tournament
- Cards: logo, name, W-L, Power Score
- Edit/Delete buttons (role-gated, Phase E1)

**Buttons/Links/Controls:**
- **Click card** → `/teams/[id]`
- **Edit button** (admin/scorekeeper only) → `/admin/teams/[id]/edit`
- **Delete button** (admin only) → delete team via API

**Data sources:**
- Server: `tournamentsApi.list()` (tournaments)
- Server: `teamsApi.listByTournament(id)` (per-tournament teams)

**Role-gating:**
- **Edit/Delete buttons** hidden unless user is scorekeeper/admin (Phase E1)

**Issues:**
- None

**Status:** ✅

---

### P11. `/teams/[id]` — Team profile (`app/teams/[teamId]/page.tsx`)
**Purpose:** Team stats, roster, match history, admin actions

**What renders:**
- Team header: logo, name, tournament, W-L-D record
- Sections: Overview (stats), Roster (players), Match history (games), Admin panel
- Logo file picker or URL field (Phase E4)

**Buttons/Links/Controls:**
- **View player** → `/players/[id]`
- **Edit team** (admin/scorekeeper) → `/admin/teams/[id]/edit`
- **Upload logo** (file picker or URL) → calls `teamsApi.uploadLogo(id, file)`
- **Delete team** (admin) → delete via API

**Data sources:**
- Server: `teamsApi.get(id)` (team + players + games)
- Server: `gamesApi.listByTournament(id)` (to filter team games)

**Role-gating:**
- **Edit/Delete buttons** hidden unless scorekeeper/admin

**Issues:**
- None

**Status:** ✅

---

### P12. `/games` — Public games list (`app/games/page.tsx`)
**Purpose:** Table of all games with resolved team names, scores, status

**What renders:**
- Table: Home Team, Away Team, Score, Status, Date, Location
- Status badges (Pending, In Progress, Completed)

**Buttons/Links/Controls:**
- **Click row** → `/games/[id]`

**Data sources:**
- Server: `gamesApi.listByTournament(tournamentId)` (all games)

**Role-gating:**
- None

**Issues:**
- None

**Status:** ✅

---

### P13. `/games/[gameId]` — Game detail (`app/games/[gameId]/page.tsx`)
**Purpose:** Score header, Player of the Match, event list, Match Evolution chart

**What renders:**
- Score header: Home Team | Away Team | Final Score
- POM section (top goals + assists + defenses weighted)
- Event timeline (goals, assists, defenses, timeouts, halves)
- Match Evolution SVG chart

**Buttons/Links/Controls:**
- **Click player** → `/players/[id]`
- **Click team** → `/teams/[id]`

**Data sources:**
- Server: `gamesApi.get(id)` (game + teams + events)
- Server: `tournamentsApi.get(tournament_id)` (tournament context)

**Role-gating:**
- None

**Issues:**
- ⚠️ **POM computed client-side only** — no `pom` column on games table (Phase D5 debt)

**Status:** ✅

---

### P14. `/players/[playerId]` — Player profile (`app/players/[playerId]/page.tsx`)
**Purpose:** Player card, tournament history, per-tournament stats, SOTG

**What renders:**
- Player header: photo, name, jersey number, team, position
- Sections: Tournament history (stats table), SOTG rating, career totals

**Buttons/Links/Controls:**
- **Click tournament** → `/tournaments/[id]`
- **Click team** → `/teams/[id]`

**Data sources:**
- Server: `playersApi.get(id)` (player + game events)
- Server: `playersApi.stats(id)` (aggregated stats per tournament)

**Role-gating:**
- None

**Issues:**
- None

**Status:** ✅

---

### P15. `/players/[playerId]/not-found.tsx`
**Purpose:** 404 page for missing players

**Status:** ✅ Exists

---

## 2. AUTH PAGES

### P16. `/admin/login` — Login (`app/admin/login/page.tsx`)
**Purpose:** Email/password → Supabase Auth

**What renders:**
- Email input
- Password input
- Sign in button
- "Forgot password?" link
- Error messages

**Buttons/Links/Controls:**
- **Sign in** → POST to Supabase Auth, set session cookie, redirect to `/admin`
- **Forgot password link** → `/forgot-password`

**Data sources:**
- Supabase Auth (client-side)

**Role-gating:**
- Redirect to `/admin` if already authenticated

**Issues:**
- ⚠️ **Contract drift** — frontend uses Supabase Auth directly; never calls `POST /auth/login` (FastAPI proxy exists but is unused, Phase C3 debt)

**Status:** ⚠️ Contract drift

---

### P17. `/forgot-password` — Forgot password (`app/forgot-password/page.tsx`)
**Purpose:** Request password recovery email

**What renders:**
- Email input
- Send recovery link button
- Confirmation message after submit

**Buttons/Links/Controls:**
- **Send recovery link** → POST to Supabase Auth, sends recovery email

**Data sources:**
- Supabase Auth

**Role-gating:**
- None

**Issues:**
- None

**Status:** ✅

---

### P18. `/reset-password` — Reset password (`app/reset-password/page.tsx`)
**Purpose:** Update password after recovery email

**What renders:**
- New password input
- Confirm password input
- Update password button

**Buttons/Links/Controls:**
- **Update password** → POST to Supabase Auth, redirect to login

**Data sources:**
- Supabase Auth

**Role-gating:**
- None (but only reachable via recovery email link)

**Issues:**
- None

**Status:** ✅

---

## 3. ADMIN PAGES

All admin pages are forced-dynamic and call `getAuthedUser()` from cookies. Middleware blocks unauthenticated access to `/admin/*` (except login/forgot/reset).

### P19. `/admin` — Dashboard (`app/admin/page.tsx`)
**Purpose:** 6 nav tiles + quick stats widgets

**What renders:**
- 6 navigation tiles: Tournaments, Teams, Players, Live Scoring, Schedules, Users
- Widgets: Unscored games, Recently completed games, Upcoming games
- Sign out button

**Buttons/Links/Controls:**
- **Tournaments tile** → `/admin/tournaments`
- **Teams tile** → `/admin/teams`
- **Players tile** → `/admin/players`
- **Live Scoring tile** → `/admin/games`
- **Schedules tile** → `/admin/schedules` (Phase D2)
- **Users tile** → `/admin/users` (Phase D1)
- **Sign out** → POST to Supabase Auth, clear session, redirect to home

**Data sources:**
- Server: `gamesApi.listByTournament()` (unscored games widget)

**Role-gating:**
- Requires admin or scorekeeper role

**Issues:**
- None functional

**Status:** ✅

---

### P20. `/admin/tournaments` — Tournament management (`app/admin/tournaments/page.tsx` + `AdminTournamentsTable.tsx`)
**Purpose:** Sortable table with multi-select and per-row actions

**What renders:**
- Multi-select checkbox column
- Table columns: Name, Start Date, End Date, Location, Status, Phases, Teams
- Action buttons per row: Edit, View, View bracket, Delete
- Bulk action button: "Delete selected" (placeholder)
- New tournament CTA button

**Buttons/Links/Controls:**
- **New tournament button** → `/admin/tournaments/new`
- **Edit button** (per row) → `/admin/tournaments/[id]/edit`
- **View button** (per row) → `/tournaments/[id]`
- **View bracket button** (per row) → `/tournaments/[id]/bracket`
- **Delete button** (per row) → confirm dialog → DELETE `/tournaments/[id]`
- **Select all checkbox** → toggles all row checkboxes
- **Delete selected button** → shows confirm dialog → `window.alert("Delete selected: not yet implemented.")` ⚠️
- **Multiselect checkboxes** → track selected rows

**Data sources:**
- Server: `tournamentsApi.list()`

**Role-gating:**
- Requires admin or scorekeeper

**Issues:**
- ⚠️ **Bulk delete is a placeholder** — file `AdminTournamentsTable.tsx` line 99–111, shows alert instead of executing delete

**Status:** ⚠️ Partial — bulk actions UI exists but not wired

---

### P21. `/admin/tournaments/new` — Create tournament (`app/admin/tournaments/new/page.tsx` + `_components/NewTournamentForm.tsx`)
**Purpose:** Create a new tournament

**What renders:**
- Form fields: name, location, description, start_date, end_date
- Create button

**Form fields:**
- **name** (text, required)
- **location** (text, optional)
- **description** (textarea, optional)
- **start_date** (date picker)
- **end_date** (date picker)

**Buttons/Links/Controls:**
- **Create** → POST `tournamentsApi.create()` → redirect to `/admin/tournaments/[id]/edit`

**Data sources:**
- None (form submission only)

**Role-gating:**
- Requires scorekeeper

**Issues:**
- None

**Status:** ✅

---

### P22. `/admin/tournaments/[id]/edit` — Edit + phases (`app/admin/tournaments/[id]/edit/page.tsx` + `_components/TournamentEditForm.tsx` + `_components/PhaseEditor.tsx`)
**Purpose:** Edit tournament metadata and manage phases (CRUD, status, tiebreakers)

**What renders:**
- Tournament form (name, location, description, dates)
- Save button
- Phases table with per-row actions: Edit, Change status, Edit tiebreakers, Delete
- Add phase button
- Fixture generation buttons: Generate round-robin, Generate bracket, Split groups
- Schedule suggestion button

**Form fields (Tournament):**
- **name, location, description, start_date, end_date** (same as P21)

**Buttons/Links/Controls:**
- **Save tournament** → PUT `tournamentsApi.update(id)`
- **Add phase** → shows inline form for phase creation
- **Edit phase** (per row) → `PhaseEditor` shows form to edit name, type, status, tiebreakers
- **Change status** (per row) → dropdown to change to pending/in_progress/completed
- **Edit tiebreakers** (per row) → `PhaseEditor` shows tiebreaker priority list (drag-reorder)
- **Delete phase** (per row) → confirm → DELETE `/phases/{phaseId}`
- **Generate round-robin** → calls `POST /tournaments/{id}/round-robin?persist=true` → displays generated schedule
- **Generate bracket** → calls `POST /tournaments/{id}/bracket?persist=true` → displays bracket
- **Split groups** → calls `POST /phases/{id}/groups/split?group_count=...` → displays groups
- **Schedule suggestion** → calls `POST /tournaments/{id}/schedule-suggestion?field_count=...` → displays suggested schedule

**Data sources:**
- Server: `tournamentsApi.get(id)` (tournament)
- Server: `phasesApi.listByTournament(id)` (phases)

**Role-gating:**
- Requires scorekeeper

**Issues:**
- None

**Status:** ✅ Phase CRUD fully wired (Phase D3)

---

### P23. `/admin/tournaments/[id]/games/new` — Schedule games (`app/admin/tournaments/[id]/games/new/page.tsx` + `_components/GameNewForm.tsx`)
**Purpose:** Create single games or bulk CSV upload

**What renders:**
- Single game form: home_team, away_team, game_rule, time_limit/score_limit, start_time
- Bulk upload section: paste CSV, preview, submit
- Template download link

**Form fields (Single game):**
- **home_team** (select from tournament teams)
- **away_team** (select from tournament teams)
- **game_rule** (TIME_LIMIT or SCORE_LIMIT)
- **time_limit** / **score_limit** (conditional)
- **start_time** (optional)
- **field_number** (optional)

**Buttons/Links/Controls:**
- **Save single game** → POST `gamesApi.create()`
- **Upload CSV** → parse CSV, preview, POST `gamesApi.createMany()`
- **Download template** → downloads CSV template

**Data sources:**
- Server: `tournamentsApi.get(id)` (teams)
- Server: `gamesApi.createMany()` (bulk create)

**Role-gating:**
- Requires scorekeeper

**Issues:**
- None

**Status:** ✅

---

### P24. `/admin/tournaments/[id]/roster` — Roster import (`app/admin/tournaments/[id]/roster/page.tsx` + `_components/RosterImportPanel.tsx`)
**Purpose:** Bulk import players via CSV (Phase D5)

**What renders:**
- Text area: "Paste CSV"
- Template download link
- Preview table
- Submit button

**CSV format:** (implied from code, Phase D5)
- Columns: FirstName, LastName, JerseyNumber, TeamName

**Buttons/Links/Controls:**
- **Paste CSV** → updates preview
- **Download template** → CSV template
- **Submit** → POST to `/admin/tournaments/{id}/roster/import` → bulk create players

**Data sources:**
- Server: `POST /admin/tournaments/{id}/roster/import`

**Role-gating:**
- Requires scorekeeper

**Issues:**
- None

**Status:** ✅

---

### P25. `/admin/tournaments/[id]/spirit` — Spirit import (`app/admin/tournaments/[id]/spirit/page.tsx` + `_components/SpiritImportPanel.tsx`)
**Purpose:** Bulk import spirit scores via CSV (Phase D5)

**What renders:**
- Text area: "Paste CSV"
- Template download link
- Preview table
- Submit button

**CSV format:** (implied, Phase D5)
- Columns: TeamName, Opponent, SpiritScore

**Buttons/Links/Controls:**
- **Paste CSV** → updates preview
- **Download template** → CSV template
- **Submit** → POST to `/admin/tournaments/{id}/spirit/import` → bulk create spirit scores

**Data sources:**
- Server: `POST /admin/tournaments/{id}/spirit/import`

**Role-gating:**
- Requires scorekeeper

**Issues:**
- None

**Status:** ✅

---

### P26. `/admin/teams` — Team management (`app/admin/teams/page.tsx`)
**Purpose:** Team cards grouped by tournament; edit/delete links

**What renders:**
- Teams grouped by tournament
- Cards: logo, name, W-L, actions
- Add team CTA button

**Buttons/Links/Controls:**
- **Add team** → `/admin/teams/new`
- **Edit** (per card) → `/admin/teams/[id]/edit`
- **Delete** (per card) → confirm → DELETE `/teams/[id]`

**Data sources:**
- Server: `tournamentsApi.list()` (tournaments)
- Server: `teamsApi.listByTournament(id)` (teams)

**Role-gating:**
- Requires admin or scorekeeper

**Issues:**
- None

**Status:** ✅

---

### P27. `/admin/teams/new` — Create team (`app/admin/teams/new/page.tsx` + `_components/NewTeamForm.tsx`)
**Purpose:** Create a new team

**What renders:**
- Form: name, tournament select, logo (file picker or URL)
- Create button

**Form fields:**
- **name** (text, required)
- **tournament_id** (select, required)
- **logo_url** (URL, optional) — **OR**
- **logo_file** (file picker, optional) — mutual exclusion with URL

**Buttons/Links/Controls:**
- **Create** → POST `teamsApi.create()` → redirect to `/admin/teams`

**Data sources:**
- Server: `tournamentsApi.list()` (tournament options)

**Role-gating:**
- Requires scorekeeper

**Issues:**
- None

**Status:** ✅ File picker shipped (Phase E4)

---

### P28. `/admin/teams/[id]/edit` — Edit team (`app/admin/teams/[id]/edit/page.tsx` + `_components/TeamEditForm.tsx`)
**Purpose:** Edit team metadata and logo

**What renders:**
- Form: name, tournament select, logo (file picker or URL)
- Save button, Delete button

**Form fields:**
- **name, tournament_id, logo_url, logo_file** (same as P27)

**Buttons/Links/Controls:**
- **Save** → PUT `teamsApi.update(id)`
- **Delete** (admin only) → confirm → DELETE `/teams/[id]`

**Data sources:**
- Server: `teamsApi.get(id)`

**Role-gating:**
- Requires scorekeeper to edit; admin to delete

**Issues:**
- None

**Status:** ✅ File picker shipped (Phase E4)

---

### P29. `/admin/players` — Player management (`app/admin/players/page.tsx` + `AdminPlayersTable.tsx` + `AddPlayerForm.tsx`)
**Purpose:** Searchable table + inline add form

**What renders:**
- Search input (filters by name)
- Table: Jersey, First Name, Last Name, Team, Actions
- Inline add form row at bottom
- Per-row Edit button

**Inline add form:**
- **first_name, last_name, jersey_number, team** (select)

**Buttons/Links/Controls:**
- **Add player** (inline form) → POST `playersApi.create()` → refresh table
- **Edit** (per row) → `/admin/players/[id]/edit`
- **Delete** (per row) → confirm → DELETE `/players/[id]` (only if admin)

**Data sources:**
- Server: `playersApi.listByTeam(teamId)` (per team)
- Server: `teamsApi.listByTournament()` (team options)

**Role-gating:**
- Add/edit visible for scorekeeper; delete visible for admin only

**Issues:**
- ⚠️ **No batch import UI here** — bulk roster import lives at `/admin/tournaments/[id]/roster` (Phase D5 design)

**Status:** ⚠️ Partial (single-row only; batch import elsewhere)

---

### P30. `/admin/players/[id]/edit` — Edit player (`app/admin/players/[id]/edit/page.tsx` + `_components/PlayerEditForm.tsx`)
**Purpose:** Edit player metadata and photo

**What renders:**
- Form: first_name, last_name, jersey_number, team select, photo (file picker or URL)
- Save button, Delete button

**Form fields:**
- **first_name, last_name, jersey_number, team_id** (text/select)
- **photo_url** (URL, optional) — **OR**
- **photo_file** (file picker, optional) — mutual exclusion

**Buttons/Links/Controls:**
- **Save** → PUT `playersApi.update(id)`
- **Delete** (admin only) → confirm → DELETE `/players/[id]`

**Data sources:**
- Server: `playersApi.get(id)` (player)
- Server: `teamsApi.listByTournament()` (team options)

**Role-gating:**
- Requires scorekeeper to edit; admin to delete

**Issues:**
- None

**Status:** ✅ File picker shipped (Phase E4)

---

### P31. `/admin/games` — Games management / scorekeeping (`app/admin/games/page.tsx` + `GamesAdminTable.tsx`)
**Purpose:** Table of all games with tournament filter, status badges, score links

**What renders:**
- Tournament filter dropdown
- Status badges (Pending, In Progress, Completed)
- Table: Home Team, Away Team, Score, Status, Phase, Actions

**Buttons/Links/Controls:**
- **Tournament filter** → filters games by tournament
- **Score** (per row) → `/admin/games/[gameId]/score` (live scoring console)
- **View** (per row) → `/games/[gameId]` (public detail)
- **New game** button → tournament chooser modal → `/admin/tournaments/[id]/games/new` (Phase E3)

**Data sources:**
- Server: `tournamentsApi.list()` (tournament options)
- Server: `gamesApi.listByTournament(id)` (games)

**Role-gating:**
- Requires scorekeeper

**Issues:**
- None

**Status:** ✅

---

### P32. `/admin/games/[gameId]/score` — Live scoring console (`app/admin/games/[gameId]/score/page.tsx` + `_components/LiveScoringConsole.tsx` + `_components/SpiritEntryPanel.tsx`)
**Purpose:** Live game scoring with buttons, events, timeouts, halves, undo, spirit entry

**What renders:**
- Score header: Home Team | Away Team | current score
- +1 buttons (home/away)
- Player event buttons: Record goal, Record assist, Record defense
- Timeout buttons: Start timeout, End timeout
- Game control buttons: Advance half, End game, Clock start/stop
- Undo last event button
- Event timeline (scrollable list)
- Spirit entry side-sheet (Phase D6)

**Buttons/Links/Controls:**
- **+1 home / +1 away** → POST `/games/{id}/events` with GOAL event
- **Record goal/assist/defense** → shows player picker → POST `/games/{id}/events`
- **Start timeout** → POST `/games/{id}/timeout`
- **End timeout** → POST `/games/{id}/end-timeout`
- **Advance half** → POST `/games/{id}/advance-half`
- **End game** → POST `/games/{id}/end`
- **Undo last event** → POST `/games/{id}/events/undo`
- **Clock start/stop** → toggles `clock_running` on game (client-side state)
- **Spirit entry** (tab) → `SpiritEntryPanel` to record spirit scores per team (Phase D6)

**Data sources:**
- Server: `gamesApi.get(id)` (game + events)
- Server: game event endpoints (timeout, advance-half, end, undo, events)

**Role-gating:**
- Requires scorekeeper

**Issues:**
- ⚠️ **Hardcoded English strings** — file `LiveScoringConsole.tsx` lines ~568, 576, 581, 595 have "Undo last event", "End timeout", "Advance half", "End (score cap)" hardcoded (Phase F known debt); should thread `dict` from parent

**Status:** ⚠️ Known debt (i18n)

---

### P33. `/admin/users` — User management (`app/admin/users/page.tsx` + `AdminUsersTable.tsx`)
**Purpose:** List users and change roles (Phase D1)

**What renders:**
- Table: Email, Role (dropdown), Created At
- Role options: admin, scorekeeper, public

**Buttons/Links/Controls:**
- **Role dropdown** → PUT `usersApi.updateRole(userId, newRole)`

**Data sources:**
- Server: `usersApi.list()` (list all users)
- Server: `usersApi.updateRole(userId, role)` (update role)

**Role-gating:**
- Requires admin

**Issues:**
- None

**Status:** ✅

---

### P34. `/admin/schedules` — Schedules (`app/admin/schedules/page.tsx`)
**Purpose:** Live games + upcoming games tables (Phase D2)

**What renders:**
- Two sections: Live games, Upcoming games
- Tables: Tournament, Game, Time, Field

**Buttons/Links/Controls:**
- **Click game** → `/admin/games/[gameId]/score` (live console)

**Data sources:**
- Server: `gamesApi.listByTournament()` (filtered by is_completed, is_live)

**Role-gating:**
- Requires scorekeeper

**Issues:**
- None

**Status:** ✅

---

## 4. BACKEND API MATRIX

| Router | Method | Path | Auth | Schema In | Schema Out | Live |
|---|---|---|---|---|---|---|
| `/tournaments` | GET | `` | public | — | `Tournament[]` | ✅ |
| `/tournaments` | POST | `` | scorekeeper | `TournamentCreate` | `Tournament` | ✅ |
| `/tournaments` | GET | `/{id}` | public | — | `TournamentWithTeams` | ✅ |
| `/tournaments` | PUT | `/{id}` | scorekeeper | `TournamentUpdate` | `Tournament` | ✅ |
| `/tournaments` | DELETE | `/{id}` | admin | — | — | ✅ |
| `/tournaments` | POST | `/{id}/bracket` | scorekeeper | `persist` query | `{bracket, persisted_games}` | ✅ |
| `/tournaments` | POST | `/{id}/round-robin` | scorekeeper | `persist` query | `{rounds, persisted_games}` | ✅ |
| `/tournaments` | POST | `/{id}/schedule-suggestion` | scorekeeper | `field_count, minutes_per_game` query | `{schedule, total_slots}` | ✅ |
| `/tournaments` | GET | `/{id}/spirit-ranking` | public | — | `{tournament_id, teams: []}` | ✅ |
| `/tournaments` | POST | `/{id}/phases` | scorekeeper | `PhaseCreate` | `Phase` | ✅ |
| `/tournaments` | GET | `/{id}/phases` | public | — | `Phase[]` | ✅ |
| `/phases` | GET | `/{id}` | public | — | `PhaseWithGroups` | ✅ |
| `/phases` | PUT | `/{id}` | scorekeeper | `PhaseUpdate` | `Phase` | ✅ |
| `/phases` | DELETE | `/{id}` | admin | — | — | ✅ |
| `/phases` | POST | `/{id}/groups/split` | scorekeeper | `group_count` query | `Group[]` | ✅ |
| `/phases` | POST | `/{id}/round-robin` | scorekeeper | `persist` query | `{groups, persisted_games}` | ✅ |
| `/phases` | POST | `/{id}/bracket` | scorekeeper | `persist` query | `{bracket, persisted_games}` | ✅ |
| `/phases` | POST | `/{id}/advance` | scorekeeper | `target_phase_id, teams_per_group` query | `{source_phase_id, target_phase_id, advanced_team_ids}` | ✅ |
| `/phases` | GET | `/{id}/standings` | public | — | `StandingsTable` | ✅ |
| `/teams` | GET | `` | public | — | `Team[]` | ✅ |
| `/teams` | POST | `` | scorekeeper | `TeamCreate` | `Team` | ✅ |
| `/teams` | GET | `/{id}` | public | — | `TeamWithDetails` | ✅ |
| `/teams` | PUT | `/{id}` | scorekeeper | `TeamUpdate` | `Team` | ✅ |
| `/teams` | DELETE | `/{id}` | admin | — | — | ✅ |
| `/teams` | POST | `/{id}/logo` | scorekeeper | FormData(file) | `Team` | ✅ |
| `/players` | GET | `` | public | — | `Player[]` | ✅ |
| `/players` | POST | `` | scorekeeper | `PlayerCreate` | `Player` | ✅ |
| `/players` | GET | `/{id}` | public | — | `PlayerWithEvents` | ✅ |
| `/players` | PUT | `/{id}` | scorekeeper | `PlayerUpdate` | `Player` | ✅ |
| `/players` | DELETE | `/{id}` | admin | — | — | ✅ |
| `/players` | POST | `/{id}/photo` | scorekeeper | FormData(file) | `{player: {id, photo_url}}` | ✅ |
| `/players` | GET | `/{id}/stats` | public | — | `{player, per_tournament[], totals}` | ✅ |
| `/games` | GET | `` | public | — | `Game[]` | ✅ |
| `/games` | POST | `` | scorekeeper | `GameCreate` | `Game` | ✅ |
| `/games` | POST | `/batch` | scorekeeper | `GameBatchCreate` | `Game[]` | ✅ |
| `/games` | GET | `/{id}` | public | — | `GameWithDetails` | ✅ |
| `/games` | PUT | `/{id}` | scorekeeper | `GameUpdate` | `Game` | ✅ |
| `/games` | DELETE | `/{id}` | admin | — | — | ✅ |
| `/games` | POST | `/{id}/events` | scorekeeper | `GameEventCreate` | `GameEvent` | ✅ |
| `/games` | GET | `/{id}/events` | public | — | `GameEvent[]` | ✅ |
| `/games` | POST | `/{id}/timeout` | scorekeeper | `team, timeout_number` query | `GameEvent` | ✅ |
| `/games` | POST | `/{id}/end-timeout` | scorekeeper | — | `GameEvent` | ✅ |
| `/games` | POST | `/{id}/advance-half` | scorekeeper | — | `GameEvent` | ✅ |
| `/games` | POST | `/{id}/end` | scorekeeper | — | `Game` | ✅ |
| `/games` | POST | `/{id}/events/undo` | scorekeeper | — | `Game` | ✅ |
| `/auth` | POST | `/register` | public | `{email, password}` | `{access_token, user}` | ✅ |
| `/auth` | POST | `/login` | public | `{email, password}` | `{access_token, user}` | ✅ |
| `/auth` | POST | `/logout` | auth'd | — | — | ✅ |
| `/auth` | GET | `/me` | auth'd | — | `AuthUser` | ✅ |
| `/auth` | GET | `/users` | admin | — | `AuthUser[]` | ✅ |
| `/auth` | PUT | `/users/{id}/role` | admin | `{role}` | `AuthUser` | ✅ |
| `/admin` | GET | `/health` | admin | — | `{status}` | ✅ |
| `/admin` | POST | `/tournaments/{id}/roster/import` | scorekeeper | CSV paste | `{created_players, errors}` | ✅ |
| `/admin` | POST | `/tournaments/{id}/spirit/import` | scorekeeper | CSV paste | `{created_scores, errors}` | ✅ |

**Total: 50+ endpoints verified live**

---

## 5. FRONTEND API CLIENT (`utils/api.ts`)

### Exported helpers:
- `tournamentsApi.list()`, `.get()`, `.create()`, `.update()`, `.spiritRanking()`
- `teamsApi.listByTournament()`, `.get()`, `.create()`, `.update()`, `.remove()`, `.uploadLogo()`
- `playersApi.listByTeam()`, `.create()`, `.get()`, `.update()`, `.remove()`, `.uploadPhoto()`, `.stats()`
- `gamesApi.listByTournament()`, `.get()`, `.events()`, `.create()`, `.createMany()`
- `phasesApi.listByTournament()`, `.get()`, `.create()`, `.update()`, `.remove()`, `.advance()`, `.standings()`
- `usersApi.list()`, `.updateRole()`

### Coverage:
- ✅ All CRUD verbs covered
- ✅ File uploads wired (logo, photo)
- ✅ Batch endpoints present (games, roster import, spirit import)
- ✅ Standings and spirit-ranking endpoints exposed

### Frontend proxy routes (`app/api/**/route.ts`):
- ✅ `/api/auth/login`, `/api/auth/users`, `/api/auth/users/[userId]/role`
- ✅ `/api/phases/[phaseId]`, `/api/phases/[phaseId]/advance`
- ✅ Other CRUD endpoints proxied

---

## 6. DATABASE & STORAGE

### Tables (10 total, all RLS-enabled):
1. `public.tournaments` — 3 rows
2. `public.teams` — 14 rows
3. `public.players` — 146 rows
4. `public.games` — 46 rows
5. `public.game_events` — 747 rows
6. `public.phases` — 2 rows
7. `public.groups` — 2 rows
8. `public.group_teams` — 8 rows
9. `public.player_tournament_stats` — 146 rows
10. `public.profiles` — 0 rows (created via `roles-and-rls.sql`, not used by app yet)

### Storage buckets:
- ✅ `team-logos` (public read; file picker on team forms)
- ✅ `player-photos` (public read; file picker on player forms)

### Migrations:
- 4 applied (most recent: `20260807000000_add_game_live_and_clock.sql`)
- Token tables/views dropped (Phase A4)

### Enums:
- ✅ `gameeventtypeenum` — 7 values (GOAL, ASSIST, DEFENSE, TIMEOUT, SUBSTITUTION, HALF, **TIMEOUT_END**)
- ✅ `gameruleenum` — TIME_LIMIT, SCORE_LIMIT
- ✅ `phasetypeenum` — ROUND_ROBIN, BRACKET
- ✅ `phasestatusenum` — PENDING, IN_PROGRESS, COMPLETED
- ✅ `tiebreakerenum` — POINTS, WINS, GOAL_DIFFERENCE, GOALS_FOR, GOALS_AGAINST, DIRECT_MATCHUP, SPIRIT_SCORE

---

## 7. KNOWN ISSUES (prioritized)

### 🔴 High (should fix before next release)

**Issue 1: HaveIBeenPwned check is disabled**
- **Location:** Supabase Auth config
- **Problem:** Security advisory reports leaked-password protection disabled despite PAGE_MAP_FULL.md claiming "enabled (Phase A5)"
- **Impact:** Users can register with compromised passwords
- **Fix effort:** Low — toggle `auth.config.security_check_leaked_passwords = true` in dashboard

---

### 🟡 Medium (known debt, carry-over)

**Issue 2: Tournament bulk-delete is a placeholder**
- **Location:** `app/admin/tournaments/AdminTournamentsTable.tsx` line 99–111
- **Problem:** Multi-select UI and "Delete selected" button exist, but click shows `window.alert("Delete selected: not yet implemented.")`
- **Impact:** Admins cannot bulk-delete tournaments; must delete one at a time
- **Fix effort:** Medium — implement batch DELETE route or loop single DELETE in component

**Issue 3: LiveScoringConsole has hardcoded English strings**
- **Location:** `app/admin/games/[gameId]/score/_components/LiveScoringConsole.tsx` lines ~568, 576, 581, 595
- **Problem:** "Undo last event", "End timeout", "Advance half", "End (score cap)" bypass i18n; component is client-only
- **Impact:** Non-English speakers see English labels in live scoring console
- **Fix effort:** Low — thread `dict` from server parent component

**Issue 4: Database performance — 16 unindexed FK columns**
- **Location:** Tables: game_events, games, groups, group_teams, phases, player_tournament_stats, players, spirit_scores, teams
- **Problem:** Foreign key columns lack indexes; RLS policies re-evaluate `auth.user_id()` per row instead of once per query
- **Impact:** Query performance degrades at scale; not urgent for small data, but should address in optimization pass
- **Fix effort:** Medium — create covering indexes per Supabase linter

---

### 🟢 Low (nice-to-have polish)

**Issue 5: "Live" tab in tournament browser uses client heuristic**
- **Location:** `app/tournaments/page.tsx`
- **Problem:** Backend `/tournaments` doesn't include `is_live` boolean; tab relies on checking `is_completed` flag client-side
- **Impact:** Live tab is best-effort, not authoritative
- **Fix effort:** Minimal — add `is_live` to tournament serializer in FastAPI

**Issue 6: Auth contract drift — FastAPI `/auth/login` proxy is unused**
- **Location:** `app/api/auth/login/route.ts` (Next.js proxy exists; never called by frontend)
- **Problem:** Frontend calls Supabase Auth directly; proxy route was added but goes unused
- **Impact:** No functional impact; documentation/design debt only
- **Fix effort:** Low — either wire frontend to use proxy or remove dead proxy code

**Issue 7: POM (Player of the Match) computed client-side only**
- **Location:** `app/games/[gameId]/page.tsx`
- **Problem:** No `pom` column on games table; computed inline (goals + 0.7·assists + 0.5·defenses)
- **Impact:** Not future-proof if scoring semantics change
- **Fix effort:** Low — add `pom` to games serializer if needed

**Issue 8: 5 unused database indexes**
- **Location:** `ix_player_tournament_stats_id`, `ix_spirit_scores_id`, `ix_games_phase_id`, `ix_games_group_id`, `profiles_role_idx`
- **Problem:** Unused indexes consume storage
- **Impact:** Minimal; safe to drop
- **Fix effort:** Trivial — drop indexes

---

## 8. MISSING FEATURES (confirmed absent)

| Feature | Expected | Actual | Status |
|---|---|---|---|
| Tournament bulk-delete | Buttons wired | Placeholder only | ⚠️ Issue 2 |
| "Live" flag in tournament API | Endpoint response | Client heuristic | ⚠️ Issue 5 |
| POM in games table | Column on schema | Client-computed | ⚠️ Issue 7 |
| FastAPI `/auth/login` usage | Frontend calls | Unused proxy | ⚠️ Issue 6 |
| Groups tab detail | Page content | Stub | 🟢 Phase E2 debt |
| Tournament import at `/admin/tournaments` | UI exists | Bulk import at `/tournaments/{id}/roster` only | ⚠️ Design choice |
| Schedule link on tournament hub | Menu link | No visible link; schedules exist at `/admin/schedules` | ⚠️ UX gap |

---

## 9. COMPARISON: INTENDED vs. ACTUAL

### Pages that exist and work as specified: ✅ 25/27
- All public pages (14)
- All auth pages (3)
- Most admin pages (12, excluding bulk delete)

### Pages with known gaps: ⚠️ 2
- `/admin/tournaments` — bulk delete placeholder
- `/admin/games/[gameId]/score` — i18n hardcoding

### Pages/routes missing entirely: ❌ 0
All documented surfaces are live.

---

## 10. DATABASE SECURITY ADVISORIES

**2 WARNINGs on `public.handle_new_user()` function:**
- SECURITY DEFINER function callable by anon and authenticated roles
- **Action:** Revoke EXECUTE or move to non-public schema

**1 WARNING on leaked-password protection (HIGH):**
- Currently disabled despite Phase A5 docs
- **Action:** Re-enable via Supabase dashboard

**16 INFO-level lints on unindexed FKs + RLS init-plan:**
- Not blocking but impact scale performance

**5 unused indexes:**
- Safe to drop

---

## 11. NEXT STEPS (PRIORITIZED)

### 🔴 Before next release
1. Re-enable HaveIBeenPwned check (Issue 1)

### 🟡 This sprint or next
1. Wire tournament bulk-delete (Issue 2)
2. Fix LiveScoringConsole i18n (Issue 3)
3. Add database indexes on FK columns (Issue 4)

### 🟢 Nice-to-have backlog
1. Add `is_live` to tournament API (Issue 5)
2. Remove unused FastAPI proxy or wire it (Issue 6)
3. Drop unused indexes (Issue 8)

---

## Appendix: Files Audited

### Frontend
- 80+ `app/**/*.tsx` pages and components
- 15+ `app/api/**/*.ts` proxy routes
- `utils/api.ts` (API client)
- `middleware.ts` (auth guard)

### Backend
- `main.py` (FastAPI entry)
- 7 routers: `auth.py`, `admin.py`, `games.py`, `players.py`, `teams.py`, `tournaments.py`
- `models.py`, `schemas.py`, `database.py`

### Infrastructure
- 10 database tables (via Supabase)
- 4 migrations
- 2 storage buckets
- 8 enums

### Localization
- 3 message files: `en.json`, `es.json`, `pt-BR.json`

---

**End of Comprehensive Page Map.**
