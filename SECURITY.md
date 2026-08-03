# PowerStats — Security Notes

This document captures the trust boundaries, authentication model, and the
defense-in-depth layers that protect the PowerStats admin area. It is
intentionally short and concrete so that future contributors apply the
same guarantees when adding features.

## Roles

PowerStats uses three roles:

| Role          | Used for                                              |
| ------------- | ----------------------------------------------------- |
| `admin`       | Full management: tournaments, teams, players, scoring |
| `scorekeeper` | Live scoring console at a field                       |
| `public`      | Anonymous visitors reading public stats               |

Roles live in the user's Supabase **app metadata**, not user metadata:

    user.app_metadata.role === "admin"

`user_metadata` is user-editable through the client; trusting it for
authorization is unsafe. Only Supabase service-role code (server-side)
should ever modify `app_metadata`.

## Authentication model

### Frontend (Next.js + Supabase SSR)

- `@supabase/ssr` with `createBrowserClient()` for Client Components and
  `createServerClient()` for Server Components / Route Handlers.
- Cookie-based sessions, refreshed by the root `middleware.ts` calling
  `utils/supabase/middleware.ts → updateSession()`.
- Login uses `supabase.auth.signInWithPassword({ email, password })`.
- Password reset uses
  `supabase.auth.resetPasswordForEmail(email, { redirectTo })` with the
  recovery URL set to `new URL("/reset-password", window.location.origin)`.

### Server-side authorization (the source of truth)

- `supabase.auth.getClaims()` (JWT-verified via Supabase JWKS) is the
  authoritative check; it is exposed by `utils/supabase/server.ts →
  getAuthedUser()`.
- `supabase.auth.getUser()` is used **only** to read the current user
  record (e.g. `app_metadata`). It is never used to decide access.
- `supabase.auth.getSession()` is **never** trusted for authorization —
  it can return stale or unsigned data and bypasses signature checks.

### `/admin` protection

The admin dashboard is protected in **three** places:

1. **Middleware** (`utils/supabase/middleware.ts`) — fast redirect for
   users without a Supabase session, so the dashboard is never briefly
   rendered for anonymous traffic.
2. **Server Component** (`app/admin/page.tsx`) — calls
   `getAuthedUser()` and enforces `role === "admin"`. Non-admins are
   redirected to `/?error=unauthorized`.
3. **FastAPI API layer** — every admin mutation route must
   `Depends(require_admin)` (see `routers/auth.py`). The dependency
   validates the bearer JWT and reads the verified `app_metadata.role`.

If any of these three layers is missing, the dashboard or API is not
considered production-safe.

### Unauthorized behaviour

- No session at all → redirect to `/admin/login`.
- Signed in but `role !== "admin"` → redirect to `/?error=unauthorized`.
  The home page renders a generic message ("You do not have permission
  to access the admin area") and **never** discloses the user's role,
  account status, or backend details.

### `require_admin` on the API

The FastAPI dependency in `routers/auth.py` reads
`Authorization: Bearer <token>`, validates the token via the Supabase
service-role client's `auth.get_user(token)`, and checks
`app_metadata.role == "admin"`. It returns:

- **401** for missing or invalid tokens.
- **403** for a valid token whose role is not allowed.

Apply it to:

- `routers/tournaments.py` — every mutation route
- `routers/teams.py` — every mutation route, including logo uploads
- `routers/players.py` — every mutation route, including photo uploads
- `routers/games.py` — live scoring events, timeouts, halves, game end
- New bracket / round-robin / schedule generators
- Any new admin-only endpoint

## Database authorization (Supabase RLS)

Frontend checks, server-side guards, and FastAPI dependencies are not
enough. Supabase **Row Level Security** is the actual database
authorization control. See `supabase/roles-and-rls.sql` for:

- A `profiles` table linked to `auth.users`.
- RLS enabled on `profiles`.
- A read policy allowing a user to read their own profile.
- An explicit deny of self-updates to `profiles.role` so users cannot
  promote themselves.
- A trusted-context example for setting `app_metadata.role` server-side.

When you add new tables, write RLS policies for them. The convention is:

- Read: `auth.uid() = owner_id` for owner-scoped data; `auth.role() =
  'authenticated'` for shared data.
- Write (privileged): explicit policies that check `app_metadata.role`
  via a Postgres function or rely on the service-role client.

Never ship a privileged write policy with `USING (true)` or
`WITH CHECK (true)`.

## What to **never** do

- Do not store roles in `user_metadata`.
- Do not accept roles in a request body or query string.
- Do not use `supabase.auth.getSession()` for access control.
- Do not use the service-role key in the browser or in client-bundled
  code.
- Do not expose raw Supabase error strings in the UI; use the generic
  copy defined in `en.json` / `es.json` / `pt-BR.json` under `auth.*`.
- Do not allow self-registration to grant `admin`. The first admin
  account must be created in a trusted context (Supabase Dashboard or a
  service-role server-side script) and the role set explicitly via
  `app_metadata.role`.