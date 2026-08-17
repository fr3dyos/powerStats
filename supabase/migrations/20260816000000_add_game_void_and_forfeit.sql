-- Add void/forfeit tracking columns to the games table.
-- `is_voided` marks a game as annulled (admin action); it does not affect
-- the score (we leave the existing scores untouched for audit purposes).
-- `forfeit_winner_team_id` records the team that won by forfeit when one
-- team didn't show / refused to play. Exactly one of these columns is
-- set per game — they are independent state machines.
-- Idempotent: safe to run more than once.

ALTER TABLE games
    ADD COLUMN IF NOT EXISTS is_voided BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS forfeit_winner_team_id INTEGER
        REFERENCES teams(id) ON DELETE SET NULL;
