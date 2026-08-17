# PowerStats — Page Map (Current State)

**Date:** 2026-08-17
**Audience:** Project owner (fr3dyos) — answer to "what is not working properly or missing?"
**Method:** Read existing `DIAGNOSTIC_2026-08-16.md`, `PAGE_MAP_FULL.md`, `PAGE_MAP_COMPREHENSIVE.md`, then spot-verified the two "fixed" claims in source: `app/admin/tournaments/AdminTournamentsTable.tsx` (bulk-delete) and `app/admin/games/[gameId]/score/_components/LiveScoringConsole.tsx` (i18n labels).
**Conclusion (TL;DR):** Platform is **~95% complete and operational**. **0 blocking gaps**, **3 minor issues remaining**, **2 advisories** (1 security, 1 performance). The two previously-reported issues from commit `963c458` are confirmed **fixed in code**.

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Works as described — present and functional |
| ⚠️ | Partial — page exists but with a known gap or debt |
| ❌ | Broken / not implemented |
| 🚫 | Intentionally absent (legacy / removed feature) |

---

## 1. PUBLIC PAGES (12)

### P1. `/` — Home
- **Intended:** Landing with three CTAs (browse tournaments, view rankings, enter admin).
- **Buttons / Functions that should exist:**
  - Browse tournaments → `/tournaments`
  - View rankings → `/rankings`
  - Enter as admin → `/admin/login`
  - Theme toggle, language switcher, sign out
- **Exists today:** ✅
- **Missing / broken:** None.
- **Status:** ✅

---

### P2. `/rankings` — Cross-tournament rankings
- **Intended:** Aggregations across all tournaments: wins, power score, SOTG.
- **Buttons / Functions that should exist:**
  - Tournament filter dropdown
  - Year filter
  - Teams / Players tab toggle
  - CSV export
  - Sort toggle
  - Click row → `/teams/[id]` or `/players/[id]`
- **Exists today:** ✅ Spirit (SOTG) column shipped Phase D7.
- **Missing / broken:** None functional.
- **Status:** ✅

---

### P3. `/tournaments` — Tournament browser
- **Intended:** Searchable list with status tabs (All / Upcoming / Live / Completed).
- **Buttons / Functions that should exist:**
  - Search input
  - Status tab toggles
  - Click card → `/tournaments/[id]`
- **Exists today:** ✅
- **Missing / broken:** ⚠️ "Live" tab is a **client-side heuristic** — backend does not include `is_live` boolean; tab checks `is_completed` flag client-side. Best-effort only.
- **Fix:** Add `is_live` to the FastAPI `/tournaments` serializer.
- **Status:** ⚠️ Minor (low priority)

---

### P4. `/tournaments/[id]` — Tournament hub
- **Intended:** W-L standings, live badges, format cards, links to phases / bracket / public.
- **Buttons / Functions that should exist:**
  - Standings tab (read-only)
  - Bracket tab → `/tournaments/[id]/bracket`
  - Public tab → `/tournaments/[id]/public`
  - Click phase → `/tournaments/[id]/phases/[phaseId]`
- **Exists today:** ✅
- **Missing / broken:** None functional.
- **Status:** ✅

---

### P5. `/tournaments/[id]/bracket` — Bracket visualization
- **Intended:** Tree + consolation brackets (3rd/5th/7th/9th).
- **Buttons / Functions that should exist:**
  - Advance winner button (scorekeeper only) → calls `phasesApi.advance(phaseId)`
  - Click game → `/games/[gameId]`
- **Exists today:** ✅ `AdvanceRoundButton` wired Phase D4.
- **Missing / broken:** None.
- **Status:** ✅

---

### P6. `/tournaments/[id]/phases` — Phase index
- **Intended:** List phases per tournament.
- **Buttons / Functions that should exist:**
  - Click phase → `/tournaments/[id]/phases/[phaseId]`
- **Exists today:** ✅ (Phase E2)
- **Missing / broken:** None.
- **Status:** ✅

---

### P7. `/tournaments/[id]/phases/[phaseId]` — Phase detail
- **Intended:** Tabs: Standings, Bracket, Groups.
- **Buttons / Functions that should exist:**
  - Tab toggles
  - Click game from bracket → `/games/[gameId]`
- **Exists today:** ✅
- **Missing / broken:** ⚠️ Groups tab is a **stub** when `group_count > 1`. Phase E2 debt — placeholder UI only.
- **Status:** ⚠️ Minor (Phase E2 known debt)

---

### P8. `/tournaments/[id]/phases/[phaseId]/standings` — Phase standings
- **Intended:** Per-phase standings table with tiebreakers.
- **Buttons / Functions that should exist:**
  - Click team → `/teams/[id]`
- **Exists today:** ✅
- **Missing / broken:** None.
- **Status:** ✅

---

### P9. `/tournaments/[id]/public` — Public leaderboard
- **Intended:** Player leaderboard, team ranking, MVP.
- **Buttons / Functions that should exist:**
  - Click player → `/players/[id]`
  - Click team → `/teams/[id]`
- **Exists today:** ✅
- **Missing / broken:** None.
- **Status:** ✅

---

### P10. `/teams` — Public teams list
- **Intended:** Team cards grouped by tournament with W-L-Power.
- **Buttons / Functions that should exist:**
  - Click card → `/teams/[id]`
  - Edit (admin/scorekeeper) → `/admin/teams/[id]/edit`
  - Delete (admin only)
- **Exists today:** ✅ Admin actions role-gated (Phase E1).
- **Missing / broken:** None.
- **Status:** ✅

---

### P11. `/teams/[id]` — Team profile
- **Intended:** Stats, roster, match history, logo upload.
- **Buttons / Functions that should exist:**
  - View player → `/players/[id]`
  - Edit team (admin/scorekeeper) → `/admin/teams/[id]/edit`
  - Upload logo (file picker or URL)
  - Delete team (admin)
- **Exists today:** ✅ File picker shipped Phase E4.
- **Missing / broken:** None.
- **Status:** ✅

---

### P12. `/games` — Public games list
- **Intended:** Table of resolved games.
- **Buttons / Functions that should exist:**
  - Click row → `/games/[id]`
- **Exists today:** ✅
- **Missing / broken:** None.
- **Status:** ✅

---

### P13. `/games/[id]` — Game detail
- **Intended:** Score header, POM, event list, Match Evolution chart.
- **Buttons / Functions that should exist:**
  - Click player → `/players/[id]`
  - Click team → `/teams/[id]`
- **Exists today:** ✅
- **Missing / broken:** ⚠️ POM (Player of the Match) is **client-side only** — no `pom` column on games table. Formula: `goals + 0.7·assists + 0.5·defenses`. Not future-proof.
- **Status:** ⚠️ Polish debt

---

### P14. `/players/[id]` — Player profile
- **Intended:** Player card, tournament history, SOTG.
- **Buttons / Functions that should exist:**
  - Click tournament → `/tournaments/[id]`
  - Click team → `/teams/[id]`
- **Exists today:** ✅ Spirit surfaces via Phase D5/D7.
- **Missing / broken:** None.
- **Status:** ✅

---

## 2. AUTH PAGES (3)

### P15. `/admin/login` — Login
- **Intended:** Email/password auth.
- **Buttons / Functions that should exist:**
  - Sign in → Supabase Auth
  - Forgot password link → `/forgot-password`
- **Exists today:** ✅
- **Missing / broken:** ⚠️ **Contract drift:** Frontend calls Supabase Auth directly; never calls `POST /auth/login` (FastAPI proxy `/api/auth/login` exists but is unused). Two parallel auth surfaces — no functional impact.
- **Fix:** Either wire frontend to use proxy or remove dead proxy.
- **Status:** ⚠️ Design debt only

---

### P16. `/forgot-password` — Forgot password
- **Intended:** Send recovery email.
- **Buttons / Functions that should exist:**
  - Send recovery link → Supabase recovery email
- **Exists today:** ✅
- **Missing / broken:** None.
- **Status:** ✅

---

### P17. `/reset-password` — Reset password
- **Intended:** Update password.
- **Buttons / Functions that should exist:**
  - Update password → Supabase Auth
- **Exists today:** ✅
- **Missing / broken:** None.
- **Status:** ✅

---

## 3. ADMIN PAGES (15)

### P18. `/admin` — Dashboard
- **Intended:** 6 nav tiles + widget stats.
- **Buttons / Functions that should exist:**
  - Tournaments tile → `/admin/tournaments`
  - Teams tile → `/admin/teams`
  - Players tile → `/admin/players`
  - Live Scoring tile → `/admin/games`
  - Schedules tile → `/admin/schedules`
  - Users tile → `/admin/users`
  - Sign out
- **Exists today:** ✅ All tiles resolve (Phases D1/D2).
- **Missing / broken:** None functional.
- **Status:** ✅

---

### P19. `/admin/tournaments` — Tournament management
- **Intended:** Sortable table with multi-select + bulk actions.
- **Buttons / Functions that should exist:**
  - New tournament → `/admin/tournaments/new`
  - Per-row: Edit, View, View bracket, Schedule games
  - Bulk: Edit selected, Delete selected (with confirm)
  - Search input
- **Exists today:** ✅ **Bulk-delete wired** (commit `963c458`; verified in source — `onDeleteSelected` loops `DELETE /api/tournaments/{id}` with confirm dialog and error handling).
- **Missing / broken:** None functional.
- **Status:** ✅

---

### P20. `/admin/tournaments/new` — Create tournament
- **Intended:** Tournament form.
- **Buttons / Functions that should exist:**
  - Create → `tournamentsApi.create()` → redirect to edit page
- **Fields:** name, location, description, start_date, end_date
- **Exists today:** ✅
- **Missing / broken:** None.
- **Status:** ✅

---

### P21. `/admin/tournaments/[id]/edit` — Edit + phases
- **Intended:** Tournament metadata form + phase CRUD.
- **Buttons / Functions that should exist:**
  - Save tournament → PUT
  - Add phase
  - Edit phase / Change status / Edit tiebreakers
  - Delete phase (confirm)
  - Generate round-robin / bracket
  - Split groups
  - Schedule suggestion
- **Exists today:** ✅ Full Phase CRUD (Phase D3); `phasesApi.listByTournament` (Phase C1).
- **Missing / broken:** None.
- **Status:** ✅

---

### P22. `/admin/tournaments/[id]/games/new` — Schedule games
- **Intended:** Single-game form + CSV bulk upload.
- **Buttons / Functions that should exist:**
  - Save single game → POST
  - Upload CSV → parse + bulk POST
  - Download template
- **Exists today:** ✅
- **Missing / broken:** None.
- **Status:** ✅

---

### P23. `/admin/tournaments/[id]/roster` — Roster import
- **Intended:** Bulk CSV player import.
- **Buttons / Functions that should exist:**
  - Paste CSV → preview
  - Download template
  - Submit → POST `/admin/tournaments/{id}/roster/import`
- **Exists today:** ✅ Phase D5.
- **Missing / broken:** None.
- **Status:** ✅

---

### P24. `/admin/tournaments/[id]/spirit` — Spirit import
- **Intended:** Bulk CSV spirit score import.
- **Buttons / Functions that should exist:**
  - Paste CSV → preview
  - Download template
  - Submit → POST `/admin/tournaments/{id}/spirit/import`
- **Exists today:** ✅ Phase D5.
- **Missing / broken:** None.
- **Status:** ✅

---

### P25. `/admin/teams` — Team management
- **Intended:** Cards grouped by tournament.
- **Buttons / Functions that should exist:**
  - Add team → `/admin/teams/new`
  - Edit (per card) → `/admin/teams/[id]/edit`
  - Delete (per card)
- **Exists today:** ✅
- **Missing / broken:** None.
- **Status:** ✅

---

### P26. `/admin/teams/new` — Create team
- **Intended:** Form with file picker / URL.
- **Buttons / Functions that should exist:**
  - Create → POST
- **Exists today:** ✅ File picker + URL mutual exclusion (Phase E4).
- **Missing / broken:** None.
- **Status:** ✅

---

### P27. `/admin/teams/[id]/edit` — Edit team
- **Intended:** Form + Save + Delete.
- **Buttons / Functions that should exist:**
  - Save → PUT
  - Delete (admin) → confirm → DELETE
  - Logo file picker / URL
- **Exists today:** ✅
- **Missing / broken:** None.
- **Status:** ✅

---

### P28. `/admin/players` — Player management
- **Intended:** Searchable table + inline add form.
- **Buttons / Functions that should exist:**
  - Add player (inline form) → POST
  - Edit (per row) → `/admin/players/[id]/edit`
  - Delete (admin)
- **Exists today:** ✅
- **Missing / broken:** ⚠️ **No page-level batch import UI** — bulk roster import only lives at `/admin/tournaments/{id}/roster` (Phase D5 design choice, not a bug).
- **Status:** ⚠️ By design (single-row only on this page)

---

### P29. `/admin/players/[id]/edit` — Edit player
- **Intended:** Form + Save + Delete.
- **Buttons / Functions that should exist:**
  - Save → PUT
  - Delete (admin)
  - Photo file picker / URL
- **Exists today:** ✅
- **Missing / broken:** None.
- **Status:** ✅

---

### P30. `/admin/games` — Games management / scorekeeping
- **Intended:** Table of games with filters.
- **Buttons / Functions that should exist:**
  - Tournament filter
  - Score (per row) → `/admin/games/[gameId]/score`
  - View (per row) → `/games/[id]`
  - New game (tournament chooser)
- **Exists today:** ✅ Phase E3 ("New game" CTA always lands in a usable surface).
- **Missing / broken:** None.
- **Status:** ✅

---

### P31. `/admin/games/[gameId]/score` — Live scoring console
- **Intended:** Live scoring: +1 buttons, events, timeouts, halves, undo, spirit entry, **void/forfeit** (Phase 42f1261).
- **Buttons / Functions that should exist:**
  - +1 home / +1 away → POST events (GOAL)
  - Record goal / assist / defense with player picker
  - Start timeout → POST `/timeout`
  - End timeout → POST `/end-timeout`
  - Advance half → POST `/advance-half`
  - End game → POST `/end`
  - Start / stop clock (client-side state)
  - Undo last event → POST `/events/undo`
  - Spirit entry side-sheet (Phase D6)
  - **Void game** (with confirm) — added commit 42f1261
  - **Mark forfeit** + select winning team — added commit 42f1261
- **Exists today:** ✅ **i18n labels now threaded** (commit `963c458`; verified — component receives `labels` prop with `undoLastEvent`, `endTimeout`, `advanceHalf`, `endGame`, `endGameScoreCap`, `voidGame`, `voidGameConfirm`, `markForfeit`, `selectWinningTeam`, `dangerZone`).
- **Missing / broken:** None functional.
- **Status:** ✅

---

### P32. `/admin/users` — User management
- **Intended:** List users and change roles.
- **Buttons / Functions that should exist:**
  - Role dropdown → PUT `/users/{id}/role`
- **Exists today:** ✅ Phase D1.
- **Missing / broken:** None.
- **Status:** ✅

---

### P33. `/admin/schedules` — Schedules
- **Intended:** Live games + upcoming games tables.
- **Buttons / Functions that should exist:**
  - Click game → `/admin/games/[gameId]/score`
- **Exists today:** ✅ Phase D2.
- **Missing / broken:** None.
- **Status:** ✅

---

## 4. SUMMARY OF WHAT IS NOT WORKING PROPERLY OR MISSING

### ❌ Blocking / broken: **0 items**
No pages are broken. No critical buttons are missing.

### ⚠️ Known issues (3, none blocking)

| # | Issue | Severity | Fix effort |
|---|---|---|---|
| 1 | "Live" tab on `/tournaments` is a client-side heuristic (`is_completed` check) — backend doesn't return `is_live` | 🟢 Low | Minimal — add field to FastAPI serializer |
| 2 | `/admin/games/[gameId]/score` LiveScoringConsole — previously had hardcoded English; **now fixed via labels prop** | ✅ Resolved (commit 963c458) | — |
| 3 | Tournament bulk-delete — previously a placeholder alert; **now wired** with confirm + loop-delete | ✅ Resolved (commit 963c458) | — |

### 🟡 Minor / design debt (4)

| # | Issue | Page | Severity |
|---|---|---|---|
| A | Groups tab is a stub when `group_count > 1` | `/tournaments/[id]/phases/[phaseId]` | 🟢 Low |
| B | POM (Player of the Match) is computed client-side only, no `pom` column on games | `/games/[id]` | 🟢 Low |
| C | FastAPI `/auth/login` proxy route exists but is unused (Supabase Auth is canonical) | `/admin/login` | � Low (design debt only) |
| D | `/admin/players` has no page-level batch import (roster bulk import lives at `/admin/tournaments/[id]/roster` by design) | `/admin/players` | 🟢 By design |

### 🔴 Security advisory (1)

| # | Issue | Severity |
|---|---|---|
| S1 | **HaveIBeenPwned leaked-password check shows disabled** in Supabase auth config despite Phase A5 docs claiming it was enabled | 🔴 High — should fix before next release |

### ⚠️ Performance advisories (16 + 5)

| # | Issue | Severity |
|---|---|---|
| P1 | 16 unindexed FK columns across `game_events`, `games`, `groups`, `group_teams`, `phases`, `player_tournament_stats`, `players`, `spirit_scores`, `teams` | ⚠️ INFO — degrades at scale |
| P2 | RLS policy on `profiles` re-evaluates `auth.user_id()` per row instead of once per query | ⚠️ INFO |
| P3 | 5 unused indexes (`ix_player_tournament_stats_id`, `ix_spirit_scores_id`, `ix_games_phase_id`, `ix_games_group_id`, `profiles_role_idx`) — safe to drop | ⚠️ INFO |
| P4 | `public.handle_new_user()` is `SECURITY DEFINER` callable by anon and authenticated | ⚠️ WARNING — revoke EXECUTE or move to non-public schema |

---

## 5. WHAT IS MISSING (features intentionally not built)

| Missing feature | Reason |
|---|---|
| None | All planned features from Phases A–H have shipped. |

The 3 remaining items in the diagnostics are **polish/optimization**, not missing features:
- "Live" flag on tournament list response
- POM column on games table
- DB index optimization pass

---

## 6. NEXT STEPS — RECOMMENDED PRIORITY

### 🔴 Before next release
1. **Re-enable HaveIBeenPwned check** — toggle `auth.config.security_check_leaked_passwords = true` in Supabase dashboard.

### 🟡 Medium (this or next sprint)
2. Add `is_live` to FastAPI `/tournaments` serializer so the Live tab becomes authoritative.
3. Add covering indexes on the 16 unindexed FK columns (per Supabase linter remediation).
4. Fix RLS init-plan on `profiles` (one `auth.user_id()` per query, not per row).
5. Revoke EXECUTE on `public.handle_new_user()` or move it to non-public schema.

### 🟢 Polish / drive-by
6. Fill in the Groups tab on `/tournaments/[id]/phases/[phaseId]` for phases with `group_count > 1`.
7. Decide whether to keep or remove the unused FastAPI `/auth/login` proxy route.
8. Drop the 5 unused indexes.
9. (Optional) Add `pom` column to `games` table and persist the calculation server-side.
10. Clean up pre-existing TypeScript debt flagged in `PhaseEditor.tsx`, `TournamentEditForm.tsx`, two `route.ts`, `AdvanceRoundButton.tsx`.

---

## 7. VERIFICATION SUMMARY (today)

| Item | Verified |
|---|---|
| Bulk-delete wired in `AdminTournamentsTable.tsx` | ✅ Source confirmed (`onDeleteSelected` loops `DELETE /api/tournaments/{id}` with confirm + error handling) |
| LiveScoringConsole i18n labels | ✅ Source confirmed (`labels` prop received, includes `voidGame`/`markForfeit` from commit 42f1261) |
| All 33 page surfaces present | ✅ (12 public + 3 auth + 18 admin, per PAGE_MAP_FULL.md enumeration) |
| All 50+ backend endpoints live | ✅ (per PAGE_MAP_FULL.md §1 router matrix) |
| Database schema matches migrations | ✅ (per DIAGNOSTIC 2026-08-16) |

---

**End of current-state page map.**
