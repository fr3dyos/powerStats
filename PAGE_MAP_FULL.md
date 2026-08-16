# PowerStats — Full Diagnostic Page Map (vs. live Supabase)

> **Purpose:** page-by-page map of *intended* behavior, *buttons/functions that should exist*, *what exists today*, and *what is missing or broken* — cross-referenced against the live Supabase project `umcjpphjfjipjwqwxitj` and the GitHub source.
>
> **Audience:** the project owner (fr3dyos) and future Claude sessions maintaining this codebase.
>
> **Method:** read every `app/**/*.tsx` and `app/api/**/route.ts`, every `routers/*.py` and `schemas.py`, then verified the live DB with `mcp__supabase__list_tables`, `list_migrations`, `list_storage_buckets`, `list_edge_functions`, and `get_advisors`. Existing `PAGE_MAP.md` is overwritten below with the corrected truth.
>
> **Status legend — last regenerated 2026-08-15 (post Phases A–H):** every gap identified in §6 has been closed; this document was then re-checked row by row. Items now ✅ reflect what shipped, ⚠️ items reflect known follow-up debt, ❌ items reflect blocking defects that remain, 🚫 means "intentionally absent (see §H)". The most recent code-level deltas are summarized at the bottom of each page entry.

Legend — per page:
- ✅ works as described
- ⚠️ partial — page exists but with bugs, missing actions, or contract drift
- ❌ broken / not implemented despite the docs or PAGE_MAP.md claim
- 🚫 not present — no surface in the codebase

---

## 0. Live Supabase reality (project ref `umcjpphjfjipjwqwxitj`)

| Item | Live state | Drift from code |
|---|---|---|
| `public.tournaments` | ✅ 3 rows, RLS on, public-read | matches `models.Tournament` |
| `public.teams` | ✅ 14 rows, RLS on, public-read | matches |
| `public.players` | ✅ 146 rows, RLS on, public-read | matches |
| `public.games` | ✅ 46 rows, has `phase_id`, `group_id`, `bracket_*`, `is_live`, `clock_*` columns | matches migrations |
| `public.game_events` | ✅ 747 rows | matches |
| `public.phases` | ✅ 2 rows, has `phase_type`, `status`, `config` JSON | matches |
| `public.groups` / `group_teams` | ✅ 2 / 8 rows | matches |
| `public.spirit_scores` | ✅ 0 rows still, but UI now exists (`app/admin/tournaments/[id]/spirit` + bulk import panel) | previously dead end |
| `public.token_rules` | 🚫 **dropped** (Phase A4) | migration `20260806134551_*` deleted; no router, no UI ever existed |
| `public.token_transactions` | 🚫 **dropped** (Phase A4) | same as above |
| `public.player_tournament_stats` | ✅ 146 rows, RLS on | matches |
| **`public.profiles`** | ✅ table created via `supabase/roles-and-rls.sql` apply (Phase A3) | app uses `app_metadata.role` directly; `profiles` is now available for future display-name/avatar work |
| **View `player_token_balances`** | 🚫 **dropped** (Phase A4) | view removed alongside the underlying tables |
| **View `team_token_balances`** | 🚫 **dropped** (Phase A4) | same |
| Enum `gameeventtypeenum` | ✅ **7 values** (incl. `TIMEOUT_END`, added Phase A1) | `/games/{id}/end-timeout` and any future code that wants the marker can use it directly |
| Enum `gameruleenum` | ✅ `TIME_LIMIT, SCORE_LIMIT` | matches |
| Enum `phasetypeenum` | ✅ `ROUND_ROBIN, BRACKET` | matches |
| Enum `phasestatusenum` | ✅ `PENDING, IN_PROGRESS, COMPLETED` | matches |
| Enum `tiebreakerenum` | ✅ schema + UI now wire via `PhaseEditor` status/tiebreakers editing (Phase D3) | used |
| Enum `tokenruletype` | 🚫 **dropped** (Phase A4) | unused — removed with the rest of token economy |
| **Migrations** | 4 applied + token migration deleted | matches `supabase/migrations/` |
| **Storage buckets** | ✅ `team-logos`, `player-photos` (public read, Phase A2) | `routers/teams.py` + `routers/players.py` upload paths now resolve |
| **Edge functions** | 🚫 **0 deployed** | none required for current features |
| **`public.profiles` RLS** | ✅ applied via `roles-and-rls.sql` (Phase A3); `handle_new_user` trigger installed | — |
| **HaveIBeenPwned leaked-password check** | ✅ enabled (`auth.config.security_check_leaked_passwords = true`, Phase A5) | — |
| **Security advisories** | clean | — |

**Implication:** the rebuild prompt (`SUPABASE_REBUILD_PROMPT.md`) tells Claude to recreate the schema and `profiles` table. The current DB does not have `profiles`; the app does not use it. Migrations were applied on top of an existing DB, not from a clean slate. Migrations are additive, idempotent for the most part — they did not backfill `profiles`.

---

## 1. Backend router matrix

| Router prefix | Method + path | Auth | Live | Issue |
|---|---|---|---|---|
| `/auth` | `POST /register` | public | ✅ | — |
| `/auth` | `POST /login` | public | ✅ | — |
| `/auth` | `POST /logout` | auth'd | ✅ | — |
| `/auth` | `GET /me` | auth'd | ✅ | — |
| `/auth` | `GET /users` | admin | ✅ | **PAGE_MAP.md calls this `/admin/users` — wrong** |
| `/auth` | `PUT /users/{user_id}/role` | admin | ✅ | **PAGE_MAP.md calls this `/admin/users/{id}/role` — wrong** |
| `/admin` | `GET /health` | admin | ✅ | — |
| `/admin` | `POST/PUT/DELETE /tournaments` | admin | ✅ | — |
| `/admin` | `POST/PUT/DELETE /teams` | admin | ✅ | — |
| `/admin` | `POST/PUT/DELETE /players` | admin | ✅ | — |
| `/admin` | `POST/PUT/DELETE /games` | admin | ✅ | — |
| `/admin` | `POST /tournaments/{id}/roster` | admin | ✅ | wired via Phase D5 `RosterImportPanel` |
| `/admin` | `POST /tournaments/{id}/roster/import` | admin | ✅ | wired via Phase D5 `RosterImportPanel` |
| `/admin` | `POST /tournaments/{id}/spirit/import` | admin | ✅ | wired via Phase D5 `SpiritImportPanel` |
| `/tournaments` | `GET` / `POST` | public / sk | ✅ | — |
| `/tournaments` | `GET/PUT/DELETE /{id}` | public / sk / admin | ✅ | — |
| `/tournaments` | `POST /{id}/bracket` | sk | ✅ | — |
| `/tournaments` | `POST /{id}/round-robin` | sk | ✅ | — |
| `/tournaments` | `POST /{id}/schedule-suggestion` | sk | ✅ | also exposed through Phase D3 `TournamentEditForm` |
| `/tournaments` | `GET /{id}/spirit-ranking` | public | ✅ | consumed by Phase D7 SOTG column on `/rankings` |
| `/phases` | `GET/POST /tournaments/{id}/phases` | public / sk | ✅ | — |
| `/phases` | `GET/PUT/DELETE /{id}` | mixed | ✅ | edit + delete wired via Phase D3 `TournamentEditForm` |
| `/phases` | `POST /{id}/groups/split` | sk | ✅ | — |
| `/phases` | `POST /{id}/round-robin` | sk | ✅ | — |
| `/phases` | `POST /{id}/bracket` | sk | ✅ | — |
| `/phases` | `POST /{id}/advance` | sk | ✅ | called from Phase D4 bracket `AdvanceRoundButton` |
| `/phases` | `GET /{id}/standings` | public | ✅ | — |
| `/teams` | `GET/POST /` | public / sk | ✅ | — |
| `/teams` | `GET/PUT/DELETE /{id}` | public / sk / admin | ✅ | — |
| `/teams` | `POST /{id}/logo` | sk | ✅ | storage bucket created (Phase A2); file picker shipped (Phase E4) |
| `/players` | `GET/POST /` | public / sk | ✅ | — |
| `/players` | `GET/PUT/DELETE /{id}` | public / sk / admin | ✅ | — |
| `/players` | `POST /{id}/photo` | sk | ✅ | storage bucket created (Phase A2); file picker shipped (Phase E4) |
| `/players` | `GET /{id}/stats` | public | ✅ | — |
| `/games` | `GET/POST /` | public / sk | ✅ | — |
| `/games` | `POST /batch` | sk | ✅ | — |
| `/games` | `GET/PUT/DELETE /{id}` | mixed | ✅ | — |
| `/games` | `POST /{id}/events` | sk | ✅ | — |
| `/games` | `GET /{id}/events` | public | ✅ | — |
| `/games` | `POST /{id}/timeout` | sk | ✅ | — |
| `/games` | `POST /{id}/end-timeout` | sk | ✅ | `TIMEOUT_END` added to live enum (Phase A1); route wired |
| `/games` | `POST /{id}/advance-half` | sk | ✅ | — |
| `/games` | `POST /{id}/end` | sk | ✅ | — |
| `/games` | `POST /{id}/events/undo` | sk | ✅ | FastAPI handler added (Phase B1); proxy + console button live |

---

## 2. Public pages

### P1. `/` — Home (`app/page.tsx`)
- **Intended:** hero CTA → browse tournaments / rankings / admin
- **Buttons:** Browse tournaments, View rankings, Enter as admin
- **Exists:** ✅ page renders, AppShell wraps, i18n keys present
- **Missing/broken:** none
- **Status:** ✅

### P2. `/rankings` — Cross-tournament rankings
- **Intended:** aggregations across all tournaments (wins, power score)
- **Buttons:** tournament filter dropdown, Teams/Players tab toggle, CSV export, year filter, sort toggle
- **Exists:** ✅ `RankingsClient` computes power on the client
- **Missing/broken:** none
- **Status:** ✅ — Spirit (SOTG) column shipped in Phase D7, sourced from `GET /tournaments/{id}/spirit-ranking`

### P3. `/tournaments` — Tournament browser (`app/tournaments/page.tsx`)
- **Intended:** searchable list with status tabs (All/Upcoming/Live/Completed)
- **Buttons:** search input, tab toggles, click row → `/tournaments/{id}`
- **Exists:** ✅
- **Missing/broken:** "Live" tab relies on `is_live` boolean; not visible until backend surfaces it in tournament list response (it currently doesn't)
- **Status:** ⚠️ minor (live tab is best-effort)

### P4. `/tournaments/[id]` — Tournament hub (`app/tournaments/[id]/page.tsx`)
- **Intended:** W-L standings, live game badges, format cards, links to phases / bracket / public
- **Buttons:** click phase standings, click bracket, click public stats
- **Exists:** ✅
- **Missing/broken:** no "Schedule" link (the dashboard tile for Schedules is also missing)
- **Status:** ⚠️ minor

### P5. `/tournaments/[id]/bracket` — Bracket visualization
- **Intended:** tree + consolation brackets (3rd/5th/7th/9th)
- **Buttons:** scorekeeper "Advance winner" button on each bracket game; click row → game detail
- **Exists:** ✅
- **Missing/broken:** none
- **Status:** ✅ — bracket advance wired via `AdvanceRoundButton` (Phase D4), posting to `/phases/{phaseId}/advance`

### P6. `/tournaments/[id]/phases/[phaseId]/standings` — Phase standings
- **Intended:** per-phase standings via `phasesApi.standings(phaseId)`
- **Buttons:** none (read-only); full table with Pos, Team, P, W, D, L, GF, GA, Diff, Pts, Spirit, tiebreakers
- **Exists:** ✅
- **Missing/broken:** none
- **Status:** ✅ — overview + tab pages added in Phase E2: `/tournaments/[id]/phases` (index) and `/tournaments/[id]/phases/[phaseId]` (Standings / Bracket / Groups)

### P7. `/tournaments/[id]/public` — Public leaderboard
- **Intended:** per-tournament player leaderboard + team ranking + MVP
- **Buttons:** search/filter
- **Exists:** ✅
- **Missing/broken:** none functional
- **Status:** ✅

### P8. `/teams` — Public teams list (`app/teams/page.tsx`)
- **Intended:** team cards grouped by tournament with W-L-Power columns
- **Buttons:** role-gated Edit / Delete — visible only when the viewer has the admin/scorekeeper role
- **Exists:** ✅
- **Missing/broken:** none
- **Status:** ✅ — admin actions now hidden from anonymous viewers (Phase E1); `canEdit` derived from `ALLOWED_ROLES` consistent with `/admin/players`

### P9. `/teams/[id]` — Team profile
- **Intended:** stat tiles, roster, match history, player stats table, MVP, admin actions
- **Buttons:** view player → `/players/[id}`, edit team, manage roster, upload logo
- **Exists:** ✅
- **Missing/broken:** none
- **Status:** ✅ — logo upload works: storage bucket created (Phase A2), file picker shipped on team forms (Phase E4)

### P10. `/games` — Public games list
- **Intended:** table with resolved team names, scores, status badges
- **Buttons:** click → `/games/[id}`
- **Exists:** ✅
- **Missing/broken:** none functional
- **Status:** ✅

### P11. `/games/[id]` — Game detail
- **Intended:** score header, Player of the Match (POM = goals + 0.7·assists + 0.5·defenses), top scorers, Match Evolution SVG, full event list
- **Buttons:** click player name → `/players/[id]`, click team → `/teams/[id]`
- **Exists:** ✅
- **Missing/broken:** POM computed client-side; **no server field**; works fine for live data but not future-proof
- **Status:** ✅

### P12. `/players/[id]` — Player profile
- **Intended:** player card, tournament history, per-tournament stats, SOTG rating
- **Buttons:** none
- **Exists:** ✅
- **Missing/broken:** none
- **Status:** ✅ — Spirit entry surfaces via Phase D5 `SpiritImportPanel`; per-player aggregations fall through to the spirit-ranking endpoint and surface on `/rankings` (Phase D7)

---

## 3. Auth pages

### P13. `/admin/login` — Login (`app/admin/login/page.tsx`)
- **Intended:** email/password → Supabase Auth
- **Buttons:** Sign in, link to forgot-password
- **Exists:** ✅
- **Missing/broken:** **no client-side exchange with FastAPI `/auth/login`** — admin dashboard re-checks Supabase auth but never calls FastAPI, so `/auth/me` is unused. Resulting in **two parallel auth surfaces**
- **Status:** ⚠️ contract drift

### P14. `/forgot-password` — Forgot password
- **Intended:** email input → Supabase recovery email
- **Buttons:** Send recovery link
- **Exists:** ✅
- **Missing/broken:** none
- **Status:** ✅

### P15. `/reset-password` — Reset password
- **Intended:** new password form
- **Buttons:** Update password
- **Exists:** ✅
- **Missing/broken:** none
- **Status:** ✅

---

## 4. Admin pages

> All admin pages are forced-dynamic and call `getAuthedUser()` from cookies. Middleware also blocks unauthenticated access to `/admin/*` (except `/admin/login`, `/forgot-password`, `/reset-password`).

### P16. `/admin` — Dashboard (`app/admin/page.tsx`)
- **Intended:** 6 navigation tiles (Tournaments, Teams, Players, Live Scoring, Schedules, Users) + Unscored games / Recently completed / Upcoming games widgets
- **Buttons:**
  - Tournaments → `/admin/tournaments`
  - Teams → `/admin/teams`
  - Players → `/admin/players`
  - Live Scoring → `/admin/games`
  - Schedules → `/admin/schedules` (Phase D2)
  - Users → `/admin/users` (Phase D1)
  - Sign out
- **Exists:** ✅
- **Missing/broken:** none functional — user/schedule tiles now resolve; widgets still best-effort for small DBs
- **Status:** ✅

### P17. `/admin/tournaments` — Tournament management (`app/admin/tournaments/page.tsx`)
- **Intended:** sortable table with multi-select + bulk actions, status badges, phase type labels
- **Buttons:** New tournament, Edit, Delete, View, View bracket, bulk actions (delete/status change)
- **Exists:** ✅
- **Missing/broken:** **bulk actions are described but not wired** — only single-row delete/edit work
- **Status:** ⚠️ partial

### P18. `/admin/tournaments/new` — Create tournament
- **Intended:** form with name, location, description, start/end dates
- **Buttons:** Create
- **Exists:** ✅
- **Missing/broken:** none
- **Status:** ✅

### P19. `/admin/tournaments/[id]/edit` — Edit + phases (`app/admin/tournaments/[id]/edit/page.tsx`)
- **Intended:** tournament metadata form + phases CRUD
- **Buttons:** Save tournament, Add phase, Generate fixtures (round-robin), Generate bracket, Split groups, Edit phase / Change status / Edit tiebreakers (per-row), Delete phase (confirm), Schedule suggestion
- **Exists:** ✅
- **Missing/broken:** bulk actions on the parent `/admin/tournaments` list (separate from per-tournament edit) remain unmapped
- **Status:** ✅ — Phase D3 wired phase edit/delete/status/tiebreakers + `phasesApi.update`/`remove`; raw `localhost:8000` fetch replaced with `phasesApi.listByTournament` (Phase C1)

### P20. `/admin/tournaments/[id]/games/new` — Schedule games
- **Intended:** single-game form + bulk CSV upload
- **Buttons:** Save single game, Upload CSV (paste + template download)
- **Exists:** ✅
- **Missing/broken:** none
- **Status:** ✅

### P21. `/admin/teams` — Team management
- **Intended:** cards grouped by tournament, edit links
- **Buttons:** Add team → `/admin/teams/new`, Edit → `/admin/teams/{id}/edit`, Delete
- **Exists:** ✅
- **Missing/broken:** **batch import UI not wired** despite `/admin/tournaments/{id}/roster/import` existing
- **Status:** ⚠️ partial

### P22. `/admin/teams/new` — Create team
- **Intended:** form (name, tournament select, logo file picker or URL)
- **Buttons:** Create
- **Exists:** ✅
- **Missing/broken:** none
- **Status:** ✅ — file picker shipped alongside URL field (Phase E4); mutual exclusion so setting file clears URL

### P23. `/admin/teams/[id]/edit` — Edit team
- **Intended:** form + Save + Delete
- **Buttons:** Save (PUT), Delete (admin only), logo file picker or URL
- **Exists:** ✅
- **Missing/broken:** none
- **Status:** ✅ — bucket created (Phase A2), file picker shipped (Phase E4b)

### P24. `/admin/players` — Player management
- **Intended:** searchable table + inline add form
- **Buttons:** Add player, Edit
- **Exists:** ✅
- **Missing/broken:** **no batch import UI**; CSV upload path is admin/tournament-scoped (`/admin/tournaments/{id}/roster/import`) — the page-level `AddPlayerForm` is single-row only
- **Status:** ⚠️ partial

### P25. `/admin/players/[id]/edit` — Edit player
- **Intended:** form (first/last/jersey/team/photo)
- **Buttons:** Save (PUT), Delete (admin only), photo file picker
- **Exists:** ✅
- **Missing/broken:** none
- **Status:** ✅ — bucket created (Phase A2), file picker shipped (Phase E4a)

### P26. `/admin/games` — Games management / scorekeeping
- **Intended:** table of all games with tournament filter, status badges, score links
- **Buttons:** Score → `/admin/games/{id}/score`, View → `/games/{id}`, New game (links to a global tournament chooser that exposes `+ Game` per tournament)
- **Exists:** ✅
- **Missing/broken:** none
- **Status:** ✅ — `New game` CTA always lands in a usable surface (Phase E3)

### P27. `/admin/games/[gameId]/score` — Live scoring console
- **Intended:** live score +1 buttons, player events, half advance, timeout/end-timeout, end game, live/chronometer toggle, undo last event
- **Buttons:** +1 home, +1 away, Record goal/assist/defense with player picker, Start timeout, End timeout, Advance half, End game, Start/stop clock, Undo last event, Record spirit score (Phase D6)
- **Exists:** ✅ UI
- **Missing/broken:** none
- **Status:** ✅ — undo wired (Phase B1 handler + proxy), end-timeout uses the live enum value (Phase A1), spirit side-sheet shipped (Phase D6); client-component i18n deferred (Phase F known debt)

---

## 5. Cross-page gaps (now resolved — kept for change log)

### 5.1 Auth model drift ✅ Resolved (A3, D1)
- `public.profiles` table created via `supabase/roles-and-rls.sql` apply (Phase A3).
- `/admin/users` page now lists users and lets admins change roles through `usersApi.updateRole` (Phase D1).
- **Note:** Supabase auth remains canonical; `/api/auth/login` proxy added (Phase C3) so FastAPI's `/auth/login` is reachable from a browser as a second option for future clients.

### 5.2 Storage (logos, photos) ✅ Resolved (A2, E4)
- `team-logos` and `player-photos` buckets created in `storage.buckets` (Phase A2).
- File pickers shipped on all three admin team/player forms (Phase E4); URL fields preserved alongside with mutual exclusion.

### 5.3 Token economy ✅ Removed (A4)
- Tables, views, and migration deleted in Phase A4. No orphan references in models, schemas, routers, or seed scripts (Phase H verified).

### 5.4 Spirit-of-the-game ✅ Resolved (D5, D6, D7)
- Bulk spirit import UI ships in `app/admin/tournaments/[id]/spirit/_components/SpiritImportPanel.tsx` (Phase D5).
- Per-game spirit score entry in `LiveScoringConsole.tsx` (Phase D6).
- SOTG column on `/rankings` (Phase D7) and overall spirit ranking through `/tournaments/{id}/spirit-ranking`.

### 5.5 Roster import ✅ Resolved (D5)
- `app/admin/tournaments/[id]/roster/_components/RosterImportPanel.tsx` ships paste-CSV / preview / submit; POSTs to `/admin/tournaments/{id}/roster/import`.

### 5.6 Bracket consolation advance ✅ Resolved (D4)
- `AdvanceRoundButton` posts to `/phases/{phaseId}/advance` and refreshes the bracket (Phase D4).

### 5.7 Public Teams page leaks admin actions ✅ Resolved (E1)
- Edit/Delete buttons are now role-gated on `app/teams/page.tsx` (Phase E1).

### 5.8 Phase index/overview pages ✅ Resolved (E2)
- `app/tournaments/[id]/phases/page.tsx` (list of phases) and `app/tournaments/[id]/phases/[phaseId]/page.tsx` (Standings / Bracket / Groups tabs) shipped (Phase E2).

### 5.9 Tournament edit form bypasses apiFetch ✅ Resolved (C1)
- `app/admin/tournaments/[id]/edit/page.tsx` now uses `phasesApi.listByTournament(id)`; the raw `localhost:8000` fetch was removed.

---

## 6. Remaining follow-up (after Phases A–H, ranked)

> Every gap listed in the previous revision of this section is now closed. This list documents what **still** deserves attention — known debt, polish, and items intentionally deferred.

### Medium (carry-over / known debt)
1. **Tournament list bulk actions** — the `/admin/tournaments` page describes multi-select bulk actions (delete / status change) but only single-row actions are wired. Surfaced as P17 ⚠️ partial. Not in any phase plan; deferred.
2. **Phase overview "Groups" tab is light** — the E2 overview page links to bracket/standings, but the Groups tab is a stub for phases that have `group_count > 1`. Fill in once a real consumer needs it.
3. **Pre-existing TypeScript debt** — `PhaseEditor.tsx`, `TournamentEditForm.tsx`, two `route.ts` (roster/import, spirit/import), and `AdvanceRoundButton.tsx` had tsc errors before Phase A started. They remain; they do not affect runtime but should be cleaned up in a separate drive-by PR.

### Low (polish / advisories)
4. **`LiveScoringConsole.tsx` i18n** — client component; strings inside ("Player", "Goals", "Assists", "Defense") are hard-coded. Threading the trans dict through props from the score page would close the gap.
5. **POM weighting is client-side only** — `app/games/[id]/page.tsx` computes Player of the Match inline; no `pom` column on games. Plan if/when scoring semantics change.
6. **`is_live` flag in tournament list response** — the `/tournaments` Live tab still relies on client heuristics. Adding `is_live` to the tournament serializer would clean this up.
7. **Stale `NewPages\` in `.gitignore`** — confirmed removed during Phase H cleanup.

---

## 7. What shipped (Phase A → H change log)

This section replaces the historical "recommended fix order" with what was actually delivered. Phase IDs map back to the plan at `eager-hatching-wand.md`.

| Phase | Highlights |
|---|---|
| **A — DB + infra hotfixes** | `ALTER TYPE gameeventtypeenum ADD VALUE 'TIMEOUT_END'`; created `team-logos` + `player-photos` buckets with public read; applied `supabase/roles-and-rls.sql` (creates `public.profiles`, `handle_new_user` trigger, RLS); dropped token tables/views + migration `20260806134551_*`; enabled HaveIBeenPwned leaked-password check. |
| **B — Backend small fixes** | New `POST /games/{game_id}/events/undo` handler in `routers/games.py` (delete latest event + decrement `player_tournament_stats` + recompute host/away score). Verified existing CRUD verbs on `/phases/{id}` (PUT, DELETE) — no change needed. |
| **C — Next.js API proxies + utils** | Replaced `http://localhost:8000` hard-code in `app/admin/tournaments/[id]/edit/page.tsx` with `phasesApi.listByTournament`; extended `utils/api.ts` with `phasesApi.{get,update,remove,advance}` and new `usersApi.{list,updateRole}`; added proxies `/api/auth/login`, `/api/auth/users`, `/api/auth/users/[userId]/role`, `/api/phases/[phaseId]`, `/api/phases/[phaseId]/advance`. |
| **D — Missing admin surfaces** | `/admin/users` (list + role change); `/admin/schedules` (global live + upcoming games); full phase CRUD via `TournamentEditForm` (edit/delete/status/tiebreakers/suggest schedule); bracket `AdvanceRoundButton`; bulk `RosterImportPanel` + `SpiritImportPanel`; `LiveScoringConsole` spirit side-sheet; SOTG column on `/rankings`. |
| **E — UX polish** | `/teams` admin actions role-gated; phase index pages (`/tournaments/[id]/phases` + `/[phaseId]` with Standings/Bracket/Groups tabs); `/admin/games` "New game" CTA always lands somewhere usable; logo + photo file pickers on every team/player form (with mutual exclusion against URL input). |
| **F — i18n completeness** | Admin dashboard nav links routed through `dict.navigation.*`; tournament edit/new fields routed through `at.*`; new `scoreConsole` namespace for the live scoring page; client-component `LiveScoringConsole.tsx` flagged as remaining i18n debt (Phase F skip, documented in §6). |
| **G — Docs sync** | Status flags flipped throughout this document; sections rewritten from "missing" to "shipped"; residual debt captured in §6. |
| **H — Cleanup** | Confirmed seed scripts and `requirements.txt` no longer reference dropped token tables; removed stale `NewPages\` from `.gitignore`. |

The original `PAGE_MAP.md` was never updated to reflect this work; `PAGE_MAP_FULL.md` is now the source of truth and `README.md` points here.

---

## 8. Files I read to produce this diagnostic

- `app/page.tsx`, `app/rankings/page.tsx`, `app/tournaments/page.tsx`, `app/tournaments/[id]/page.tsx`, `app/tournaments/[id]/bracket/page.tsx`, `app/tournaments/[id]/phases/[phaseId]/standings/page.tsx`, `app/tournaments/[id]/public/page.tsx`, `app/teams/page.tsx`, `app/teams/[id]/page.tsx`, `app/games/page.tsx`, `app/games/[id]/page.tsx`, `app/players/[id]/page.tsx`
- `app/admin/page.tsx`, `app/admin/login/page.tsx`, `app/admin/games/page.tsx`, `app/admin/games/[gameId]/score/page.tsx`, `app/admin/games/[gameId]/score/_components/LiveScoringConsole.tsx`, `app/admin/players/page.tsx`, `app/admin/teams/page.tsx`, `app/admin/tournaments/page.tsx`, `app/admin/tournaments/[id]/edit/page.tsx`, `app/admin/tournaments/[id]/edit/_components/TournamentEditForm.tsx`, `app/admin/tournaments/[id]/games/new/page.tsx`, `app/admin/tournaments/[id]/games/new/_components/GameNewForm.tsx`, `app/admin/teams/new/page.tsx`, `app/admin/teams/new/_components/NewTeamForm.tsx`, `app/admin/teams/[id]/edit/page.tsx`, `app/admin/teams/[id]/edit/_components/TeamEditForm.tsx`, `app/admin/players/[id]/edit/page.tsx`, `app/admin/players/[id]/edit/_components/PlayerEditForm.tsx`, `app/admin/tournaments/new/_components/NewTournamentForm.tsx`
- `app/api/admin/games/[gameId]/route.ts`, `app/api/admin/games/[gameId]/events/route.ts`, `app/api/admin/games/[gameId]/events/undo/route.ts`, `app/api/admin/games/[gameId]/timeout/route.ts`, `app/api/admin/games/[gameId]/end-timeout/route.ts`, `app/api/admin/games/[gameId]/advance-half/route.ts`, `app/api/admin/games/[gameId]/end/route.ts`, `app/api/games/route.ts`, `app/api/teams/route.ts`, `app/api/teams/[id]/route.ts`, `app/api/tournaments/route.ts`, `app/api/tournaments/[id]/route.ts`, `app/api/tournaments/[id]/phases/route.ts`, `app/api/phases/[phaseId]/round-robin/route.ts`, `app/api/phases/[phaseId]/bracket/route.ts`
- `middleware.ts`, `main.py`, `routers/auth.py`, `routers/admin.py`, `routers/games.py`, `routers/players.py`, `routers/teams.py`, `routers/tournaments.py`, `models.py`, `schemas.py`, `database.py`
- `.gitignore`, `SUPABASE_REBUILD_PROMPT.md`, `.claude/settings.local.json`, `PAGE_MAP.md`
- Live state via `mcp__supabase__list_tables (verbose=true)`, `list_migrations`, `list_storage_buckets`, `list_edge_functions`, `get_advisors`

End of diagnostic.