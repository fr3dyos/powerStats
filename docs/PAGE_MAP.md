# powerStats — Page Map & Gap Audit

**Generated:** 2026-08-16
**Audit scope:** Every route under `app/`. Each entry lists the buttons and functions the page SHOULD expose, what is implemented TODAY, and what is MISSING.

Legend: ✅ implemented · 🟡 partial · ❌ missing

---

## 1. Public / Unauthenticated routes

### 1.1 `/` — Home / landing (`app/page.tsx`)
- **Should exist:**
  - Hero with brand and tagline
  - Featured tournaments / live now
  - CTA buttons: "Browse tournaments", "Rankings", "Sign in"
  - Public stats snapshot
- **Today:** ✅ Brand + tagline hero, CTA cards, navigation, public footer.
- **Missing:** ❌ "Live now" feed (no link to currently running games from landing), ❌ featured tournament carousel, ❌ recent results ticker.

### 1.2 `/tournaments` — Tournament list (`app/tournaments/page.tsx`)
- **Should exist:**
  - Search / filter (by status, date, location)
  - Sort (date asc/desc, name)
  - List/grid toggle
  - "Create tournament" CTA (admin) / "Sign in to organize" (anon)
- **Today:** ✅ List cards with status pill, location, date range, link to detail.
- **Missing:** 🟡 Filter & search input not visible (cards only); ❌ sort controls; ❌ grid/list toggle.

### 1.3 `/tournaments/[id]` — Tournament detail (`app/tournaments/[id]/page.tsx`)
- **Should exist:**
  - Header (name, dates, location, status badges)
  - Standings table (overall classification)
  - Live games list
  - Completed games list
  - Phase navigation cards / tabs
  - Links: Standings, Bracket, Leaderboards, Schedule, Public view
- **Today:** ✅ Header, overall standings, live games, completed games, links to "Standings / Phases / Bracket" and "Public" stats. Cards for Round-robin / Playoffs / Leaderboards.
- **Missing:** ❌ Phase chips/timeline at top of page (only accessed via "Phases" link); ❌ schedule/calendar view; ❌ share-to-clipboard public link button; 🟡 standings table lacks Draws / Spirit / Points columns (only W/L/Diff/GF/GA).

### 1.4 `/tournaments/[id]/public` — Public stats / share view (`app/tournaments/[id]/public/page.tsx`)
- **Should exist:**
  - Standings, scoring leaders, spirit leaders, schedule
  - QR code / shareable link
  - "no-auth required" guarantee
- **Today:** ✅ Full public leaderboards and standings with top scorers / spirit.
- **Missing:** ❌ QR code generator; ❌ explicit share-button copying URL; ❌ no "Embed" widget.

### 1.5 `/tournaments/[id]/phases` — Phase list (`app/tournaments/[id]/phases/page.tsx`)
- **Should exist:**
  - List of all phases (round-robin / bracket) in order
  - Phase status pill, link to phase detail
  - Per-phase "Generate fixtures" / "Generate bracket" / "Suggest schedule" buttons (admin)
- **Today:** ✅ Cards per phase with order, type, status, link to detail.
- **Missing:** ❌ Generate / suggest schedule actions here (currently only on the admin edit page); ❌ drag-to-reorder phases; ❌ inline status toggle.

### 1.6 `/tournaments/[id]/phases/[phaseId]` — Phase detail (`app/tournaments/[id]/phases/[phaseId]/page.tsx`)
- **Should exist:**
  - Tab strip: Standings / Bracket (or Groups)
  - Group/division breakdown for round-robin
  - Phase configuration summary
  - Generate / advance controls (admin)
- **Today:** 🟡 Renders tab strip but **only shows placeholder copy** under tabs (`st.subtitle` + generic text). NO actual standings/bracket/groups render here.
- **Missing:** ❌ Phase content is **a stub** — users see "—" copy only; the real content lives at `/phases/[phaseId]/standings` and `/bracket`. Tab "Groups" links to standings page (no separate groups view exists).

### 1.7 `/tournaments/[id]/phases/[phaseId]/standings` — Phase standings (`app/tournaments/[id]/phases/[phaseId]/standings/page.tsx`)
- **Should exist:**
  - Tab strip (Standings / Bracket / Groups)
  - Group-filter tabs (if multi-group)
  - Full standings table: Pos, Team, Played, Wins, Draws, Losses, PF, PA, Diff, Points, Spirit
  - Tiebreaker hierarchy display
- **Today:** ✅ Full table with all requested columns, tiebreaker summary, team logos.
- **Missing:** 🟡 No tab strip rendered (the page is standalone — users must click the tab in the parent phase page to navigate); ❌ group filter when phase has `group_count > 1`; ❌ "Export CSV" button; ❌ inline spirit score entry.

### 1.8 `/tournaments/[id]/bracket` — Bracket view (`app/tournaments/[id]/bracket/page.tsx`)
- **Should exist:**
  - Main + consolation bracket trees
  - Live game pills at top
  - "Advance winners" control (admin)
  - Round labels (QF / SF / Finals / Placement)
  - Per-match score links (admin)
- **Today:** ✅ All implemented — live pills, advance button (per bracket phase), main + consolation trees, per-match score link (admin/scorekeeper).
- **Missing:** 🟡 "Advance" button only shows for `role in {admin, scorekeeper}` — verify no `director` role exists; ❌ "Print bracket" view.

### 1.9 `/games` — All games feed (`app/games/page.tsx`)
- **Should exist:**
  - Filter by tournament / status / date
  - Live-now indicator
  - Per-game score pill / link to detail
- **Today:** ✅ List of games with live badges.
- **Missing:** ❌ Filter controls (search box / dropdowns); ❌ pagination for large tournaments.

### 1.10 `/games/[gameId]` — Game detail (`app/games/[gameId]/page.tsx`)
- **Should exist:**
  - Teams, score, field, time, status
  - Spirit scores per team
  - Timeline / events
  - Link to score entry (admin)
- **Today:** ✅ Score display, spirit scores, link to admin scoring.
- **Missing:** ❌ Per-event timeline (goals / turnovers not tracked); ❌ "Score this game" CTA not visible to scorekeepers unless admin route is followed.

### 1.11 `/teams` — Teams index (`app/teams/page.tsx`)
- **Should exist:** Team grid, search, link to detail.
- **Today:** ✅ Cards per team.
- **Missing:** ❌ Search / filter.

### 1.12 `/teams/[teamId]` — Team detail (`app/teams/[teamId]/page.tsx`)
- **Should exist:** Roster, games, win/loss, spirit, link to edit (admin).
- **Today:** ✅ Roster + recent games.
- **Missing:** ❌ Aggregate stats (total W/L, point differential all-time); ❌ spirit average.

### 1.13 `/players` (list) and `/players/[playerId]` (detail) (`app/players/...`)
- **Should exist:** Player search, profile, career stats.
- **Today:** ✅ `/players/[playerId]` shows profile.
- **Missing:** ❌ `/players` index page not implemented (no app/players/page.tsx); ❌ career stats (goals scored, assists, spirit received) not displayed.

### 1.14 `/rankings` — Global rankings (`app/rankings/page.tsx`)
- **Should exist:** Team & player rankings, season selectors.
- **Today:** ✅ Renders rankings.
- **Missing:** ❌ Season filter; ❌ scope filter (region / country); 🟡 unclear whether player rankings are included.

### 1.15 `/forgot-password` & `/reset-password` (`app/forgot-password/page.tsx`, `app/reset-password/page.tsx`)
- **Should exist:** Email form, reset link landing with new-password form.
- **Today:** ✅ Both implemented.
- **Missing:** ❌ Rate-limit / reCAPTCHA on forgot form; ❌ token-expiry messaging.

---

## 2. Admin / authenticated routes

### 2.1 `/admin/login` (`app/admin/login/page.tsx`)
- **Should exist:** Email + password login, "forgot password" link.
- **Today:** ✅ Form.
- **Missing:** ❌ "Magic link" / SSO option; ❌ last-login / device info.

### 2.2 `/admin` — Admin dashboard (`app/admin/page.tsx`)
- **Should exist:** Cards/links to Tournaments, Teams, Players, Games, Schedules, Spirit, Users.
- **Today:** ✅ Cards for each admin section.
- **Missing:** 🟡 Dashboard summary (active tournaments count, live games count, pending score confirmations); ❌ quick-actions ("New tournament" button on dashboard).

### 2.3 `/admin/tournaments` (`app/admin/tournaments/page.tsx`)
- **Should exist:** List, search, "New tournament" CTA.
- **Today:** ✅ List.
- **Missing:** ❌ "New tournament" button on this page (lives at `/admin/tournaments/new`); ❌ search.

### 2.4 `/admin/tournaments/new` (`app/admin/tournaments/new/page.tsx`)
- **Should exist:** Create form (name, dates, location, description).
- **Today:** ✅ Form.
- **Missing:** 🟡 Confirmation dialog before submit; ❌ duplicate-detection warning.

### 2.5 `/admin/tournaments/[id]/edit` (`app/admin/tournaments/[id]/edit/page.tsx`)
- **Should exist:**
  - Edit metadata
  - Add/remove/edit phases (with type selector round-robin/bracket)
  - Tiebreaker hierarchy per phase (reorderable)
  - Suggest schedule (prompts for field count)
  - Generate round-robin / Generate bracket
  - Bulk import teams + players
- **Today:** ✅ All of the above (added in this session).
- **Missing:** ❌ Bulk delete of phases; ❌ "reset all games" action; ❌ "duplicate phase" action.

### 2.6 `/admin/tournaments/[id]/games/new` (`app/admin/tournaments/[id]/games/new/page.tsx`)
- **Should exist:** Create game form (home/away, time, field, phase).
- **Today:** ✅ Form.
- **Missing:** ❌ Conflict check (overlapping field/time); ❌ bulk-create from round-robin results; ❌ CSV import.

### 2.7 `/admin/tournaments/[id]/roster` (`app/admin/tournaments/[id]/roster/page.tsx`)
- **Should exist:** Add/remove players to teams, jersey numbers, captain flag.
- **Today:** ✅ Roster management.
- **Missing:** ❌ Bulk CSV import (separate from the edit-dashboard import?); ❌ jersey-number conflict warning.

### 2.8 `/admin/tournaments/[id]/spirit` (`app/admin/tournaments/[id]/spirit/page.tsx`)
- **Should exist:** Spirit score entry per game (5 categories: rules, fouls, fair, positive, communication).
- **Today:** ✅ Spirit entry UI.
- **Missing:** ❌ Aggregate leaderboard per tournament on this page; ❌ "lock spirit" / deadline control.

### 2.9 `/admin/teams` (`app/admin/teams/page.tsx`) & `/admin/teams/new`, `/admin/teams/[id]/edit`
- **Should exist:** List, search, create form, edit form, delete.
- **Today:** ✅ Implemented.
- **Missing:** ❌ Filter by tournament; ❌ bulk create.

### 2.10 `/admin/players` & `/admin/players/[id]/edit`
- **Should exist:** List, search, edit, bulk import.
- **Today:** ✅ Implemented.
- **Missing:** ❌ Player-creation form (only edit exists); ❌ merge-duplicates tool.

### 2.11 `/admin/games` & `/admin/games/[gameId]/score`
- **Should exist:** Game list, score entry with spirit.
- **Today:** ✅ Implemented.
- **Missing:** ❌ "Mark forfeit" / "Void game" action; ❌ score-correction audit log.

### 2.12 `/admin/schedules` (`app/admin/schedules/page.tsx`)
- **Should exist:** Global schedule of all upcoming games across tournaments, filter by tournament.
- **Today:** ✅ Renders schedule.
- **Missing:** ❌ Calendar view; ❌ "export ICS" button.

### 2.13 `/admin/users` (`app/admin/users/page.tsx`)
- **Should exist:** List of users, role assignment (admin/scorekeeper/director), invite form.
- **Today:** ✅ Implemented.
- **Missing:** ❌ "invite by email" form (in-memory only?); ❌ audit log of role changes; ❌ deactivate vs hard-delete.

---

## 3. Cross-cutting gaps

| Area | Status | Notes |
| --- | --- | --- |
| Auth / RLS enforcement | ✅ | Middleware + Supabase session |
| i18n (en / es / pt-BR) | ✅ | All three present in `messages/` |
| Schedule suggestion | ✅ | Fixed this session (`/api/tournaments/[id]/schedule-suggestion` route created) |
| Generate round-robin / bracket | ✅ | Fixed this session (persist query-param forwarding) |
| Tiebreaker reorderable | ✅ | Fixed this session (arrow up/down buttons + help text) |
| Phase type selector | ✅ | Already in `PhaseEditor` |
| Bulk team + player import | ✅ | Added in `bf87ffd` |
| Phase content rendering | ❌ | `/tournaments/[id]/phases/[phaseId]/page.tsx` is a placeholder — no actual bracket / standings / groups render here |
| Multi-group filter | ❌ | `group_count > 1` phases show all teams together; no per-group standings |
| Event-level game timeline | ❌ | Goals / turnovers / subs not tracked |
| Calendar / ICS export | ❌ | No export anywhere |
| CSV export | ❌ | Standings, schedule, roster — none exportable |
| QR code / share widget | ❌ | No public-share generator |
| Notifications | ❌ | No email or push notifications for game time, score confirmations, spirit deadlines |
| Audit log | ❌ | No history of score edits, role changes |
| Player index | ❌ | No `/players` listing page |
| Search globally | 🟡 | Search is missing on most list pages |
| Pagination | 🟡 | Most lists rely on scroll; no pagination controls |
| Performance / caching | ✅ | `revalidate = 60` on tournament detail |
| Accessibility | 🟡 | Forms have labels, but keyboard skip-links / ARIA live regions not visible |
| Mobile responsive | 🟡 | Bracket view is horizontal-scroll only; some admin tables overflow |
| Tests | 🟡 | No end-to-end or unit tests visible at repo root |

---

## 4. Most impactful next steps

1. **Replace the phase-detail placeholder** with real content (or remove it and link straight to standings / bracket).
2. **Add per-group filtering** when `phase.config.group_count > 1`.
3. **Add CSV export** for standings, schedule, roster.
4. **Add a `/players` index** and per-player career stats.
5. **Add calendar / ICS export** for tournament schedules.
6. **Add event-level timeline** to game detail (points scored, turnovers, timeouts).
7. **Add audit log** for score corrections and role changes.
8. **Add QR / share-link generator** on the public view.
9. **Add "void game" and "mark forfeit"** actions on admin score page.
10. **Add search & filter** on list pages (`/games`, `/teams`, `/tournaments`, `/admin/...`).

---

## 5. What is working well

- Authentication, authorization, role checks (`admin`, `scorekeeper`).
- Public stats page and standings are full-featured.
- Bracket view with main + consolation + live pills + advance-winners is solid.
- Tournament edit dashboard now correctly handles: phase add/delete/edit, type selector, tiebreaker reorder, suggest schedule, generate round-robin, generate bracket, bulk team+player import.
- i18n coverage across en/es/pt-BR.
- Memory note from 2026-08-16 reports the project at 95 % complete with 0 breaking gaps.