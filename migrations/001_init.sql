-- ------------------------------------------------------------------
-- 001_init.sql | The Roadmap Tracker
--
-- MySQL 8.0.16 or later. InnoDB, utf8mb4, utf8mb4_0900_ai_ci.
-- Reference tables hold the roadmap and are read only in the UI.
-- User tables hold progress and cascade on user deletion.
-- ------------------------------------------------------------------

SET NAMES utf8mb4;
SET time_zone = '+05:30';

-- ==================================================================
-- 1. Auth and profile
-- ==================================================================

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(120) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS profiles (
  user_id        BIGINT UNSIGNED PRIMARY KEY,
  full_name      VARCHAR(160),
  phone          VARCHAR(32),
  city           VARCHAR(120) DEFAULT 'Patna',
  github_user    VARCHAR(120),
  github_token   VARBINARY(512) NULL,
  linkedin_url   VARCHAR(255),
  portfolio_url  VARCHAR(255),
  site_1         VARCHAR(255),
  site_2         VARCHAR(255),
  site_3         VARCHAR(255),
  upi_id         VARCHAR(120),
  avatar_path    VARCHAR(255),
  target_role    VARCHAR(8),
  roadmap_start  DATE NOT NULL DEFAULT '2026-08-28',
  roadmap_end    DATE NOT NULL DEFAULT '2027-01-24',
  timezone       VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  bio            TEXT,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires    INT UNSIGNED NOT NULL,
  data       MEDIUMTEXT,
  KEY idx_sessions_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Per user interface state: theme, remembered views, notification opt ins.
CREATE TABLE IF NOT EXISTS user_settings (
  user_id            BIGINT UNSIGNED PRIMARY KEY,
  theme              ENUM('system','light','dark') NOT NULL DEFAULT 'system',
  calendar_view      ENUM('month','week','day') NOT NULL DEFAULT 'month',
  notify_blocks_json JSON NULL,
  notify_gates       TINYINT(1) NOT NULL DEFAULT 1,
  public_progress    TINYINT(1) NOT NULL DEFAULT 0,
  public_slug        VARCHAR(64) NULL UNIQUE,
  last_synced_at     DATETIME NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==================================================================
-- 2. Reference: the shape of the plan
-- ==================================================================

CREATE TABLE IF NOT EXISTS clock_facts (
  ord   SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  item  VARCHAR(255) NOT NULL,
  value TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS day_blocks (
  code         ENUM('DSA','LEARN','BUILD','CLOSE','BREAK','MONEY','NIGHT') NOT NULL PRIMARY KEY,
  ord          SMALLINT UNSIGNED NOT NULL,
  block_name   VARCHAR(64) NOT NULL,
  window_text  VARCHAR(64) NOT NULL,
  hours        DECIMAL(4,2) NOT NULL,
  what_happens TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS corrections (
  code           CHAR(3) NOT NULL PRIMARY KEY,
  ord            SMALLINT UNSIGNED NOT NULL,
  was_wrong      TEXT NOT NULL,
  actually_true  TEXT NOT NULL,
  source         TEXT NOT NULL,
  fix            TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS subjects (
  ord        SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  subject    VARCHAR(160) NOT NULL,
  when_text  VARCHAR(255) NOT NULL,
  hours_text VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS launch_days (
  cal_date DATE NOT NULL PRIMARY KEY,
  ord      SMALLINT UNSIGNED NOT NULL,
  day_name VARCHAR(16) NOT NULL,
  work     TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS phases (
  code      CHAR(1) NOT NULL PRIMARY KEY,
  ord       SMALLINT UNSIGNED NOT NULL,
  name      VARCHAR(80) NOT NULL,
  week_from TINYINT UNSIGNED NOT NULL,
  week_to   TINYINT UNSIGNED NOT NULL,
  blurb     TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS gates (
  no             TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  week_n         TINYINT UNSIGNED NOT NULL,
  gate_date      DATE NOT NULL,
  condition_text TEXT NOT NULL,
  KEY idx_gates_week (week_n)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS weeks (
  n              TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  dates_label    VARCHAR(64) NOT NULL,
  title          VARCHAR(255) NOT NULL,
  phase_code     CHAR(1) NOT NULL,
  focus          TEXT NOT NULL,
  dsa_target     SMALLINT UNSIGNED NOT NULL,
  dsa_cumulative SMALLINT UNSIGNED NOT NULL,
  gate_no        TINYINT UNSIGNED NULL,
  CONSTRAINT fk_week_phase FOREIGN KEY (phase_code) REFERENCES phases(code),
  CONSTRAINT fk_week_gate FOREIGN KEY (gate_no) REFERENCES gates(no),
  KEY idx_weeks_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- gates.week_n is deliberately not a foreign key. weeks.gate_no already carries
-- the relationship, and a second constraint in the other direction would make
-- the two tables circular and unseedable. The parser cross checks both ways.

CREATE TABLE IF NOT EXISTS resource_categories (
  no   TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS resources (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_no  TINYINT UNSIGNED NOT NULL,
  ord          SMALLINT UNSIGNED NOT NULL,
  url          VARCHAR(500) NOT NULL,
  label        VARCHAR(500) NOT NULL,
  why          TEXT NOT NULL,
  cost         VARCHAR(64) NOT NULL,
  weeks_csv    VARCHAR(120) NOT NULL DEFAULT '',
  is_alive     TINYINT(1) NOT NULL DEFAULT 1,
  last_status  SMALLINT UNSIGNED NULL,
  last_checked DATE NULL,
  UNIQUE KEY uq_resource (category_no, ord),
  KEY idx_resource_url (url(191)),
  CONSTRAINT fk_resource_cat FOREIGN KEY (category_no) REFERENCES resource_categories(no) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS week_days (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  week_n         TINYINT UNSIGNED NOT NULL,
  day_name       VARCHAR(8) NOT NULL,
  day_order      TINYINT UNSIGNED NOT NULL,
  learn_task     TEXT NOT NULL,
  build_task     TEXT NOT NULL,
  dsa_day_target SMALLINT UNSIGNED NOT NULL,
  cal_date       DATE NOT NULL,
  UNIQUE KEY uq_week_day (week_n, day_order),
  UNIQUE KEY uq_week_day_date (cal_date),
  CONSTRAINT fk_weekday_week FOREIGN KEY (week_n) REFERENCES weeks(n) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sundays (
  week_n      TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  sunday_date DATE NOT NULL UNIQUE,
  kind        ENUM('working','gate','rest') NOT NULL,
  hours       TINYINT UNSIGNED NOT NULL,
  type_text   VARCHAR(64) NOT NULL,
  topic       TEXT NOT NULL,
  CONSTRAINT fk_sunday_week FOREIGN KEY (week_n) REFERENCES weeks(n) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS calendar_days (
  cal_date   DATE NOT NULL PRIMARY KEY,
  week_n     TINYINT UNSIGNED NULL,
  day_label  VARCHAR(16) NOT NULL,
  kind       ENUM('launch','study','sunday_working','sunday_gate','sunday_rest') NOT NULL,
  dsa_target SMALLINT UNSIGNED NOT NULL,
  learn_task TEXT NOT NULL,
  build_task TEXT NOT NULL,
  money_task TEXT NOT NULL,
  CONSTRAINT fk_calday_week FOREIGN KEY (week_n) REFERENCES weeks(n),
  KEY idx_calendar_week (week_n),
  KEY idx_calendar_kind (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS week_links (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  week_n       TINYINT UNSIGNED NOT NULL,
  ord          SMALLINT UNSIGNED NOT NULL,
  url          VARCHAR(500) NOT NULL,
  label        VARCHAR(500) NOT NULL,
  resource_id  BIGINT UNSIGNED NULL,
  is_alive     TINYINT(1) NOT NULL DEFAULT 1,
  last_status  SMALLINT UNSIGNED NULL,
  last_checked DATE NULL,
  UNIQUE KEY uq_week_link (week_n, ord),
  CONSTRAINT fk_weeklink_week FOREIGN KEY (week_n) REFERENCES weeks(n) ON DELETE CASCADE,
  CONSTRAINT fk_weeklink_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE SET NULL,
  KEY idx_weeklink_url (url(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS week_learn (
  id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  week_n TINYINT UNSIGNED NOT NULL,
  ord    SMALLINT UNSIGNED NOT NULL,
  text   TEXT NOT NULL,
  UNIQUE KEY uq_week_learn (week_n, ord),
  CONSTRAINT fk_weeklearn_week FOREIGN KEY (week_n) REFERENCES weeks(n) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS week_build (
  id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  week_n TINYINT UNSIGNED NOT NULL,
  ord    SMALLINT UNSIGNED NOT NULL,
  text   TEXT NOT NULL,
  UNIQUE KEY uq_week_build (week_n, ord),
  CONSTRAINT fk_weekbuild_week FOREIGN KEY (week_n) REFERENCES weeks(n) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS week_ships (
  id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  week_n TINYINT UNSIGNED NOT NULL,
  ord    SMALLINT UNSIGNED NOT NULL,
  text   TEXT NOT NULL,
  UNIQUE KEY uq_week_ship (week_n, ord),
  CONSTRAINT fk_weekship_week FOREIGN KEY (week_n) REFERENCES weeks(n) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS week_traps (
  week_n TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  text   TEXT NOT NULL,
  CONSTRAINT fk_weektrap_week FOREIGN KEY (week_n) REFERENCES weeks(n) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS week_notes (
  week_n TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  text   TEXT NOT NULL,
  CONSTRAINT fk_weeknote_week FOREIGN KEY (week_n) REFERENCES weeks(n) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS dsa_month_checkpoints (
  ord         SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  month_label VARCHAR(64) NOT NULL,
  cumulative  SMALLINT UNSIGNED NOT NULL,
  note        VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS dsa_pace (
  ord           SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  week_from     TINYINT UNSIGNED NOT NULL,
  week_to       TINYINT UNSIGNED NOT NULL,
  weekly_target SMALLINT UNSIGNED NOT NULL,
  mon TINYINT UNSIGNED NOT NULL,
  tue TINYINT UNSIGNED NOT NULL,
  wed TINYINT UNSIGNED NOT NULL,
  thu TINYINT UNSIGNED NOT NULL,
  fri TINYINT UNSIGNED NOT NULL,
  sat TINYINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==================================================================
-- 3. Reference: projects, stack, library
-- ==================================================================

CREATE TABLE IF NOT EXISTS projects (
  id          BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  code        VARCHAR(8) NOT NULL UNIQUE,
  name        VARCHAR(160) NOT NULL,
  repo        VARCHAR(160) NOT NULL,
  week_from   TINYINT UNSIGNED NOT NULL,
  week_to     TINYINT UNSIGNED NOT NULL,
  description TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS readme_sections (
  id    BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord   SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS stack_versions (
  id      BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  tech    VARCHAR(120) NOT NULL,
  version VARCHAR(120) NOT NULL,
  status  VARCHAR(160) NOT NULL,
  why     TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS breaks (
  id            BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  if_you_do     TEXT NOT NULL,
  what_happens  TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS dsa_topics (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS dsa_problems (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_id   BIGINT UNSIGNED NOT NULL,
  ord        SMALLINT UNSIGNED NOT NULL,
  name       VARCHAR(255) NOT NULL,
  difficulty ENUM('Easy','Medium','Hard') NOT NULL,
  url        VARCHAR(500) NULL,
  UNIQUE KEY uq_problem (topic_id, ord),
  KEY idx_problem_difficulty (difficulty),
  CONSTRAINT fk_problem_topic FOREIGN KEY (topic_id) REFERENCES dsa_topics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS dsa_thresholds (
  id            BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  cumulative    SMALLINT UNSIGNED NOT NULL,
  reached_label VARCHAR(255) NOT NULL,
  unlocks       TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==================================================================
-- 4. Reference: courses, night block, machine, focus
-- ==================================================================

CREATE TABLE IF NOT EXISTS owned_courses (
  id              BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  course          VARCHAR(200) NOT NULL,
  videos          SMALLINT UNSIGNED NOT NULL,
  progress        VARCHAR(64) NOT NULL,
  access_expires  VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS course_rulings (
  id     BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  course VARCHAR(200) NOT NULL,
  ruling TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS course_topic_map (
  id     BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  track  ENUM('web','devops') NOT NULL,
  ord    SMALLINT UNSIGNED NOT NULL,
  topic  VARCHAR(200) NOT NULL,
  ruling TEXT NOT NULL,
  KEY idx_topicmap_track (track, ord)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS video_rules (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  rule TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS falsifier (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  text TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS night_segments (
  id      BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord     SMALLINT UNSIGNED NOT NULL,
  segment VARCHAR(120) NOT NULL,
  minutes SMALLINT UNSIGNED NOT NULL,
  detail  TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS machine_inventory (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  item TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS focus_rules (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  rule TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS honesty_tests (
  id       BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord      SMALLINT UNSIGNED NOT NULL,
  question TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==================================================================
-- 5. Reference: roles, skills, ladder
-- ==================================================================

CREATE TABLE IF NOT EXISTS roles (
  code            VARCHAR(8) NOT NULL PRIMARY KEY,
  name            VARCHAR(160) NOT NULL,
  short_name      VARCHAR(160) NOT NULL,
  entry_band      VARCHAR(120) NOT NULL,
  band_low_lakh   DECIMAL(5,2) NULL,
  band_high_lakh  DECIMAL(5,2) NULL,
  ceiling         VARCHAR(160) NOT NULL,
  verdict         TEXT NOT NULL,
  what_they_test  TEXT NOT NULL,
  which_project   TEXT NOT NULL,
  rank_order      SMALLINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS roles_early (
  id             BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  code           VARCHAR(8) NOT NULL UNIQUE,
  role           VARCHAR(200) NOT NULL,
  earliest_text  VARCHAR(120) NOT NULL,
  earliest_week  TINYINT UNSIGNED NOT NULL,
  earliest_date  DATE NOT NULL,
  entry_band     VARCHAR(120) NOT NULL,
  band_low_lakh  DECIMAL(5,2) NOT NULL,
  band_high_lakh DECIMAL(5,2) NOT NULL,
  verdict        TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS skills (
  id          BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord         SMALLINT UNSIGNED NOT NULL,
  name        VARCHAR(200) NOT NULL,
  roles_text  VARCHAR(255) NOT NULL,
  roles_csv   VARCHAR(120) NOT NULL,
  where_built VARCHAR(200) NOT NULL,
  week_n      TINYINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS role_unlocks (
  id          BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord         SMALLINT UNSIGNED NOT NULL,
  milestone   VARCHAR(255) NOT NULL,
  unlock_date DATE NOT NULL,
  roles_text  TEXT NOT NULL,
  roles_csv   VARCHAR(120) NOT NULL,
  verdict     TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS resume_stages (
  id       BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord      SMALLINT UNSIGNED NOT NULL,
  stage    VARCHAR(64) NOT NULL,
  headline TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS eligibility_definitions (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  text TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS eligibility_weeks (
  id                    BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  week_key              VARCHAR(8) NOT NULL UNIQUE,
  week_n                TINYINT UNSIGNED NOT NULL,
  reached_date          DATE NOT NULL,
  dsa_total             SMALLINT UNSIGNED NOT NULL,
  newly_holds           TEXT NOT NULL,
  newly_eligible_text   TEXT NOT NULL,
  newly_eligible_codes  JSON NOT NULL,
  band                  VARCHAR(120) NOT NULL,
  apply_verdict         TEXT NOT NULL,
  is_advised            TINYINT(1) NOT NULL,
  KEY idx_elig_week (week_n)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS eligibility_dsa (
  id             BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord            SMALLINT UNSIGNED NOT NULL,
  problems       SMALLINT UNSIGNED NOT NULL UNIQUE,
  reached_about  VARCHAR(160) NOT NULL,
  gets_you_past  TEXT NOT NULL,
  does_not_open  TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS fast_exits (
  id               BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  exit_no          TINYINT UNSIGNED NOT NULL UNIQUE,
  exit_label       VARCHAR(32) NOT NULL,
  exit_date        DATE NOT NULL,
  exit_week        TINYINT UNSIGNED NULL,
  roles_available  VARCHAR(255) NOT NULL,
  band             VARCHAR(120) NOT NULL,
  what_you_give_up TEXT NOT NULL,
  verdict          TEXT NOT NULL,
  cost_note        TEXT NULL,
  before_gate3     TINYINT(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS skill_combos (
  id                    BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  sort_order            SMALLINT UNSIGNED NOT NULL UNIQUE,
  stack_held            TEXT NOT NULL,
  dsa_needed_text       VARCHAR(120) NOT NULL,
  dsa_needed            SMALLINT UNSIGNED NOT NULL,
  roles_unlocked_text   TEXT NOT NULL,
  roles_unlocked_codes  JSON NOT NULL,
  band                  VARCHAR(120) NOT NULL,
  interview_you_face    TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS break_plan (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  text TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==================================================================
-- 6. Reference: skip list, costs, continuation, New Zealand
-- ==================================================================

CREATE TABLE IF NOT EXISTS skip_list (
  id     BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord    SMALLINT UNSIGNED NOT NULL,
  item   VARCHAR(200) NOT NULL,
  reason TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS do_not_buy (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  item TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS added_topics (
  id     BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord    SMALLINT UNSIGNED NOT NULL,
  item   VARCHAR(200) NOT NULL,
  reason TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS costs (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  item TEXT NOT NULL,
  cost VARCHAR(120) NOT NULL,
  note TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS continuation (
  id         BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord        SMALLINT UNSIGNED NOT NULL,
  kind       ENUM('branch','bridge','weekday','year','quarter','year_detail') NOT NULL,
  label      VARCHAR(160) NOT NULL,
  period     VARCHAR(160) NOT NULL,
  age_label  VARCHAR(64) NOT NULL,
  goal       TEXT NOT NULL,
  detail     TEXT NOT NULL,
  hours_text VARCHAR(120) NOT NULL,
  KEY idx_continuation_kind (kind, ord)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS nz_requirements (
  id          BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord         SMALLINT UNSIGNED NOT NULL,
  requirement VARCHAR(160) NOT NULL,
  detail      TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS nz_facts (
  id        BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord       SMALLINT UNSIGNED NOT NULL,
  group_key ENUM('wage','salary') NOT NULL,
  label     VARCHAR(200) NOT NULL,
  value     TEXT NOT NULL,
  caveat    TEXT NOT NULL,
  KEY idx_nzfact_group (group_key, ord)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS nz_corrections (
  id    BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord   SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  body  TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS nz_milestones (
  id             BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord            SMALLINT UNSIGNED NOT NULL,
  milestone_date VARCHAR(64) NOT NULL,
  age_on_id      VARCHAR(32) NOT NULL,
  age_actual     VARCHAR(32) NOT NULL,
  age_label      VARCHAR(80) NOT NULL,
  milestone      TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS nz_costs (
  id           BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  sort_order   SMALLINT UNSIGNED NOT NULL,
  item         VARCHAR(255) NOT NULL,
  cost_rupees  VARCHAR(120) NOT NULL,
  basis        VARCHAR(255) NOT NULL,
  is_total     TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS nz_salary (
  id                BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord               SMALLINT UNSIGNED NOT NULL,
  gross_nzd         VARCHAR(64) NOT NULL,
  gross_rupees      VARCHAR(64) NOT NULL,
  effective_tax_pct VARCHAR(64) NOT NULL,
  net_nzd           VARCHAR(64) NOT NULL,
  net_rupees        VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS nz_projection (
  id                  BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord                 SMALLINT UNSIGNED NOT NULL,
  years_after_landing SMALLINT UNSIGNED NOT NULL,
  real_age            VARCHAR(32) NOT NULL,
  accumulated_rupees  VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS nz_unverified (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  text TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==================================================================
-- 7. Reference: the money hour
-- ==================================================================

CREATE TABLE IF NOT EXISTS money_rules (
  id        BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  group_key ENUM('survivable','protection') NOT NULL,
  ord       SMALLINT UNSIGNED NOT NULL,
  rule      TEXT NOT NULL,
  KEY idx_moneyrule_group (group_key, ord)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS money_lanes (
  id                  BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord                 SMALLINT UNSIGNED NOT NULL,
  lane                VARCHAR(64) NOT NULL,
  what_it_is          TEXT NOT NULL,
  time_to_first_rupee VARCHAR(64) NOT NULL,
  ceiling             VARCHAR(64) NOT NULL,
  use_it_for          TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS offers (
  code              VARCHAR(8) NOT NULL PRIMARY KEY,
  ord               SMALLINT UNSIGNED NOT NULL,
  name              VARCHAR(120) NOT NULL,
  scope             TEXT NOT NULL,
  delivery          VARCHAR(120) NOT NULL,
  price_band_text   VARCHAR(120) NOT NULL,
  price_low         INT UNSIGNED NOT NULL,
  price_high        INT UNSIGNED NOT NULL,
  is_recurring      TINYINT(1) NOT NULL DEFAULT 0,
  unlocked_from_week TINYINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS money_hour_shape (
  id           BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord          SMALLINT UNSIGNED NOT NULL,
  day_name     VARCHAR(16) NOT NULL,
  first_forty  TEXT NOT NULL,
  last_twenty  TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS lead_sources (
  id     BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord    SMALLINT UNSIGNED NOT NULL,
  source TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS money_scripts (
  id          BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  code        VARCHAR(8) NOT NULL UNIQUE,
  ord         SMALLINT UNSIGNED NOT NULL,
  channel     ENUM('whatsapp','email','call','message') NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  version     SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  is_original TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS money_refuse (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  item TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS money_month_targets (
  id               BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord              SMALLINT UNSIGNED NOT NULL,
  month_label      VARCHAR(64) NOT NULL,
  target_text      VARCHAR(64) NOT NULL,
  target_low       INT UNSIGNED NOT NULL,
  target_high      INT UNSIGNED NOT NULL,
  what_produces_it TEXT NOT NULL,
  is_total         TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS money_buyback (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  item TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS money_gates (
  code           VARCHAR(4) NOT NULL PRIMARY KEY,
  ord            SMALLINT UNSIGNED NOT NULL,
  gate_date      DATE NOT NULL,
  condition_text TEXT NOT NULL,
  if_it_fails    TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS money_first_hour (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  step TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS money_week_targets (
  week_n      TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  focus       TEXT NOT NULL,
  target_text VARCHAR(64) NOT NULL,
  target_low  INT UNSIGNED NOT NULL,
  target_high INT UNSIGNED NOT NULL,
  CONSTRAINT fk_moneyweek_week FOREIGN KEY (week_n) REFERENCES weeks(n) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==================================================================
-- 8. Reference: the tracking contract
-- ==================================================================

CREATE TABLE IF NOT EXISTS trackers (
  code            VARCHAR(4) NOT NULL PRIMARY KEY,
  ord             SMALLINT UNSIGNED NOT NULL,
  name            VARCHAR(200) NOT NULL,
  written_when    VARCHAR(200) NOT NULL,
  source_of_truth VARCHAR(200) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS done_conditions (
  code      ENUM('DSA','LEARN','BUILD','CLOSE','MONEY','NIGHT') NOT NULL PRIMARY KEY,
  ord       SMALLINT UNSIGNED NOT NULL,
  threshold TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS github_rules (
  id    BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord   SMALLINT UNSIGNED NOT NULL,
  rule  VARCHAR(255) NOT NULL,
  value TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS warning_rules (
  code         VARCHAR(4) NOT NULL PRIMARY KEY,
  ord          SMALLINT UNSIGNED NOT NULL,
  trigger_text TEXT NOT NULL,
  level        ENUM('red','orange') NOT NULL,
  level_text   VARCHAR(32) NOT NULL,
  is_permanent TINYINT(1) NOT NULL DEFAULT 0,
  message      TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS review_questions (
  id       BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord      SMALLINT UNSIGNED NOT NULL,
  question TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS honesty_rules (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  rule TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS export_rules (
  id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord  SMALLINT UNSIGNED NOT NULL,
  rule TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS dead_links (
  id            BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  was           VARCHAR(255) NOT NULL,
  now_url       VARCHAR(255) NOT NULL,
  what_happened TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS tracking_files (
  id                BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  file_name         VARCHAR(64) NOT NULL,
  what_goes_in_it   TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Every level 2 and level 3 section of final.md, verbatim, so the app can render
-- any part of the roadmap without paraphrasing it. Appendix G is never in here.
CREATE TABLE IF NOT EXISTS doc_sections (
  id         BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  ord        SMALLINT UNSIGNED NOT NULL,
  slug       VARCHAR(160) NOT NULL,
  level      TINYINT UNSIGNED NOT NULL,
  part_key   VARCHAR(160) NOT NULL,
  part_title VARCHAR(255) NOT NULL,
  heading    VARCHAR(255) NOT NULL,
  body_md    MEDIUMTEXT NOT NULL,
  start_line INT UNSIGNED NOT NULL,
  end_line   INT UNSIGNED NOT NULL,
  KEY idx_docsection_slug (slug),
  KEY idx_docsection_part (part_key, ord)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Seed provenance, written by the migration runner.
CREATE TABLE IF NOT EXISTS app_meta (
  meta_key   VARCHAR(64) NOT NULL PRIMARY KEY,
  meta_value TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS migrations_applied (
  filename   VARCHAR(160) NOT NULL PRIMARY KEY,
  sha256     CHAR(64) NOT NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ==================================================================
-- 9. User tracking tables
--
-- Every one cascades on user deletion. Every one carries a UNIQUE key on the
-- user plus the reference id so a double click cannot create a second row.
-- ==================================================================

CREATE TABLE IF NOT EXISTS day_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  log_date DATE NOT NULL,
  week_n TINYINT UNSIGNED NULL,
  dsa_solved SMALLINT NOT NULL DEFAULT 0,
  dsa_minutes SMALLINT NOT NULL DEFAULT 0,
  learn_done TINYINT(1) NOT NULL DEFAULT 0,
  learn_minutes SMALLINT NOT NULL DEFAULT 0,
  build_done TINYINT(1) NOT NULL DEFAULT 0,
  build_minutes SMALLINT NOT NULL DEFAULT 0,
  close_done TINYINT(1) NOT NULL DEFAULT 0,
  close_log_line TEXT,
  close_tomorrow_dsa VARCHAR(255),
  close_tomorrow_build VARCHAR(255),
  money_done TINYINT(1) NOT NULL DEFAULT 0,
  money_minutes SMALLINT NOT NULL DEFAULT 0,
  money_touches SMALLINT NOT NULL DEFAULT 0,
  night_anki_done TINYINT(1) NOT NULL DEFAULT 0,
  night_spoken_done TINYINT(1) NOT NULL DEFAULT 0,
  night_spoken_aloud TINYINT(1) NOT NULL DEFAULT 0,
  night_tomorrow_done TINYINT(1) NOT NULL DEFAULT 0,
  anki_overdue SMALLINT NOT NULL DEFAULT 0,
  video_minutes SMALLINT NOT NULL DEFAULT 0,
  pushes SMALLINT NOT NULL DEFAULT 0,
  day_colour ENUM('green','amber','red','neutral') NOT NULL DEFAULT 'red',
  conditions_met TINYINT NOT NULL DEFAULT 0,
  blocked_on TEXT,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_day (user_id, log_date),
  KEY idx_daylog_week (user_id, week_n),
  CONSTRAINT fk_daylog_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS dsa_progress (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  problem_id BIGINT UNSIGNED NOT NULL,
  status ENUM('todo','solved','revisit','failed_twice') NOT NULL DEFAULT 'todo',
  first_solved_at DATETIME NULL,
  last_solved_on DATE NULL,
  times_solved SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  times_failed SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  minutes_spent SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_problem (user_id, problem_id),
  KEY idx_dsaprogress_status (user_id, status),
  CONSTRAINT fk_dsaprogress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_dsaprogress_problem FOREIGN KEY (problem_id) REFERENCES dsa_problems(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Topic level progress, used until a real 474 row CSV has been imported.
CREATE TABLE IF NOT EXISTS dsa_topic_progress (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  topic_id BIGINT UNSIGNED NOT NULL,
  solved SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_topic (user_id, topic_id),
  CONSTRAINT fk_topicprogress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_topicprogress_topic FOREIGN KEY (topic_id) REFERENCES dsa_topics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS week_day_progress (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  week_day_id BIGINT UNSIGNED NOT NULL,
  learn_done TINYINT(1) NOT NULL DEFAULT 0,
  build_done TINYINT(1) NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_weekday (user_id, week_day_id),
  CONSTRAINT fk_wdp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wdp_weekday FOREIGN KEY (week_day_id) REFERENCES week_days(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS resource_progress (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  resource_id BIGINT UNSIGNED NOT NULL,
  status ENUM('todo','reading','done') NOT NULL DEFAULT 'todo',
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  rating TINYINT UNSIGNED NULL,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_resource (user_id, resource_id),
  KEY idx_resprogress_status (user_id, status),
  CONSTRAINT fk_resprogress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_resprogress_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  CONSTRAINT chk_rating CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Week links that have no row in Part 7 still need their own tick state.
-- When a week link does map to a resource the API writes both rows in one
-- transaction, so /weeks and /library can never disagree.
CREATE TABLE IF NOT EXISTS week_link_progress (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  week_link_id BIGINT UNSIGNED NOT NULL,
  status ENUM('todo','reading','done') NOT NULL DEFAULT 'todo',
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_weeklink (user_id, week_link_id),
  CONSTRAINT fk_wlp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wlp_link FOREIGN KEY (week_link_id) REFERENCES week_links(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS study_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  block ENUM('DSA','LEARN','BUILD','CLOSE','MONEY','NIGHT') NOT NULL,
  session_date DATE NOT NULL,
  resource_id BIGINT UNSIGNED NULL,
  week_link_id BIGINT UNSIGNED NULL,
  started_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  source ENUM('timer','manual') NOT NULL DEFAULT 'timer',
  auto_closed TINYINT(1) NOT NULL DEFAULT 0,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_session_user_date (user_id, session_date),
  KEY idx_session_open (user_id, ended_at),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_session_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE SET NULL,
  CONSTRAINT fk_session_link FOREIGN KEY (week_link_id) REFERENCES week_links(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS gate_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  gate_no TINYINT UNSIGNED NOT NULL,
  passed TINYINT(1) NOT NULL DEFAULT 0,
  passed_at DATETIME NULL,
  evidence_url VARCHAR(500) NULL,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_gate (user_id, gate_no),
  CONSTRAINT fk_gateresult_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_gateresult_gate FOREIGN KEY (gate_no) REFERENCES gates(no) ON DELETE CASCADE,
  CONSTRAINT chk_gate_evidence CHECK (passed = 0 OR (evidence_url IS NOT NULL AND CHAR_LENGTH(evidence_url) > 10))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS money_gate_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  money_gate_code VARCHAR(4) NOT NULL,
  passed TINYINT(1) NOT NULL DEFAULT 0,
  passed_at DATETIME NULL,
  amount_received INT UNSIGNED NULL,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_moneygate (user_id, money_gate_code),
  CONSTRAINT fk_mgr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_mgr_gate FOREIGN KEY (money_gate_code) REFERENCES money_gates(code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sunday_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  week_n TINYINT UNSIGNED NOT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  hours DECIMAL(4,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_sunday (user_id, week_n),
  CONSTRAINT fk_sundaylog_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sundaylog_week FOREIGN KEY (week_n) REFERENCES sundays(week_n) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS project_progress (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  status ENUM('not_started','in_progress','shipped','live') NOT NULL DEFAULT 'not_started',
  live_url VARCHAR(500) NULL,
  repo_url VARCHAR(500) NULL,
  readme_done_json JSON NULL,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_project (user_id, project_id),
  CONSTRAINT fk_projprogress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_projprogress_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS github_repos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  kind ENUM('project','tracker','client','other') NOT NULL DEFAULT 'other',
  counts_to_target TINYINT(1) NOT NULL DEFAULT 0,
  project_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_repo (user_id, full_name),
  CONSTRAINT fk_repo_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_repo_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS github_pushes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  repo_id BIGINT UNSIGNED NOT NULL,
  push_date DATE NOT NULL,
  pushed_at DATETIME NOT NULL,
  commit_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  sha_head CHAR(40) NULL,
  message_head VARCHAR(255) NULL,
  source ENUM('api','manual') NOT NULL DEFAULT 'api',
  suspicious TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_push_sha (user_id, repo_id, sha_head),
  KEY idx_push_date (user_id, push_date),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_push_repo FOREIGN KEY (repo_id) REFERENCES github_repos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS github_sync_state (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  resource_key VARCHAR(200) NOT NULL,
  etag VARCHAR(200) NULL,
  last_status SMALLINT UNSIGNED NULL,
  last_run_at DATETIME NULL,
  rate_reset_at DATETIME NULL,
  rate_remaining SMALLINT UNSIGNED NULL,
  mode ENUM('authenticated','anonymous') NOT NULL DEFAULT 'anonymous',
  last_error VARCHAR(500) NULL,
  UNIQUE KEY uq_sync_key (user_id, resource_key),
  CONSTRAINT fk_sync_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS applications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  company VARCHAR(200) NOT NULL,
  role_title VARCHAR(200) NOT NULL,
  role_code VARCHAR(8) NULL,
  source VARCHAR(120) NULL,
  applied_on DATE NOT NULL,
  status ENUM('applied','screen','tech','onsite','offer','rejected','ghosted') NOT NULL DEFAULT 'applied',
  last_update DATE NULL,
  referral TINYINT(1) NOT NULL DEFAULT 0,
  salary_offered VARCHAR(120) NULL,
  jd_url VARCHAR(500) NULL,
  notes TEXT,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_app_user_status (user_id, status),
  KEY idx_app_user_date (user_id, applied_on),
  CONSTRAINT fk_app_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS mock_interviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  held_on DATE NOT NULL,
  platform VARCHAR(120) NOT NULL,
  topic VARCHAR(200) NOT NULL,
  kind ENUM('coding','system_design','case_study','rag_design','behavioural') NOT NULL DEFAULT 'coding',
  score TINYINT UNSIGNED NULL,
  what_broke TEXT,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_mock_user_date (user_id, held_on),
  CONSTRAINT fk_mock_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS writeups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  published_on DATE NOT NULL,
  topic VARCHAR(200) NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_writeup_user_date (user_id, published_on),
  CONSTRAINT fk_writeup_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS leads (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(120) NULL,
  area VARCHAR(120) NULL,
  phone VARCHAR(32) NULL,
  website VARCHAR(500) NULL,
  mobile_broken TINYINT(1) NOT NULL DEFAULT 0,
  rating DECIMAL(3,1) NULL,
  reviews SMALLINT UNSIGNED NULL,
  status ENUM('new','touched','replied','quoted','won','lost','dead') NOT NULL DEFAULT 'new',
  last_touch_on DATE NULL,
  next_touch_on DATE NULL,
  notes TEXT,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_lead_user_status (user_id, status),
  KEY idx_lead_user_due (user_id, next_touch_on),
  CONSTRAINT fk_lead_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS lead_touches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  lead_id BIGINT UNSIGNED NOT NULL,
  touched_on DATE NOT NULL,
  channel ENUM('whatsapp','email','call','walkin','instagram') NOT NULL,
  script_code VARCHAR(8) NULL,
  reply TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_touch_user_date (user_id, touched_on),
  KEY idx_touch_lead (lead_id),
  CONSTRAINT fk_touch_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_touch_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS deals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  lead_id BIGINT UNSIGNED NULL,
  client_name VARCHAR(200) NOT NULL,
  offer_code VARCHAR(8) NOT NULL,
  price INT UNSIGNED NOT NULL,
  advance_amount INT UNSIGNED NULL,
  advance_on DATE NULL,
  delivery_due DATE NULL,
  delivered_on DATE NULL,
  balance_amount INT UNSIGNED NULL,
  balance_on DATE NULL,
  status ENUM('quoted','advance_paid','in_delivery','delivered','paid','refunded','dead') NOT NULL DEFAULT 'quoted',
  referral_asked TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_deal_user_status (user_id, status),
  CONSTRAINT fk_deal_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_deal_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  CONSTRAINT fk_deal_offer FOREIGN KEY (offer_code) REFERENCES offers(code),
  CONSTRAINT chk_deal_delivery CHECK (
    status NOT IN ('in_delivery','delivered','paid')
    OR (advance_on IS NOT NULL AND advance_amount IS NOT NULL AND advance_amount > 0)
  ),
  CONSTRAINT chk_deal_paid CHECK (status <> 'paid' OR balance_on IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS care_plans (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  client_name VARCHAR(200) NOT NULL,
  monthly_amount INT UNSIGNED NOT NULL,
  started_on DATE NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_invoice_on DATE NULL,
  notes TEXT,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_care_user_active (user_id, active),
  CONSTRAINT fk_care_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Editing a script never overwrites the original. Version 1 stays in money_scripts.
CREATE TABLE IF NOT EXISTS money_script_versions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  script_code VARCHAR(8) NOT NULL,
  version SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_script_version (user_id, script_code, version),
  CONSTRAINT fk_scriptver_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_scriptver_script FOREIGN KEY (script_code) REFERENCES money_scripts(code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS nz_progress (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  nz_milestone_id BIGINT UNSIGNED NOT NULL,
  status ENUM('not_started','in_progress','done') NOT NULL DEFAULT 'not_started',
  completed_on DATE NULL,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_nz (user_id, nz_milestone_id),
  CONSTRAINT fk_nzprogress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_nzprogress_milestone FOREIGN KEY (nz_milestone_id) REFERENCES nz_milestones(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS continuation_progress (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  continuation_id BIGINT UNSIGNED NOT NULL,
  done TINYINT(1) NOT NULL DEFAULT 0,
  completed_on DATE NULL,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_continuation (user_id, continuation_id),
  CONSTRAINT fk_contprogress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_contprogress_row FOREIGN KEY (continuation_id) REFERENCES continuation(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- An orange warning can be snoozed for 24 hours, once. Red never.
CREATE TABLE IF NOT EXISTS warning_snoozes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  warning_code VARCHAR(4) NOT NULL,
  snooze_date DATE NOT NULL,
  snoozed_until DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_snooze (user_id, warning_code, snooze_date),
  CONSTRAINT fk_snooze_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_snooze_rule FOREIGN KEY (warning_code) REFERENCES warning_rules(code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS dsa_imports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  source_name VARCHAR(255) NOT NULL,
  rows_read INT UNSIGNED NOT NULL,
  rows_written INT UNSIGNED NOT NULL,
  easy_count SMALLINT UNSIGNED NOT NULL,
  medium_count SMALLINT UNSIGNED NOT NULL,
  hard_count SMALLINT UNSIGNED NOT NULL,
  dry_run TINYINT(1) NOT NULL DEFAULT 1,
  report TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dsaimport_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS link_check_runs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  checked_count INT UNSIGNED NOT NULL DEFAULT 0,
  dead_count INT UNSIGNED NOT NULL DEFAULT 0,
  notes TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS backup_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ran_at DATETIME NOT NULL,
  kind ENUM('dump','export') NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  bytes BIGINT UNSIGNED NULL,
  ok TINYINT(1) NOT NULL DEFAULT 1,
  message VARCHAR(500) NULL,
  KEY idx_backup_ran (ran_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Nothing is ever silently changed.
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  table_name VARCHAR(64) NOT NULL,
  row_pk VARCHAR(120) NOT NULL,
  action ENUM('insert','update','soft_delete','restore') NOT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_user_at (user_id, at),
  KEY idx_audit_table (table_name, row_pk),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==================================================================
-- 10. Integrity enforced in SQL, not only in the API
--
-- Part 18.7 rule 3: retroactive editing is limited to 7 days. The session time
-- zone is set to +05:30 by the connection pool, so CURDATE() is Asia/Kolkata.
-- ==================================================================

DROP TRIGGER IF EXISTS trg_day_logs_no_backdate_ins;
CREATE TRIGGER trg_day_logs_no_backdate_ins
BEFORE INSERT ON day_logs FOR EACH ROW
BEGIN
  IF NEW.log_date < DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Retroactive editing is limited to 7 days. History is not rewritten.';
  END IF;
  IF NEW.log_date > CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A day cannot be logged before it happens.';
  END IF;
END;

DROP TRIGGER IF EXISTS trg_day_logs_no_backdate_upd;
CREATE TRIGGER trg_day_logs_no_backdate_upd
BEFORE UPDATE ON day_logs FOR EACH ROW
BEGIN
  IF OLD.log_date < DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Retroactive editing is limited to 7 days. History is not rewritten.';
  END IF;
END;

DROP TRIGGER IF EXISTS trg_gate_results_evidence;
CREATE TRIGGER trg_gate_results_evidence
BEFORE UPDATE ON gate_results FOR EACH ROW
BEGIN
  IF NEW.passed = 1 AND (NEW.evidence_url IS NULL OR NEW.evidence_url NOT LIKE 'http%://%.%') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A gate is passed only with an evidence URL. A screenshot is not evidence, a live URL is.';
  END IF;
END;

DROP TRIGGER IF EXISTS trg_gate_results_evidence_ins;
CREATE TRIGGER trg_gate_results_evidence_ins
BEFORE INSERT ON gate_results FOR EACH ROW
BEGIN
  IF NEW.passed = 1 AND (NEW.evidence_url IS NULL OR NEW.evidence_url NOT LIKE 'http%://%.%') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A gate is passed only with an evidence URL. A screenshot is not evidence, a live URL is.';
  END IF;
END;

-- Part 17.1 rule 1: the money hour never borrows from study.
-- MONEY may not start before 16:30. A study block may not start inside 17:00 to 18:00.
DROP TRIGGER IF EXISTS trg_session_block_windows;
CREATE TRIGGER trg_session_block_windows
BEFORE INSERT ON study_sessions FOR EACH ROW
BEGIN
  IF NEW.block = 'MONEY' AND TIME(NEW.started_at) < '16:30:00' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'The money hour never borrows from study. If client work overruns, the client waits two days.';
  END IF;
  IF NEW.block IN ('DSA','LEARN','BUILD','CLOSE')
     AND TIME(NEW.started_at) >= '17:00:00' AND TIME(NEW.started_at) < '18:00:00' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A study block cannot be logged inside the money hour, 17:00 to 18:00.';
  END IF;
END;
