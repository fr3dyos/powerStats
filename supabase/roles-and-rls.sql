-- ---------------------------------------------------------------------------
-- PowerStats — Roles, app_metadata, and Row Level Security
-- ---------------------------------------------------------------------------
-- IMPORTANT: read this entire file before running any of it.
--
-- This file is a REFERENCE TEMPLATE. It does three things:
--
--   1. Documents how `app_metadata.role` (the JWT claim) is the source of
--      truth for authorization, and how to set it from a trusted context.
--   2. Creates a `profiles` table that mirrors the user's role for display
--      and application data purposes (e.g. showing a name in the UI).
--   3. Enables RLS on `profiles` with policies that:
--        * let a user read their own profile;
--        * explicitly deny users from changing their own role;
--        * let admins manage profiles via the service-role client only.
--
-- WHERE TO RUN THIS
-- -----------------
-- The "safe example" below uses SQL placeholders only. It must be executed
-- from the Supabase SQL editor as a database administrator (or via the
-- Supabase service-role server), NOT from the browser, NOT from a
-- public-facing SQL endpoint.
--
-- SECURITY REMINDERS
-- ------------------
-- * The Supabase `service_role` key bypasses Row Level Security. It must
--   only ever live on a protected server (the FastAPI backend). Never
--   expose it to the browser, never commit it to the repository.
-- * `admin` role is granted only by a trusted admin process. There is no
--   self-service "promote me to admin" endpoint or page. Public sign-up
--   must never be allowed to write `app_metadata.role`.
-- * Frontend checks, FastAPI `require_admin`, and this RLS are
--   independent layers — keep all three intact.

-- ---------------------------------------------------------------------------
-- 1. Set `app_metadata.role` for an existing user (TRUSTED ADMIN CONTEXT)
-- ---------------------------------------------------------------------------
-- Run this from the Supabase SQL editor (or via a service-role server
-- script) AFTER the user has been created through Supabase Auth. Never
-- run this from a client/brower context.
--
-- Replace the UUID below with the actual auth.users.id you want to
-- promote. This template intentionally uses placeholders only.

-- UPDATE auth.users
-- SET raw_app_meta_data =
--     jsonb_set(
--         coalesce(raw_app_meta_data, '{}'::jsonb),
--         '{role}',
--         '"admin"',
--         true
--     )
-- WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;

-- ---------------------------------------------------------------------------
-- 2. Optional `profiles` table — application-side mirror of the user
-- ---------------------------------------------------------------------------
-- Why have a separate `profiles` table if `app_metadata.role` is already
-- authoritative?
--
--   * JWT app_metadata.role — used for authorization checks (FastAPI
--     require_admin, frontend role guards). It is the source of truth.
--   * profiles.role         — application data (display name, avatar,
--     preferences). Convenient for joins; not trusted for authorization
--     on its own.
--   * Row Level Security    — the actual database authorization control.
--
-- The `profiles.role` column is intentionally NOT used for authorization;
-- policies compare against `auth.jwt() -> 'app_metadata' ->> 'role'`.

create table if not exists public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    email       text,
    display_name text,
    role        text not null default 'public'
        check (role in ('admin', 'scorekeeper', 'public')),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx
    on public.profiles (role);

comment on table  public.profiles is
    'Application-side mirror of auth.users. role here is display-only and '
    'MUST NOT be used as an authorization source. Authorization comes from '
    'auth.users.raw_app_meta_data->>''role'' and Supabase Row Level Security.';
comment on column public.profiles.role is
    'Display-only role for the user. Authorized actions are gated by '
    'app_metadata.role and the RLS policies below.';

-- ---------------------------------------------------------------------------
-- 3. Row Level Security on `profiles`
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- 3a. A user may SELECT their own profile.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
    on public.profiles
    for select
    to authenticated
    using (auth.uid() = id);

-- 3b. A user may UPDATE their own profile, EXCEPT the `role` column.
--     We split the update surface into safe columns and the privileged
--     column so users cannot promote themselves to admin/scorekeeper.
drop policy if exists profiles_update_own_safe on public.profiles;
create policy profiles_update_own_safe
    on public.profiles
    for update
    to authenticated
    using (auth.uid() = id)
    with check (
        auth.uid() = id
        and role = (select p.role from public.profiles p where p.id = auth.uid())
    );

--     Note: the WITH CHECK above prevents the user from sending an UPDATE
--     that changes `role`. The role must remain exactly whatever it
--     already was for that row.

-- 3c. INSERT for a user happens automatically when they sign up, via a
--     trigger or via the service-role client. There is no INSERT policy
--     for `authenticated`, so users cannot fabricate profiles for others.
--     (Optionally, an admin-only INSERT policy can be added later.)

-- 3d. DELETE is not granted to `authenticated`. Profile cleanup happens
--     via ON DELETE CASCADE from auth.users when an admin removes the
--     auth user via the service-role client.

-- ---------------------------------------------------------------------------
-- 4. Auto-create a profile row when a new user signs up
-- ---------------------------------------------------------------------------
-- This trigger inserts a `public.profiles` row with role 'public' for any
-- new auth.users row. It does NOT grant admin. Admin promotion is a
-- separate, trusted operation (see section 1).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, role)
    values (new.id, new.email, 'public')
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. How the three layers fit together
-- ---------------------------------------------------------------------------
--
--   Authorization layer          Where it lives              Used for
--   --------------------------   --------------------------   ----------------
--   JWT app_metadata.role        Supabase Auth (JWT claim)    FastAPI require_admin,
--                                                            frontend role guards.
--   profiles.role                public.profiles table        UI display only;
--                                                            NEVER trusted for
--                                                            authorization.
--   Row Level Security           Postgres policies           Real DB-side
--                                                            authorization on
--                                                            profiles (and on
--                                                            every future
--                                                            privileged table).
--
-- When you add new tables, write RLS policies for them. Privileged writes
-- must NOT use `USING (true)` or `WITH CHECK (true)`.