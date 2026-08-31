-- ==================================================================
-- 006_lead_touch_idempotency.sql
--
-- One touch per lead per day, enforced by the database.
--
-- POST /api/leads/:id/touch inserted a lead_touches row with nothing to stop it
-- being inserted twice. That matters more than it looks, because money_touches on
-- day_logs is DERIVED: recomputeDay counts lead_touches for the date. The offline
-- write queue in lib/client/offline.ts replays a POST whose response never
-- arrived, and a replayed touch therefore inflated the day's touch count and could
-- flip the day colour from red to green on work that was done once.
--
-- The route now takes a row lock and returns the existing touch instead of
-- inserting a second one. This key is what makes that guarantee true rather than
-- merely likely: two requests that pass the lock in the same instant, or any
-- future caller that forgets the guard, are refused by MySQL.
--
-- 005_hardening.sql is already applied and its SHA-256 is recorded, so this
-- arrives as its own file rather than as an edit. scripts/migrate.mjs treats a
-- changed migration as a hard stop, which is the behaviour that keeps a database
-- and its history honest.
-- ==================================================================


-- Collapse any existing duplicates first, keeping the earliest row, or the unique
-- key cannot be created. The earliest is kept because it is the one that recorded
-- when the work actually happened; the later rows are replays of it.
DELETE t FROM lead_touches t
  JOIN lead_touches u
    ON u.user_id    = t.user_id
   AND u.lead_id    = t.lead_id
   AND u.touched_on = t.touched_on
   AND u.id         < t.id;

ALTER TABLE lead_touches
  ADD UNIQUE KEY uq_touch_lead_day (user_id, lead_id, touched_on);
