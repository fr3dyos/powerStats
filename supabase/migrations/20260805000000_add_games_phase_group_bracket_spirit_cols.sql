-- 20260805000000_add_games_phase_group_bracket_spirit_cols.sql
--
-- Sync the live public.games table with the columns declared in models.Game.
-- The live DB was missing nine optional columns (phase/group attribution,
-- bracket placement, and spirit scores), which caused the SQLAlchemy ORM
-- to refuse to load Game rows, making GET /games return 500.
--
-- Adds:
--   phase_id           FK -> phases.id
--   group_id           FK -> groups.id
--   round_number       int (round-robin round, 1-based)
--   bracket_round      int (1 = first round, 2 = quarter, ...)
--   bracket_slot       int (slot index within the round)
--   is_placement       bool default false (3rd/5th/7th place match)
--   placement_position int (1 = final, 2 = 2nd, 3 = 3rd, ...)
--   spirit_home        float (0-10)
--   spirit_away        float (0-10)

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS phase_id            integer REFERENCES public.phases(id),
  ADD COLUMN IF NOT EXISTS group_id            integer REFERENCES public.groups(id),
  ADD COLUMN IF NOT EXISTS round_number        integer,
  ADD COLUMN IF NOT EXISTS bracket_round       integer,
  ADD COLUMN IF NOT EXISTS bracket_slot        integer,
  ADD COLUMN IF NOT EXISTS is_placement        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS placement_position  integer,
  ADD COLUMN IF NOT EXISTS spirit_home         double precision,
  ADD COLUMN IF NOT EXISTS spirit_away         double precision;

CREATE INDEX IF NOT EXISTS ix_games_phase_id ON public.games (phase_id);
CREATE INDEX IF NOT EXISTS ix_games_group_id ON public.games (group_id);
