-- 20260818000000_add_games_void_forfeit_cols.sql
--
-- Extend public.games with the two columns required by the void/forfeit game
-- actions that landed in commit 42f1261 (`feat: add void/forfeit game actions
-- for admin scoring`). The SQLAlchemy Game model declares both columns, but
-- no migration was applied to add them to the actual database, which broke
-- phase deletion (and any other endpoint that reads all Game columns).
--
--   is_voided                boolean          whether an admin voided this
--                                              game after-the-fact. Nullable
--                                              for backward compatibility with
--                                              pre-existing rows; defaulted to
--                                              false so new games are not void.
--   forfeit_winner_team_id   integer          when a game was ended as a
--                                              forfeit (e.g. one team did not
--                                              show up), points at the team
--                                              credited with the win. Nullable
--                                              for normal games. ON DELETE
--                                              SET NULL keeps the game row
--                                              readable if the team is removed.
--
-- Both columns are read by the admin scoring endpoints and the phase-deletion
-- cascade query that pre-loads games for cleanup, so they must exist on every
-- row, not just new inserts.
--
-- Safe to re-run: every ALTER uses IF NOT EXISTS.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS is_voided              boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS forfeit_winner_team_id integer
    REFERENCES public.teams(id) ON DELETE SET NULL;

-- Backfill any pre-existing rows so the NOT NULL semantics for is_voided hold
-- cleanly. (Column is nullable, but explicitly setting false avoids relying on
-- the default at query time and makes the data match the Python-side default.)
UPDATE public.games
   SET is_voided = false
 WHERE is_voided IS NULL;
