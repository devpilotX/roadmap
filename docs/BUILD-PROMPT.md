# BUILD PROMPT | The Roadmap Tracker

**Read this entire file before writing one line of code. Then read `final.md` entirely, top to bottom, before writing one line of code. Do not skim either file. Do not summarise them. Do not sample them.**

Paste this whole file into your coding agent (Claude Code, Cursor, Codex, Windsurf) together with `final.md`. This prompt is the single source of truth for the application. `final.md` is the single source of truth for the content. Where the two ever disagree about content, `final.md` wins. Where they disagree about how the app is built, this file wins.

---

## 0. Role, objective, and the one sentence that matters

You are a senior full stack engineer with fifteen years of production experience. You are building a personal career tracker that one person will open every single morning for five months and then keep using for three more years.

**The one sentence: this application is the only instrument measuring whether a person gets out of two years of unemployment, so a silently broken checkbox is worse than a missing feature.**

Primary user: Dipanshu Kumar, Patna, India, timezone Asia/Kolkata. The app supports multiple accounts but is designed around one person using it daily.

The roadmap window is Friday 28 August 2026 to Sunday 24 January 2027. 150 days. 21 weeks. 4 gates. 474 DSA problems. 4 projects. One extra money hour a day. Everything in `final.md` becomes data in this app. Nothing in `final.md` gets summarised, truncated, paraphrased or skipped. If a table there has 21 rows, the database gets 21 rows.

---

## 1. Inputs you are given, and the reading protocol

| Input | What it is | What you do with it |
| --- | --- | --- |
| `final.md` | The roadmap. Parts 0 to 18, Appendices A to F | Parse it into seed data. Every part becomes a screen or a table |
| This file | The build specification | Follow it exactly, in the order given |

**Reading protocol, do this first and report before coding.**

1. Read `final.md` end to end.
2. Produce `/docs/PARSE-REPORT.md` listing, for every part and appendix: what tables it maps to, and the exact row count you extracted.
3. Compare your counts against Appendix E of `final.md`. Any mismatch is a hard stop. Fix the parser, not the expectation. Appendix G is a verification log, not seed data: never parse or seed it, and its presence must not change a single Appendix E count. Render it read only on `/reference` under a heading called Verification log. Part 19 is parsed in full: it is the source for `roles_early`, `eligibility_weeks`, `eligibility_dsa`, `fast_exits` and `skill_combos`, and it drives the `/eligibility` screen.
4. Only then start section 3 of this file.

---

## 2. Hard constraints, non negotiable

| Layer | Technology | Notes |
| --- | --- | --- |
| Markup | HTML5, semantic, server rendered shell | EJS for layout includes only |
| Styles | CSS3, hand written | No Tailwind, no Bootstrap, no CSS framework. CSS custom properties for all tokens |
| Client script | Vanilla JavaScript, ES2022 modules | No React, no Vue, no Svelte, no jQuery, no bundler, no transpiler, no build step |
| Server | Node.js 24 LTS, Express 5 | All business logic, all SQL, all auth |
| Database | MySQL 8.4 | InnoDB, `utf8mb4`, `utf8mb4_0900_ai_ci` |
| Driver | `mysql2/promise` | Connection pool. Parameterised queries only, always |
| Auth | Manual email and password | No OAuth, no Google sign in, no magic links, no Auth0, no Firebase |
| Hashing | Argon2id via `argon2` | `memoryCost: 19456, timeCost: 2, parallelism: 1`, the OWASP parameters |
| Sessions | `express-session` + `express-mysql-session` | `httpOnly`, `sameSite: lax`, `secure` in production |
| Validation | `zod` on every request body and every query string | Reject at the boundary, never inside a handler |
| Migrations | Numbered plain `.sql` files in `/migrations` | `001_init.sql`, `002_seed_reference.sql`, `003_seed_calendar.sql` |
| Charts | Hand written SVG or `<canvas>` | No Chart.js, no D3, no chart CDN |
| Icons | Inline SVG in the markup | No icon font, no CDN, no sprite service |
| Fonts | System font stack, self hosted only if added | No Google Fonts, no external font CDN |

No TypeScript. No ORM. No Prisma, no Sequelize, no Knex. Raw parameterised SQL. No external CDN of any kind, the app must run with the VPS firewalled off from everything except GitHub.

### 2.1 Decisions already made, do not reopen

- **Why MySQL and not PostgreSQL.** PostgreSQL 18 on this machine is the learning and project database. The tracker deliberately runs on a separate engine so that a mistake made while studying Postgres cannot take down the thing that measures the studying. Do not "improve" this.
- **Why no framework.** The user is learning JavaScript from the language up, in the same window this app is used. Every line must be readable by someone in Week 3 of the roadmap.
- **Why no OAuth.** Week 11 of the roadmap is hand written authentication. This app is the reference implementation the user will read.
- **Why no AI features inside the tracker.** The user already lives inside AI tooling. This app is the one surface that only reports facts.

---

## 3. Architecture and repository layout

A browser cannot connect to MySQL. There is no TCP socket in the browser sandbox and no MySQL protocol. Any tutorial suggesting otherwise is wrong, and database credentials in client JavaScript would be visible to anyone who opens DevTools. Three tiers, exactly:

```
Browser  (HTML + CSS + vanilla ES modules)
   |  fetch() to JSON endpoints, same origin, cookie session
   v
Node.js 24 + Express 5   (all logic, all auth, all SQL)
   |  mysql2/promise pool
   v
MySQL 8.4
```

Express serves the static files too, so there is one origin and no CORS.

```
/roadmap-tracker
  /migrations        001_init.sql, 002_seed_reference.sql, 003_seed_calendar.sql, 004_seed_money.sql
  /scripts           seed-from-md.mjs, verify-seed.mjs, check-links.mjs, sync-github.mjs,
                     import-dsa.mjs, backup.sh, export-all.mjs
  /src
    server.mjs       app bootstrap, helmet, session, static, routes, error handler
    /db              pool.mjs, queries organised one file per domain
    /routes          api/*.mjs and pages/*.mjs
    /middleware      requireAuth.mjs, csrf.mjs, rateLimit.mjs, validate.mjs
    /lib             dates.mjs, streaks.mjs, warnings.mjs, github.mjs, money.mjs
  /public
    /css             tokens.css, base.css, layout.css, components.css, screens/*.css
    /js              api.mjs, ui.mjs, toast.mjs, timer.mjs, screens/*.mjs, sw.js
    /img
  /views             layout.ejs, partials/*.ejs, screens/*.ejs
  /docs              PARSE-REPORT.md, ADDITIONS.md, RUNBOOK.md
  /data              final.md (the roadmap, committed)
  .env.example  docker-compose.yml  Dockerfile  README.md
```

---

## 4. Database schema

InnoDB, `utf8mb4`. Every user owned foreign key is `ON DELETE CASCADE`. Every table gets `created_at` and, where it can change, `updated_at`.

### 4.1 Auth and profile

```sql
CREATE TABLE users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(120) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE profiles (
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
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires    INT UNSIGNED NOT NULL,
  data       MEDIUMTEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

`github_token` is encrypted at rest with AES-256-GCM using a key from `.env`. It is never returned by any API response, not even masked. It is write only from the client's point of view.

### 4.2 Reference tables, seeded from `final.md`, read only in the UI

| Table | Columns | Source in final.md |
| --- | --- | --- |
| `phases` | `code PK, name, week_from, week_to, blurb` | Part 3, Phases, 6 rows |
| `weeks` | `n PK, start_date, end_date, title, phase_code FK, focus TEXT, dsa_target, dsa_cumulative, gate_no NULL` | Part 3 and Part 4, 21 rows |
| `week_days` | `id PK, week_n FK, day_name, day_order, learn_task TEXT, build_task TEXT, dsa_day_target` | Part 4 six day tables plus Part 18.3, 126 rows |
| `calendar_days` | `cal_date PK, week_n NULL, day_label, kind ENUM('launch','study','sunday_working','sunday_gate','sunday_rest'), dsa_target, learn_task TEXT, build_task TEXT, money_task TEXT` | Appendix C, 150 rows |
| `week_links` | `id PK, week_n FK, url, label` | Part 4, links for each week, 120 rows |
| `week_ships` | `id PK, week_n FK, ord, text` | Part 4, ships at the end of this week |
| `week_traps` | `id PK, week_n FK, text` | Part 4, the trap |
| `week_notes` | `id PK, week_n FK, text` | Part 4, note |
| `gates` | `no PK, week_n FK, gate_date, condition_text` | The four gates, 4 rows |
| `money_gates` | `code PK, gate_date, condition_text, if_it_fails TEXT` | Part 17.12, 4 rows |
| `sundays` | `week_n PK, sunday_date, kind ENUM('working','gate','rest'), topic` | Part 3, 21 rows |
| `projects` | `id PK, code, name, repo, week_from, week_to, description TEXT` | Part 5, 4 rows |
| `readme_sections` | `id PK, ord, title` | Part 5, 9 rows |
| `resource_categories` | `no PK, name` | Part 7, 20 rows |
| `resources` | `id PK, category_no FK, url, why TEXT, cost, is_alive TINYINT DEFAULT 1, last_checked DATE` | Part 7, every row of all 20 tables |
| `dsa_topics` | `id PK, ord, name` | Striver A2Z topic list |
| `dsa_problems` | `id PK, topic_id FK, ord, name, difficulty ENUM('Easy','Medium','Hard'), url` | 474 rows: 152 Easy, 186 Medium, 136 Hard, imported by CSV, see 9.3 |
| `dsa_thresholds` | `id PK, cumulative, reached_label, unlocks TEXT` | Part 13 |
| `roles` | `code PK, name, entry_band, ceiling, verdict TEXT, what_they_test TEXT, which_project TEXT, rank_order` | Part 12, 7 rows |
| `role_unlocks` | `id PK, ord, milestone, unlock_date, roles_csv, verdict` | Part 13 |
| `skills` | `id PK, name, roles_csv, where_built` | Part 12 skill matrix, 25 rows |
| `stack_versions` | `id PK, tech, version, status, why TEXT` | Part 6, 18 rows |
| `breaks` | `id PK, if_you_do TEXT, what_happens TEXT` | Part 6, 11 rows |
| `corrections` | `id PK, code, was_wrong TEXT, actually_true TEXT, source, fix TEXT` | Part 0, 25 rows |
| `skip_list` | `id PK, item TEXT` | Part 14 |
| `do_not_buy` | `id PK, item TEXT` | Part 14 |
| `costs` | `id PK, item, cost, note TEXT` | Part 14, 4 rows |
| `dead_links` | `id PK, was, now_url, what_happened` | Appendix A, 7 rows |
| `nz_costs` | `id PK, item, cost_rupees, basis, sort_order` | Part 16, What the move actually costs, 8 rows including the total |
| `nz_salary` | `id PK, gross_nzd, gross_rupees, effective_tax_pct, net_nzd, net_rupees` | Part 16, What the salary is actually worth, 3 rows |
| `nz_projection` | `id PK, years_after_landing, real_age, accumulated_rupees` | Part 16, Where the crores actually come from, 5 rows |
| `roles_early` | `id PK, code UNIQUE, role, earliest_week, earliest_date, band_low_lakh, band_high_lakh, verdict` | Part 19.2, 9 rows |
| `eligibility_weeks` | `id PK, week_key UNIQUE, reached_date, dsa_total, newly_holds, newly_eligible_codes JSON, band, apply_verdict, is_advised BOOL` | Part 19.3, 22 rows including the LAUNCH row |
| `eligibility_dsa` | `id PK, problems UNIQUE, reached_about, gets_you_past, does_not_open` | Part 19.4, 13 rows |
| `fast_exits` | `id PK, exit_no UNIQUE, exit_date, roles_available, band, what_you_give_up, verdict` | Part 19.5, 4 rows |
| `skill_combos` | `id PK, sort_order UNIQUE, stack_held, dsa_needed, roles_unlocked_codes JSON, band, interview_you_face` | Part 19.6, 8 rows |
| `continuation` | `id PK, ord, branch, period, age_label, goal TEXT, detail TEXT` | Part 15 |
| `nz_milestones` | `id PK, ord, milestone_date, age_label, milestone TEXT` | Part 16 timeline |
| `nz_facts` | `id PK, label, value, caveat TEXT` | Part 16 wage and salary tables |
| `offers` | `code PK, name, scope TEXT, delivery, price_low, price_high, unlocked_from_week` | Part 17.4, 8 rows |
| `money_week_targets` | `week_n PK, focus TEXT, target_low, target_high` | Part 17.14, 21 rows |
| `money_scripts` | `id PK, code, channel, title, body TEXT` | Part 17.7, every script verbatim |
| `trackers` | `code PK, name, written_when, source_of_truth` | Part 18.1, 9 rows |
| `warning_rules` | `code PK, trigger_text, level ENUM('red','orange'), message TEXT` | Part 18.5, 10 rows |

### 4.3 User tracking tables, writable

```sql
CREATE TABLE day_logs (
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
  money_done TINYINT(1) NOT NULL DEFAULT 0,
  money_minutes SMALLINT NOT NULL DEFAULT 0,
  money_touches SMALLINT NOT NULL DEFAULT 0,
  night_anki_done TINYINT(1) NOT NULL DEFAULT 0,
  night_spoken_done TINYINT(1) NOT NULL DEFAULT 0,
  night_spoken_aloud TINYINT(1) NOT NULL DEFAULT 0,
  night_tomorrow_done TINYINT(1) NOT NULL DEFAULT 0,
  video_minutes SMALLINT NOT NULL DEFAULT 0,
  pushes SMALLINT NOT NULL DEFAULT 0,
  day_colour ENUM('green','amber','red','neutral') NOT NULL DEFAULT 'red',
  blocked_on TEXT,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_day (user_id, log_date),
  CONSTRAINT fk_daylog_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

`day_colour` is computed server side on every write using the rules in section 12.2. It is never sent by the client.

Remaining user tables, same pattern, each with a `UNIQUE` key on user plus the reference id:

| Table | Key columns | Purpose |
| --- | --- | --- |
| `dsa_progress` | `user_id, problem_id`, `status ENUM('todo','solved','revisit','failed_twice')`, `first_solved_at`, `times_solved`, `minutes_spent`, `notes` | Per problem state. `failed_twice` drives the Today panel |
| `week_day_progress` | `user_id, week_day_id`, `learn_done`, `build_done`, `completed_at` | The 126 day level checkboxes |
| `resource_progress` | `user_id, resource_id`, `status ENUM('todo','reading','done')`, `started_at`, `completed_at`, `minutes`, `rating`, `notes` | Every link in Part 7 individually tickable |
| `study_sessions` | `user_id, block ENUM('DSA','LEARN','BUILD','CLOSE','MONEY','NIGHT')`, `resource_id NULL`, `started_at`, `ended_at`, `minutes`, `source ENUM('timer','manual')` | Written by the timer in section 8 |
| `gate_results` | `user_id, gate_no`, `passed`, `passed_at`, `evidence_url`, `notes` | Cannot pass without `evidence_url` |
| `money_gate_results` | `user_id, money_gate_code`, `passed`, `passed_at`, `amount_received`, `notes` | Part 17.12 |
| `sunday_logs` | `user_id, week_n`, `completed`, `hours`, `notes` | 21 Sundays |
| `project_progress` | `user_id, project_id`, `status`, `live_url`, `repo_url`, `readme_done_json JSON`, `notes` | 9 README sections per project |
| `github_repos` | `user_id, full_name`, `kind ENUM('project','tracker','client','other')`, `counts_to_target TINYINT` | Which repos count, section 10 |
| `github_pushes` | `user_id, repo_id, pushed_at, commit_count, sha_head, message_head, source ENUM('api','manual')` | The push log |
| `applications` | `user_id, company, role_title, role_code, source, applied_on, status ENUM('applied','screen','tech','onsite','offer','rejected','ghosted'), last_update, referral, salary_offered, jd_url, notes` | Gate 4 counter reads this |
| `mock_interviews` | `user_id, held_on, platform, topic, score, what_broke TEXT` | Two a week from February |
| `writeups` | `user_id, title, url, published_on, topic` | Public writing log |
| `leads` | `user_id, name, category, area, phone, website, mobile_broken, rating, reviews, status ENUM('new','touched','replied','quoted','won','lost','dead'), last_touch_on, next_touch_on, notes` | Part 17.6, the pipeline |
| `lead_touches` | `user_id, lead_id, touched_on, channel ENUM('whatsapp','email','call','walkin','instagram'), script_code, reply TINYINT, notes` | Every single touch, this is the number that predicts income |
| `deals` | `user_id, lead_id NULL, client_name, offer_code, price, advance_amount, advance_on, delivery_due, delivered_on, balance_amount, balance_on, status ENUM('quoted','advance_paid','in_delivery','delivered','paid','refunded','dead'), referral_asked, notes` | Money jobs |
| `care_plans` | `user_id, client_name, monthly_amount, started_on, active, last_invoice_on, notes` | The recurring floor |
| `nz_progress` | `user_id, nz_milestone_id`, `status`, `completed_on`, `notes` | Part 16 tracker |
| `audit_log` | `user_id, table_name, row_pk, action, before_json, after_json, at` | Nothing is ever silently changed |

---

## 5. Authentication specification

1. **Signup** `POST /api/auth/signup`. Fields: email, password, display_name. Password minimum 12 characters, checked against a small local common password blocklist file. Hash with Argon2id at the parameters in section 2. Create the `profiles` row in the same transaction. Return 201 and start the session.
2. **Login** `POST /api/auth/login`. Verify with `argon2.verify`. On failure return a generic `Invalid email or password` with HTTP 401. Never reveal whether the email exists. Always run a dummy verify on unknown emails so the timing does not leak.
3. **Rate limit** login and signup with `express-rate-limit`: 5 attempts per 15 minutes per IP and per email.
4. **Logout** `POST /api/auth/logout`, destroy the session server side.
5. **Session** rolling 30 days, regenerate the session id on login to prevent fixation.
6. **CSRF** double submit cookie token on every state changing request.
7. **Middleware** `requireAuth` on every `/api/*` route except auth routes. Unauthenticated HTML routes redirect to `/login`.
8. **Headers** via `helmet`, with a strict CSP and no `unsafe-inline`. All JavaScript in external `.js` files, all CSS in external `.css` files.
9. **Password change** requires the current password. Changing it destroys all other sessions for that user.

---

## 6. Screens

Nineteen routes. Every screen is a server rendered HTML shell plus vanilla JS that fetches JSON. Every checkbox writes immediately with optimistic UI, rolls back on failure, and shows a toast on failure. No screen may ever show a spinner for longer than 400 ms on local data.

| Route | Screen | Must contain |
| --- | --- | --- |
| `/signup`, `/login` | Auth | Single centred card, password strength meter, no social buttons |
| `/` | **Today** | Full spec in section 7 |
| `/calendar` | **Calendar** | Full spec in section 8 |
| `/weeks` | 21 week grid | 21 cards in 6 phase colour groups: week number, dates, title, DSA cumulative, percent complete, gate badge |
| `/weeks/:n` | Week detail | Focus, Learn list, Build list, the six day table with per day checkboxes, Ships, The trap, Note, every link for that week with status toggle and an Open and start button |
| `/dsa` | DSA tracker | All 474 problems grouped by topic. Filters: difficulty, status, topic. Cumulative line chart against the target curve from `weeks.dsa_cumulative`. Big number: solved of 474. A dedicated Failed twice panel |
| `/library` | Resource library | All 20 categories, every link. Filters: category, week, cost, status. Each row opens in a new tab, marks reading or done, takes notes. Link health badge from `resources.is_alive` and `last_checked` |
| `/projects` | Projects | 4 project cards: status, live URL, repo URL, the 9 README sections as a checklist, weeks spanned, pushes to that repo this week |
| `/gates` | Gates | 4 gate cards plus the 4 money gates: date, condition, days remaining, pass toggle that refuses to save without evidence |
| `/sundays` | Sundays | 21 rows: working, gate audit, or rest. Working Sundays show topic and hours |
| `/pushes` | **GitHub** | Full spec in section 10 |
| `/money` | **Money hour** | Full spec in section 11 |
| `/applications` | Applications | Kanban with the 7 status columns. Add form. Funnel counts. A prominent counter: applied of 100 for Gate 4, and of 200 to 400 for the realistic target. Red banner if today is on or after 13 Dec 2026 and the count is 0 |
| `/ladder` | Unlock ladder | Part 13 rendered live, each milestone locked or unlocked from real progress, the DSA threshold table with the current position marked, and a permanent callout: DSA alone unlocks no role |
| `/roles` | The seven roles | 7 ranked role cards with entry band, ceiling, verdict, what they test, which project carries it. The 25 row skill matrix with a have or not have column derived from completed weeks |
| `/eligibility` | **Eligibility, what can I apply for today** | Part 19, rendered live and computed, never static. Header: one large sentence reading You are eligible for N of 16 roles today, where N is computed from the real solved count in `dsa` and the real completed weeks in `week_days`, never stored. Panel 1, Eligible now: role chips drawn from `roles_early` and `roles` where the unlock condition is met, each chip showing code, role, band, and a green or red Advised badge taken from `eligibility_weeks.is_advised` for the current week. Panel 2, Next unlock: the first row of `eligibility_weeks` not yet reached, phrased as Solve N more problems and finish Week W, with both numbers computed. Panel 3, the `eligibility_dsa` ladder with the current position marked and a permanent callout reading No number in this table unlocks a single role. Below the panels, the `skill_combos` table with the row matching the current stack highlighted, and the `fast_exits` table where every exit dated before 13 Dec 2026 sits under a red heading reading This costs you money, followed by the rupee cost from its verdict column. A banner sits at the top until 13 Dec 2026 reading Eligible is not a reason to apply. Eligible plus advised is. On 13 Dec 2026 that banner turns green and reads Applications start today |
| `/after` | After Jan 2027 | Part 15: three branches, the employed weekday shape, year one two three targets as checklists |
| `/newzealand` | New Zealand | Part 16: Tier 1 requirements, wage thresholds, salary table, the three corrections, the dated timeline as a tracker showing both the ID age and the real age columns, the move cost table from `nz_costs` with the total rendered as a large single figure and the Active Investor Plus comparison placed directly beside it so the 320 times gap is visible without scrolling, the net salary table from `nz_salary`, the wealth projection from `nz_projection` under a label that reads Projection, not promise, the fallback, and the What I could not verify block rendered verbatim |
| `/reference` | Reference | 25 corrections, 18 stack versions, 11 breaks, skip list, do not buy, costs, 7 dead links |
| `/everything` | **A to Z** | Full spec in section 13 |
| `/stats` | Stats | Hours by block by week, DSA actual against plan, streak history, completion percent by phase, application funnel conversion, money received by month, video minutes against the 30 minute cap |
| `/profile` | Profile | Avatar upload, name, phone, city, GitHub username and token, LinkedIn, portfolio, three site URLs, UPI id, target role, timezone, change password. Every URL rendered as a working clickable link with an icon |

---

## 7. The Today screen, in exact detail

This is the screen that gets opened 150 times. It must load in under 300 ms and it must answer one question without scrolling: **what do I do right now.**

**Header strip.** Today's date in `Friday, 28 August 2026` form, the week number and title, the phase letter and name, days remaining to the next gate, days remaining to 24 January 2027, and the current streak.

**The now card.** Based on the server clock in Asia/Kolkata, one block is the current block. It renders larger than everything else with the exact task text from `calendar_days` for today:

| Block | Window | Card content |
| --- | --- | --- |
| DSA | 06:30 to 09:00 | Today's DSA target from `week_days.dsa_day_target`, solved so far, a plus one control, and the next unsolved problem in topic order with an Open and start button |
| LEARN | 09:30 to 12:30 | Today's `learn_task` verbatim, the week's links as Open and start buttons, a done toggle, and minutes logged |
| BUILD | 14:00 to 16:00 | Today's `build_task` verbatim, the active project with its repo, pushes today, a done toggle, minutes logged |
| CLOSE | 16:00 to 16:30 | Three inputs: one log line, tomorrow's first DSA problem, tomorrow's first build task. Cannot be marked done with empty fields |
| MONEY | 17:00 to 18:00 | Today's `money_task` verbatim, touches today against the daily target, quick add touch, the next 15 leads due, and money received this week |
| NIGHT | after 21:00 | Anki zero overdue toggle, spoken explanation toggle with an aloud checkbox, tomorrow decided toggle |

Blocks that are not current render as compact rows above and below the now card. Past blocks that are incomplete render with an orange left border. Nothing is hidden.

**Right rail.** Six condition checklist for a green day, the day colour as it currently stands, the failed twice panel, active warnings from section 12.3, and yesterday's one line summary.

**Rules.**

- Outside all block windows the now card shows the next block and a countdown to it.
- On a rest Sunday the whole screen replaces itself with the rest Sunday card: no code, no screens before noon, this is load bearing. Nothing is tickable except the money row, which is also rest.
- On a gate audit Sunday the gate card takes the now position.
- Every task string comes from the database, never from a hardcoded string in a template.

---

## 8. The Calendar screen, and the click that starts studying

**This is a headline feature, not a nice to have.** The user asked for a calendar where every day's plan and every resource is one click away.

**Month grid.** Six columns of study days plus a distinct Sunday column, Monday first. Each cell shows: the date, the week badge, the DSA target, a colour dot for the day colour, and a small push icon if there was a push. Launch days, gate Sundays, working Sundays and rest Sundays each get a distinct treatment. Today has a permanent ring. Future days are readable, not greyed into invisibility.

**Day drawer.** Clicking any cell opens a right side drawer, not a new page, containing:

1. The full LEARN task, verbatim from `calendar_days`.
2. The full BUILD task, verbatim.
3. The money task, verbatim.
4. The DSA target for that day and how many were actually solved.
5. Every link for that week, each with three controls: **Open and start**, mark reading, mark done.
6. The log line, blockers and notes for that day, editable inside the 7 day window.
7. Pushes recorded on that date, with repository and commit count.

**Open and start behaviour, exactly.**

1. Opens the URL in a new tab with `target="_blank" rel="noopener noreferrer"`.
2. Sets that resource to `reading` if it was `todo`.
3. Starts a study session in the block that owns the current time, or the block the user picked in the drawer.
4. Shows a persistent, small timer chip in the corner of the tracker tab with the block name, elapsed minutes, and a stop button.
5. On stop, writes `study_sessions` and adds the minutes to the right column of `day_logs`.
6. If the tab is closed without stopping, the session is closed server side at the end of the block window and flagged `source='timer'` with an `auto_closed` note. Never silently inflate minutes.

**Also required.**

- Week strip view and a single day view, switchable, state remembered per user.
- Keyboard: left and right arrows move day, `t` jumps to today, `Esc` closes the drawer.
- `GET /api/calendar.ics` exports the whole 150 days as an ICS file with the five daily blocks as events in Asia/Kolkata, so it can be subscribed to from a phone.
- A print stylesheet that prints one clean week per page.

---

## 9. Seeding

### 9.1 The parser

Write `/scripts/seed-from-md.mjs`. It reads `/data/final.md` and emits SQL into `/migrations/002_seed_reference.sql`, `003_seed_calendar.sql` and `004_seed_money.sql`. It is deterministic: running it twice on the same input produces byte identical output.

Rules for the parser:

- Parse the Markdown tables structurally. Do not hardcode content in the script.
- Preserve text exactly, including escaped pipes, which unescape to `|`.
- Appendix C is the source for `calendar_days`. Part 4 is the source for `week_days`. They must agree. If they do not, fail loudly with the offending dates.
- Never invent a row. If something cannot be parsed, fail loudly and print the line number.

### 9.2 Acceptance counts, verified by `/scripts/verify-seed.mjs`, exit code 1 on any mismatch

| Table | Expected rows |
| --- | --- |
| `phases` | 6 |
| `weeks` | 21 |
| `week_days` | 126 |
| `calendar_days` | 150 |
| `week_links` | 120 |
| `gates` | 4 |
| `money_gates` | 4 |
| `sundays` | 21 |
| `projects` | 4 |
| `readme_sections` | 9 |
| `resource_categories` | 20 |
| `roles` | 7 |
| `skills` | 25 |
| `stack_versions` | 18 |
| `breaks` | 11 |
| `corrections` | 25 |
| `dead_links` | 7 |
| `roles_early` | 9 |
| `eligibility_weeks` | 22 |
| `eligibility_dsa` | 13 |
| `fast_exits` | 4 |
| `skill_combos` | 8 |
| `costs` | 4 |
| `offers` | 8 |
| `money_week_targets` | 21 |
| `trackers` | 9 |
| `warning_rules` | 10 |
| `dsa_problems` | 474 after CSV import: 152 Easy, 186 Medium, 136 Hard |

Also assert: `calendar_days` starts 2026-08-28 and ends 2027-01-24, the dates are contiguous with no gaps, and it contains exactly 3 launch rows, 126 study rows and 21 Sunday rows. The sum of `dsa_target` across the 126 study rows is exactly **415**, the 3 launch rows sum to **6**, the 21 Sunday rows sum to **0**, and the whole table sums to **421**. Any other number means the parser is wrong.

### 9.3 DSA problems

`final.md` does not contain all 474 problem names. Seed `dsa_topics` from the topic list and provide `/scripts/import-dsa.mjs` that accepts a CSV export from the Striver A2Z tracker or Codolio, with a documented column mapping and a dry run mode. Until it runs, `/dsa` shows topic level progress and a visible notice that problem level import is pending. **Do not invent problem names, ever.**

### 9.4 Link health

`/scripts/check-links.mjs` runs nightly, issues a `HEAD` request to every row in `resources` and `week_links`, follows redirects, and updates `is_alive` and `last_checked`. 4xx or 5xx shows a red badge. **Never delete a dead link, flag it**, and cross reference `dead_links` for the known replacement. Respect a 1 request per second rate and a 10 second timeout.

---

## 10. GitHub push tracking

The rules are in Part 18.4 of `final.md`. Implement them exactly.

**Sync.** `/scripts/sync-github.mjs` runs every 30 minutes by cron and on demand from `/pushes`.

- With a token stored in `profiles.github_token`, use the authenticated REST API. Read `GET /users/{user}/events` and, for each tracked repository, `GET /repos/{owner}/{repo}/commits?since=`.
- Without a token, fall back to unauthenticated requests, which are limited to 60 per hour per IP against 5,000 per hour authenticated. Show the user which mode is active and what it costs them.
- The events endpoint only returns recent activity, roughly the last 90 days and 300 events, so the commits endpoint per tracked repo is the source of truth for history, and events are only used for freshness.
- Handle 403 with `x-ratelimit-remaining: 0` by backing off until `x-ratelimit-reset`, and surface a clear banner. Never hammer the API.
- Store `ETag` values and send `If-None-Match` so unchanged responses cost nothing.
- Manual entry always exists as a fallback: date, repository, commit count, one line.

**Screen `/pushes`.**

- A 150 day contribution grid built from `github_pushes`, coloured by commit count, with today's cell outlined.
- Per repository rows for the five repositories that count, plus a separate collapsed section for client repositories which never count towards the target.
- Current run of consecutive push days, longest run, and hours since the last push, prominently.
- Week view: pushes this week against the target of 6.
- Red banner at 48 hours with no push on a study week. Streak cancelled at 72 hours, stated plainly with the timestamp of the last push.
- Week 1 special case: a commit counter on the utility repository against the target of 15.
- A visible line: empty commits, backdated commits and padding are not tracked and not welcome. If the sync detects more than 20 commits in a single push with no file changes, flag it rather than count it.

---

## 11. The money hour screen

Part 17 of `final.md` is the source. This screen has one job: make it impossible to end a day without knowing whether the touches happened.

**Top strip.** Rupees received this month against the Part 17.10 target band. Rupees received in total against the Rs 90,000 target. Active care plans and their monthly total. Days since the last touch. Days since the last rupee.

**Pipeline board.** Columns matching the `leads.status` enum: new, touched, replied, quoted, won, lost, dead. Drag or a status select, both work. Each card shows name, category, area, phone as a `tel:` link, WhatsApp as a `https://wa.me/` link, the website with a broken on mobile flag, rating and reviews.

**Today's 15.** The screen picks the next 15 leads by `next_touch_on` then by never touched, and shows them as a checklist. Ticking one opens the script picker, copies the chosen script from `money_scripts` with the business name substituted, and writes a `lead_touches` row. One tap per lead, not a form.

**Scripts panel.** Every script from Part 17.7, verbatim, with a copy button and a `{{business}}` and `{{price}}` substitution. Editing a script creates a new version, it never overwrites the original.

**Deals.** Table of `deals` with offer code, price, advance, delivery due date with a countdown, balance, and status. A deal cannot move to `in_delivery` without an advance date and amount. A deal cannot move to `paid` without a balance date. Overdue deliveries turn red.

**Offers.** The 8 rows of Part 17.4 with their price bands. O7 renders locked with the reason until week 17 is reached, and the lock is enforced server side when creating a deal.

**Weekly plan.** The 21 rows of Part 17.14, with the current week highlighted and actual received against the band.

**Money gates.** The four rows of Part 17.12 with pass or fail state and the if it fails text shown when the date has passed and the condition is unmet.

**Charts.** Touches per week as bars. Rupees received per month as bars against the target band. Reply rate and win rate as plain percentages with the raw counts next to them, never a percentage alone.

---

## 12. Rules enforced in code, not in the UI only

### 12.1 Dates and time

- All dates are `DATE` columns holding calendar dates, never timestamps.
- "Today" is computed server side in Asia/Kolkata. Never trust the client clock for anything that writes.
- India has no daylight saving, but never rely on that in code. Use a single `lib/dates.mjs` with `todayInTz()`, `blockForNow()`, `weekForDate()`, and unit tests for the boundaries 2026-08-28, 2026-08-31, 2026-12-31, 2027-01-24.

### 12.2 Day colour and streaks

- Six conditions from Part 18.2: DSA target met, LEARN done with 150 minutes, BUILD done with 100 minutes and at least one push, CLOSE done with all three fields, MONEY done with touches logged, NIGHT all three toggles.
- Six of six is green, four or five is amber, three or fewer is red.
- Streak counts green days only. Amber does not break it, red does. Rest Sundays are neutral: they neither break nor extend.
- Recomputed server side on every write to `day_logs`, `week_day_progress`, `github_pushes`, `dsa_progress` and `lead_touches`.

### 12.3 The ten warnings

Implement `warning_rules` W1 to W10 from Part 18.5 exactly, evaluated server side by `GET /api/warnings` and rendered on Today and in a bell menu on every screen. Red warnings cannot be dismissed. Orange warnings can be snoozed for 24 hours, once.

### 12.4 Integrity

1. A gate cannot be marked passed without an `evidence_url` that parses as a URL. Rejected server side with a clear message.
2. Video minutes over 30 in a day shows the orange W4 warning: this came out of LEARN, it was not added on top.
3. No retroactive edits beyond 7 days, enforced in SQL and in the API, on every user table.
4. Nothing is ever hard deleted. Reference tables are read only in the UI. User rows soft delete only, and every mutation writes `audit_log`.
5. Money work cannot be logged against a study block. The API rejects a `study_sessions` row with block `MONEY` that starts before 16:30 or a study block that starts between 17:00 and 18:00, with the message from Part 17.1 rule 1.
6. `failed_twice` problems appear on Today until solved cold.

---

## 13. The A to Z screen

`/everything` is a single page that proves nothing was lost. It lists every trackable item in the entire roadmap in one scrollable, filterable, searchable list, grouped by source part:

- 126 week days, 150 calendar days, 474 DSA problems, every resource in Part 7, 120 week links, 4 projects with 9 README sections each, 4 gates, 4 money gates, 21 Sundays, 8 offers, 21 money weeks, the Part 13 ladder rows, the Part 16 New Zealand milestones, and the Part 16 money tables: 8 `nz_costs` rows, 3 `nz_salary` rows, 5 `nz_projection` rows. Then the Part 19 eligibility tables: 9 `roles_early` rows, 22 `eligibility_weeks` rows, 13 `eligibility_dsa` rows, 4 `fast_exits` rows and 8 `skill_combos` rows.
- One global progress number at the top: items complete of items total, with the same number broken down per group.
- Filters: not started, in progress, done, overdue, this week.
- Search across every item's text with results in under 100 ms on the client.
- Export the whole view to CSV.

---

## 14. API surface

REST, JSON, everything under `/api`. Always `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. Never leak SQL errors to the client.

```
POST   /api/auth/signup | login | logout
GET    /api/me
PATCH  /api/me/profile
POST   /api/me/password
POST   /api/me/avatar
PUT    /api/me/github-token

GET    /api/today
GET    /api/calendar?from=&to=
GET    /api/calendar/:date
GET    /api/calendar.ics
GET    /api/weeks
GET    /api/weeks/:n
GET    /api/day-logs?from=&to=
PUT    /api/day-logs/:date
PATCH  /api/week-days/:id/progress

POST   /api/sessions/start
POST   /api/sessions/:id/stop
GET    /api/sessions?date=

GET    /api/dsa/problems?topic=&difficulty=&status=
PATCH  /api/dsa/problems/:id/progress
GET    /api/dsa/summary
POST   /api/dsa/import

GET    /api/resources?category=&week=&status=
PATCH  /api/resources/:id/progress
POST   /api/resources/:id/open

GET    /api/projects
PATCH  /api/projects/:id/progress

GET    /api/gates
PATCH  /api/gates/:no/result
GET    /api/money-gates
PATCH  /api/money-gates/:code/result

GET    /api/sundays
PATCH  /api/sundays/:week/log

GET    /api/pushes?from=&to=
POST   /api/pushes
POST   /api/pushes/sync
GET    /api/repos | POST /api/repos | PATCH /api/repos/:id

GET    /api/money/summary
GET    /api/leads?status=&due=
POST   /api/leads | PATCH /api/leads/:id
POST   /api/leads/import          (CSV, matches leads.csv from Appendix B)
POST   /api/leads/:id/touch
GET    /api/deals | POST /api/deals | PATCH /api/deals/:id
GET    /api/care-plans | POST /api/care-plans | PATCH /api/care-plans/:id
GET    /api/money/scripts

GET    /api/applications | POST | PATCH /:id | DELETE /:id
GET    /api/mocks | POST /api/mocks
GET    /api/writeups | POST /api/writeups

GET    /api/ladder
GET    /api/roles
GET    /api/after
GET    /api/nz | PATCH /api/nz/:id/progress
GET    /api/reference
GET    /api/everything
GET    /api/warnings
GET    /api/stats
GET    /api/export/:table.csv
GET    /api/export/all.json
```

---

## 15. Design system

Light mode default, dark mode via `prefers-color-scheme` plus a manual toggle stored per user. CSS custom properties only.

```css
:root{
  --ink:#2C2C2B; --muted:#7D7A75; --canvas:#FFFFFF;
  --soft:#F9F8F7; --surface:#F0EFED; --border:#E6E5E3;
  --blue:#2783DE; --blue-soft:#E5F2FC;
  --green:#46A171; --green-soft:#E8F1EC;
  --orange:#D5803B; --orange-soft:#FBEBDE;
  --red:#E56458; --red-soft:#FCE9E7;
  --radius:10px; --gap:16px;
  --font:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  --mono:'SF Mono',Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){
  :root{ --ink:#FFFFFF; --muted:rgba(255,255,255,.65); --canvas:#191919;
    --soft:#202020; --surface:#383836; --border:rgba(255,255,255,.20);
    --blue:#5E9FE8; --green:#72BC8F; --orange:#DE9255; --red:#E97366; }
}
```

Rules:

- Blue is the only default accent. Green, orange and red carry fixed meaning: done, attention, missed or overdue. Never use colour as the only signal, always pair it with text or an icon.
- Phase colours on `/weeks` and `/calendar`: `#5E9FE8 #EAC26B #72BC8F #BF8EDA #DE9255 #DF84A8`, in that order for phases A to F.
- One font family. Body 15px, line height 1.55, long form capped at 70 characters. Section headings 1.4 to 1.75x body, page titles 2 to 3x.
- 8px spacing scale. Generous white space. One idea per card. No card inside a card inside a card.
- Fixed left sidebar, 240px, routes grouped: **Daily** (Today, Calendar, Weeks, DSA), **Work** (Projects, Gates, Sundays, Library, GitHub), **Money** (Money hour), **Career** (Applications, Ladder, Roles, Eligibility), **Future** (After Jan 2027, New Zealand), **Info** (Everything, Reference, Stats, Profile).
- Numbers are the design. The largest text on any screen is a number that matters, not a heading.
- Motion: 120 ms ease for state changes, nothing longer, `prefers-reduced-motion` fully respected.
- Fully keyboard navigable, visible focus rings, `aria-label` on every icon button, live regions for toasts, contrast AA minimum everywhere including the muted text.
- Mobile: sidebar becomes a bottom bar under 768px. Every daily checkbox must be usable one handed on a 375px screen, because that is how they will actually be ticked. Tap targets 44px minimum.
- Empty states are written sentences, never a blank panel. Each one says what to do next.

---

## 16. Notifications, offline and PWA

- Web push is not required. Local `Notification` API with a service worker is: block start reminders at 06:30, 09:30, 14:00, 16:00, 17:00 and 21:30, opt in per block, and a gate countdown notice at 14, 7 and 1 days.
- Installable PWA: manifest, icons, offline shell.
- Offline queue: ticks made while offline go to IndexedDB and sync when the connection returns, with a visible pending count. Power cuts and patchy connections are normal here and must not lose a day's data.
- A `last synced` timestamp is visible on Today at all times.

---

## 17. Backups, exports, operations

- `/scripts/backup.sh` runs `mysqldump` nightly at 02:00, gzips, keeps 14 days, and writes a line to a log the app can read.
- `/scripts/export-all.mjs` writes one CSV per table plus a single JSON, weekly, to `/backups/exports`.
- `/docs/RUNBOOK.md` documents: restore from a dump, rotate the session secret, revoke and replace the GitHub token, re-run the seed safely, and what to do if the seed verification fails.
- Deployment target is the user's existing Oracle Cloud Always Free VPS, aarch64, behind nginx with certbot TLS already in place. Provide the nginx server block, a `systemd` unit with `Restart=always`, and the cron entries. The app listens on `127.0.0.1` only.
- `docker compose up` must bring up MySQL, run migrations, seed, verify counts and serve the app in one command.

---

## 18. Budgets

| Budget | Limit |
| --- | --- |
| Today screen server response | under 150 ms at p95 on the VPS |
| Any page, HTML plus CSS plus JS, uncompressed | under 250 KB total, excluding avatar images |
| JavaScript per screen | under 60 KB |
| Lighthouse | Performance 90+, Accessibility 100, Best Practices 95+, SEO not applicable |
| Console | zero errors, zero warnings, zero unhandled rejections on every route |
| SQL per request | no N+1. Any endpoint issuing more than 6 queries needs a comment justifying it |
| Cold start `docker compose up` to usable app | under 90 seconds |

---

## 19. Build order, with a verification gate after each phase

Do not move to the next phase until the current one is verified and reported.

| Phase | Deliverable | Verified by |
| --- | --- | --- |
| P0 | Parse report and counts | `/docs/PARSE-REPORT.md` matches Appendix E |
| P1 | Migrations, seed, verify script | `verify-seed.mjs` exits 0. Every count in 9.2 matches |
| P2 | Server bootstrap, security headers, session store, error handler | `curl -I` shows the expected headers, CSP has no `unsafe-inline` |
| P3 | Auth end to end | Signup, login, logout, wrong password, rate limit, session survives restart |
| P4 | Today | Every block renders real task text for a seeded date, every toggle persists across a hard refresh |
| P5 | Calendar, drawer, Open and start, timer, ICS | 150 cells render, a session writes minutes, the ICS imports into a phone calendar |
| P6 | Weeks, week detail, library | All 21 weeks, all 126 day rows, all 120 links tickable |
| P7 | DSA, topic level, then CSV import | Import a 474 row CSV, counts match 152 / 186 / 136 |
| P8 | Projects, gates, money gates, Sundays | Gate refuses to pass without evidence |
| P9 | GitHub sync and `/pushes` | Real pushes appear within 30 minutes, rate limit handled, manual entry works |
| P10 | Money hour | Lead import, touch logging, deal lifecycle, care plans, all charts |
| P11 | Applications, ladder, roles, eligibility, after, New Zealand, reference | Every table from Parts 12 to 16 rendered plus all five Part 19 tables, nothing paraphrased, including `nz_costs` with its visible total, `nz_salary`, `nz_projection`, and Appendix G read only under Verification log. `/eligibility` must compute the eligible role count from real progress rather than storing it, must show the advised badge on every eligible role, and must attach the rupee cost to every exit dated before 13 Dec 2026. A role that is eligible but not advised rendering without its red badge is a P11 failure |
| P12 | Everything, stats, exports | Global percentage correct against a hand count on a seeded fixture |
| P13 | PWA, offline queue, notifications, backups, deploy docs | Airplane mode tick syncs on reconnect |
| P14 | Full QA pass, section 20 | Every box in section 21 ticked with evidence |

---

## 20. Self verification protocol, mandatory before you say you are done

Mistakes are not acceptable in this build. Before declaring completion you must run all of the following and paste the output into `/docs/QA-REPORT.md`.

1. `node --test` for `lib/dates.mjs`, `lib/streaks.mjs`, `lib/warnings.mjs`, the seed parser, and every API validator. Minimum 60 tests, all passing.
2. A Playwright smoke run that logs in and visits all 19 routes, asserting zero console errors, zero failed requests, and the presence of one known seeded string on each route.
3. A persistence test: tick one control on each of Today, Calendar, Weeks, DSA, Library, Projects, Money, then hard refresh and assert every value survived.
4. A destructive input test: submit `'; DROP TABLE users; --` and `<img src=x onerror=alert(1)>` into every text field and every query parameter. Assert stored and rendered safely, tables intact.
5. An authorisation test: create a second user, then attempt to read and write the first user's rows by id on every `/api` route. Every attempt must return 403 or 404, never data.
6. A date boundary test: set the server clock to 2026-08-28, 2026-08-31, 2026-10-04, 2026-12-13, 2027-01-24 and assert Today renders the correct block, week and warnings on each.
7. A seed integrity diff: re-run the parser and assert byte identical SQL output.
8. Rate limit test on login and on the GitHub sync.
9. Lighthouse on Today, Calendar and Money, mobile preset, results pasted in.
10. A cold clone test: `git clone`, `cp .env.example .env`, `docker compose up`, and the app is usable with seeded data and zero manual steps.

If any of these fail, fix it and re-run. Do not report completion with a known failure and a note explaining it.

---

## 21. Definition of done

- [ ] `docker compose up` starts MySQL, migrates, seeds, verifies counts and serves the app in one command
- [ ] `.env.example` committed, no secret in client code or in git history
- [ ] Every acceptance count in 9.2 passes, verified by a script that exits non zero on mismatch
- [ ] All 19 routes render with real seeded data and zero placeholder text
- [ ] Every checkbox on every screen persists across a hard refresh
- [ ] Today shows the correct block for the current time in Asia/Kolkata
- [ ] The calendar shows 150 days, and Open and start opens the link and starts a timed session
- [ ] GitHub sync writes real pushes and degrades cleanly without a token
- [ ] The money hour screen records a touch in one tap and refuses a deal with no advance
- [ ] A gate cannot be passed without an evidence URL
- [ ] All ten warnings fire on a seeded fixture that triggers each one
- [ ] Every external link opens in a new tab with `rel="noopener noreferrer"`
- [ ] `check-links.mjs` flags dead links without deleting them
- [ ] Offline ticks queue and sync
- [ ] Nightly backup runs and a restore has been tested once
- [ ] Works one handed on a 375px viewport
- [ ] Lighthouse targets in section 18 met
- [ ] `/docs/QA-REPORT.md`, `/docs/PARSE-REPORT.md`, `/docs/RUNBOOK.md` and `README.md` all present and accurate
- [ ] `README.md` setup tested from a clean clone by following it literally

---

## 22. Do not do

- Do not add a JavaScript framework, a bundler, a CSS framework or a chart library
- Do not add OAuth or any third party auth
- Do not connect the browser to MySQL, and never put credentials in client code
- Do not summarise, shorten, paraphrase or sample the roadmap content when seeding
- Do not invent DSA problem names, resource links, salary figures, prices or immigration rules
- Do not delete a resource because a link check failed, flag it
- Do not add gamification: no badges, no confetti, no streak fire emojis, no motivational quotes, no XP, no levels
- Do not add AI features or a chatbot to this app
- Do not soften a red warning into a friendly suggestion. Red means red
- Do not let a client repository count towards the study push target
- Do not allow a money session to be logged inside a study block
- Do not ask the user to choose the stack, it is fixed in section 2
- Do not report done with a known failing check

---

## 23. Add on clause

Everything specified above is the floor, not the ceiling.

**If, while building, you find something that would genuinely make this tracker better at its one job, which is getting one person from unemployed to employed by 24 January 2027, add it.** Conditions:

1. Add it only after everything specified in this file is finished and verified.
2. It must not break any constraint in section 2 or any rule in section 22.
3. Write it down in `/docs/ADDITIONS.md`: what you added, why, which part of `final.md` it serves, and how to remove it if it turns out to be noise.
4. It must be measurable. If it cannot show a number or a state, it is decoration and it does not belong here.

Ideas that qualify, if you have time after the floor is built: a Monday morning email or file digest of last week's numbers, a one page printable weekly sheet for days without power, a keyboard command palette, a Saturday review wizard that walks the seven questions from Part 18.6, an interview answer bank tied to the projects, and a plain read only public progress page the user can put on a resume with a single toggle to disable it.

Ideas that do not qualify: anything social, anything with a leaderboard, anything that sends data to a third party, anything that needs a paid service.

---

## 24. Final instruction

Build it in the order in section 19. After each phase, report: what was built, what was verified, what the counts were, and what is next. If any instruction in this file is ambiguous, choose the option that makes the daily checkbox faster to tick and the daily number harder to fake, then write the decision in `/docs/ADDITIONS.md`.

The person using this has already written 46 repositories he could not read. This is the one that has to work while he learns to read them.
