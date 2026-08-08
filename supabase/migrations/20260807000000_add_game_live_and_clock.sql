-- Add live-status + game-clock columns to the games table.
-- Used by the scorekeeper console's "live" toggle and chronometer.
-- Idempotent: safe to run more than once.

ALTER TABLE games
    ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS clock_running BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS clock_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS clock_elapsed INTEGER NOT NULL DEFAULT 0;
