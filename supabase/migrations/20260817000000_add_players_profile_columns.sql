-- 20260817000000_add_players_profile_columns.sql
--
-- Extend public.players with three optional columns required by the CSV bulk
-- roster import flow:
--
--   gender      varchar(16)   e.g. 'M', 'F', 'mixed', 'open' (nullable;
--                              mixed/open tournaments may leave it unset)
--   nationality varchar(64)   e.g. 'BRA', 'USA' — defaults to a single space
--                              per project convention so existing rows are
--                              visibly "no value" rather than NULL
--   other       text          free-form notes, e.g. "right-handed". Defaults
--                              to a single space.
--
-- All three columns are optional in the CSV. The single-space default matches
-- the convention used elsewhere in the schema and avoids NULL-handling noise
-- in the admin UI.
--
-- Safe to re-run: every ALTER uses IF NOT EXISTS.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS gender      varchar(16),
  ADD COLUMN IF NOT EXISTS nationality varchar(64) DEFAULT ' ' NOT NULL,
  ADD COLUMN IF NOT EXISTS other       text        DEFAULT ' ' NOT NULL;

-- Backfill any pre-existing rows so the NOT NULL constraint applies cleanly.
UPDATE public.players
   SET nationality = ' '
 WHERE nationality IS NULL;

UPDATE public.players
   SET other = ' '
 WHERE other IS NULL;