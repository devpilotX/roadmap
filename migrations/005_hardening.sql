-- ==================================================================
-- 005_hardening.sql
--
-- Six corrections found by a full pre-deployment audit. Each one is a real
-- defect that either breaks the running application or corrupts data, and each
-- is explained here because a migration with no reasoning is a migration nobody
-- dares to reverse.
--
-- 001_init.sql is deliberately NOT edited. scripts/migrate.mjs records the
-- SHA-256 of every migration and treats a changed file as a hard stop, because
-- running different SQL under the same name is how databases drift. So the
-- corrections arrive as a new file, and a fresh install reaches the same final
-- state by applying 001 then 005.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. The 7 day retroactive rule must not block the application itself.
--
-- Part 18.7 rule 3 says a person may not retroactively edit a day older than
-- seven days. trg_day_logs_no_backdate_upd enforced that by rejecting EVERY
-- update to such a row, with no exemption for columns the system derives.
--
-- lib/db/progress.ts recomputeDay() updates pushes, money_touches, day_colour,
-- conditions_met and week_n. Those are not history being rewritten, they are a
-- projection recomputed from other tables. recomputeRange() walks the whole
-- 150 day window and is called from GitHub sync, repository edits and any
-- change to the start date.
--
-- The consequence, latent only because day_logs is currently empty: from the
-- eighth day of real use, every one of those paths raises SQLSTATE 45000 and
-- surfaces as a 500. The rule was correct; its implementation was too wide.
--
-- The trigger now fires only when a column a HUMAN enters actually changes.
-- Derived columns, and the id and timestamp columns, are exempt. NOT (a <=> b)
-- is the null safe "has changed" test: a plain != is unknown when either side
-- is NULL, which would have let a change to a nullable text column through.
-- ------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_day_logs_no_backdate_upd;
CREATE TRIGGER trg_day_logs_no_backdate_upd
BEFORE UPDATE ON day_logs FOR EACH ROW
BEGIN
  IF OLD.log_date < DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND (
         NOT (OLD.log_date             <=> NEW.log_date)
      OR NOT (OLD.user_id              <=> NEW.user_id)
      OR NOT (OLD.dsa_solved           <=> NEW.dsa_solved)
      OR NOT (OLD.dsa_minutes          <=> NEW.dsa_minutes)
      OR NOT (OLD.learn_done           <=> NEW.learn_done)
      OR NOT (OLD.learn_minutes        <=> NEW.learn_minutes)
      OR NOT (OLD.build_done           <=> NEW.build_done)
      OR NOT (OLD.build_minutes        <=> NEW.build_minutes)
      OR NOT (OLD.close_done           <=> NEW.close_done)
      OR NOT (OLD.close_log_line       <=> NEW.close_log_line)
      OR NOT (OLD.close_tomorrow_dsa   <=> NEW.close_tomorrow_dsa)
      OR NOT (OLD.close_tomorrow_build <=> NEW.close_tomorrow_build)
      OR NOT (OLD.money_done           <=> NEW.money_done)
      OR NOT (OLD.money_minutes        <=> NEW.money_minutes)
      OR NOT (OLD.night_anki_done      <=> NEW.night_anki_done)
      OR NOT (OLD.night_spoken_done    <=> NEW.night_spoken_done)
      OR NOT (OLD.night_spoken_aloud   <=> NEW.night_spoken_aloud)
      OR NOT (OLD.night_tomorrow_done  <=> NEW.night_tomorrow_done)
      OR NOT (OLD.anki_overdue         <=> NEW.anki_overdue)
      OR NOT (OLD.video_minutes        <=> NEW.video_minutes)
      OR NOT (OLD.blocked_on           <=> NEW.blocked_on)
      OR NOT (OLD.notes                <=> NEW.notes)
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Retroactive editing is limited to 7 days. History is not rewritten.';
  END IF;
END;


-- ------------------------------------------------------------------
-- 2. sessions needs to know whose session it is.
--
-- The table had no user_id, so "sign out everywhere" was implemented as
--   DELETE FROM sessions WHERE data LIKE '%"userId":12%'
-- in app/api/me/password/route.ts and scripts/reset-password.mjs. That pattern
-- has no trailing delimiter, so user 12 also matches the JSON of users 120,
-- 123 and 1234: changing one person's password signed out a different account.
-- With a single-user deployment it is invisible, and it is still wrong.
--
-- A real column also makes the row sweep in step 3 possible, and lets a deleted
-- user's sessions disappear with them through the foreign key.
-- ------------------------------------------------------------------

ALTER TABLE sessions
  ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER expires,
  ADD KEY idx_sessions_user (user_id);

-- Backfill from the JSON already stored, so existing sign-ins survive.
UPDATE sessions
   SET user_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId')) AS UNSIGNED)
 WHERE data IS NOT NULL
   AND JSON_VALID(data)
   AND JSON_EXTRACT(data, '$.userId') IS NOT NULL;

-- A session pointing at a user who no longer exists cannot take the key.
UPDATE sessions s
  LEFT JOIN users u ON u.id = s.user_id
   SET s.user_id = NULL
 WHERE s.user_id IS NOT NULL AND u.id IS NULL;

ALTER TABLE sessions
  ADD CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- ------------------------------------------------------------------
-- 3. Anonymous session rows must not accumulate.
--
-- GET /api/csrf is unauthenticated by design, and every call wrote a sessions
-- row with the full 30 day expiry. The only sweeper runs from
-- refreshSessionWindow, which only an authenticated route reaches. This local
-- database held 1,905 session rows for one user before the audit found it.
--
-- The application side of the fix is in lib/server/session.ts, which now gives
-- a session with no userId a two hour expiry instead of thirty days. This
-- statement clears the backlog those calls already left behind: any row that
-- carries no user and is not being actively used goes now.
-- ------------------------------------------------------------------

DELETE FROM sessions
 WHERE user_id IS NULL
   AND expires > UNIX_TIMESTAMP() + 7200;


-- ------------------------------------------------------------------
-- 4. One open study session per person, enforced by the database.
--
-- app/api/sessions/start checked for an open session and then inserted, which
-- is a read-then-write race: two taps produce two open timers, and from then on
-- the stop route can only ever close one of them.
--
-- MySQL has no partial index, so the constraint is expressed as a generated
-- column that holds the user id only while the row is open and NULL once it is
-- closed. A UNIQUE key permits many NULLs, so any number of finished sessions
-- coexist while a second open one is rejected outright.
-- ------------------------------------------------------------------

-- Close any duplicate open rows first, keeping the newest, or the key cannot be
-- added. minutes is left at 0 because an abandoned timer measured nothing.
UPDATE study_sessions s
  JOIN (
        SELECT user_id, MAX(id) AS keep_id
          FROM study_sessions
         WHERE ended_at IS NULL
      GROUP BY user_id
       ) k ON k.user_id = s.user_id
   SET s.ended_at = s.started_at,
       s.minutes = 0,
       s.auto_closed = 1
 WHERE s.ended_at IS NULL
   AND s.id <> k.keep_id;

ALTER TABLE study_sessions
  ADD COLUMN open_user_id BIGINT UNSIGNED
    GENERATED ALWAYS AS (IF(ended_at IS NULL, user_id, NULL)) VIRTUAL,
  ADD UNIQUE KEY uq_session_open_one (open_user_id);


-- ------------------------------------------------------------------
-- 5. A push is one row per repository per day.
--
-- uq_push_sha was (user_id, repo_id, sha_head). The manual route synthesises a
-- deterministic sha from the date and repository, so its upsert worked. The
-- GitHub sync in lib/github.ts stores the real head commit sha of that day, and
-- when a day's head commit changes between two syncs the ON DUPLICATE KEY no
-- longer matches: a second row appears for the same repository and date, and
-- pushSummary's SUM(commit_count) counts that day twice.
--
-- The intended key is the one the loop actually iterates: user, repo, date.
-- sha_head stays as a column, and is no longer part of a UNIQUE key it was also
-- NULLable inside.
-- ------------------------------------------------------------------

DELETE p FROM github_pushes p
  JOIN github_pushes q
    ON q.user_id   = p.user_id
   AND q.repo_id   = p.repo_id
   AND q.push_date = p.push_date
   AND q.id        > p.id;

ALTER TABLE github_pushes
  DROP INDEX uq_push_sha,
  ADD UNIQUE KEY uq_push_day (user_id, repo_id, push_date);


-- ------------------------------------------------------------------
-- 6. The audit trail must survive the thing it audits.
--
-- fk_audit_user was ON DELETE CASCADE, so deleting a user deleted the record of
-- what that user did. That is precisely backwards for an audit table, and the
-- column is already NULLable, so SET NULL is the correct behaviour: the entries
-- remain and simply stop naming a live account.
-- ------------------------------------------------------------------

ALTER TABLE audit_log
  DROP FOREIGN KEY fk_audit_user;

ALTER TABLE audit_log
  ADD CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;


-- ------------------------------------------------------------------
-- 7. Two indexes the hot paths were missing.
--
-- dsa_topics was ordered by ord on every /dsa request with no index on it, so
-- MySQL sorted 18 rows on the fly and nextUnsolvedProblem built a temporary
-- table to do it. Small today, and it is on the first screen of the app.
-- ------------------------------------------------------------------

ALTER TABLE dsa_topics
  ADD KEY idx_dsa_topics_ord (ord);

-- The open session lookup filters on user_id and ended_at IS NULL and then
-- takes the newest. Leading with the open marker lets it be answered from the
-- index alone rather than by filtering the whole of a user's history.
ALTER TABLE study_sessions
  ADD KEY idx_session_open_recent (open_user_id, started_at);
