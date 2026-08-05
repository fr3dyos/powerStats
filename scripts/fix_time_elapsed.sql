-- Audit, then repair corrupted legacy rows in the game_events table.
-- Legacy rows may store negative elapsed time (seconds from game start),
-- which violates the API response contract (time_elapsed >= 0) and causes
-- GET /players/{id} to fail with ResponseValidationError.
--
-- Run this once against the production Postgres (Supabase) database:
--
--   psql "$SUPABASE_DB_URL" -f scripts/fix_time_elapsed.sql
--
-- It is intentionally idempotent: after the first run the SELECT returns
-- zero rows and the UPDATE becomes a no-op.

-- 1. Audit: show every corrupted row before touching data.
SELECT id, game_id, point_id, time_elapsed
FROM game_events
WHERE time_elapsed < 0;

-- 2. Repair: clamp negative elapsed times to 0.
--    A zeroed timestamp means "the event happened at the start of the game",
--    which is the safest canonicalization for legacy data.
UPDATE game_events SET time_elapsed = 0 WHERE time_elapsed < 0;

-- 3. Verify: confirm no negative values remain.
SELECT COUNT(*) AS remaining_negative_rows
FROM game_events
WHERE time_elapsed < 0;

