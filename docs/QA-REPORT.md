# QA-REPORT.md

What was actually run, and what it returned. Every number here is copied from a
command whose output was read, or from a file this report names so it can be
checked without trusting the report.

Generated 31 August 2026. Environment: Windows, Node 24.19.0, MySQL 8 on
127.0.0.1:3399, database `roadmap_tracker`.

The application was rewritten from Express to Next.js 15 App Router in commit
`c61b32e`. Two checks earlier versions of this report carried cannot be performed
any more, because the software they tested no longer exists. They are recorded as
retired in sections 4 and 6 rather than quietly dropped.

---

## 1. The test suite

```
npm test
```

| Measure | Result |
| --- | --- |
| Tests | **518** |
| Suites | 83 |
| Pass | **458** |
| Fail | **0** |
| Skipped | **60** |

Node's own test runner through `tsx`, no framework dependency. Thirteen files:

| File | What it defends |
| --- | --- |
| `dates.test.mjs` | The 150 day window, the block boundaries, the seven day retroactive limit, Asia/Kolkata across midnight |
| `streaks.test.mjs` | Part 18.2: six of six is green, five is not, rest Sundays are neutral |
| `warnings.test.mjs` | W1 to W10, including that red cannot be dismissed |
| `money.test.mjs` | Part 17 arithmetic, and that a total never double counts |
| `eligibility.test.mjs` | Part 19, including that eligible is not advised |
| `start-date.test.mjs` | The per person start date, and that nothing changes when it is not moved |
| `cli.test.mjs` | The CSV reader and writer, the argument parser, the export table list |
| `security.test.mjs` | Argon2 parameters, password rules, markdown escaping, the ICS writer, the cookie and session rules, `safeNextPath`, the body limit, the rate limit defaults |
| `screens.test.mjs` | Every API path a screen asks for resolves to a route that exports that method, and every navigable path resolves to a page |
| `db.test.mjs` | The Appendix E row counts, against the live database |
| `signup-gate.test.mjs` | `decide(allowSignup, userCount)`, including that an unreadable user count fails closed |
| `triggers.test.mjs` | The `day_logs` retroactive triggers as migration 005 ships them |
| `http.test.mjs` | The HTTP surface, against a server that is already listening |

### The 60 skipped tests, and exactly why

All 60 are the whole of `tests/http.test.mjs`. That file probes
`/api/healthz` before anything else and skips every one of its tests when nothing
on `PUBLIC_ORIGIN` answers as this application. It is written that way on purpose:
it tests a running server rather than an imported app, and a suite that fails
because no server is up would be noise on a laptop.

No server was started for this report, so the whole file skipped. The 60 come out
of the file as:

| Group in `http.test.mjs` | Tests |
| --- | --- |
| Each of the 23 page routes redirects to `/login` without a session | 23 |
| Each of 17 sampled API routes answers 401 with a JSON `UNAUTHORISED` body | 17 |
| The 401 body leaks no row of data and is under 500 bytes | 1 |
| The pages a stranger is allowed to see: `/login`, `/signup`, `/api/healthz`, a 404, `robots.txt` | 5 |
| Static assets served from the same origin: `/sw.js`, the manifest, two icons | 4 |
| The security headers: CSP, framing and sniffing, permissions policy, session cookie, no `x-powered-by` | 5 |
| CSRF protection: login, signup, a data write, and that a plain GET is not refused | 4 |
| `/api/calendar.ics` needs a session like everything else | 1 |
| **Total** | **60** |

`458 + 60 = 518`. Nothing failed, and nothing else skipped.

`tests/db.test.mjs` also skips itself when MySQL is unreachable. MySQL was up, so
it ran, and its Appendix E assertions are section 2.

**The HTTP surface is verified against a deployed origin instead**, not against
this laptop: `npm run smoke` drives every page and every read endpoint against a
running server, and section 12.4 of `docs/RUNBOOK.md` is the same set of checks as
`curl` against the live domain. Section 5 states what that covers and what it does
not.

---

## 2. The seed contract

```
npm run verify
```

```
SEED VERIFIED. 70 assertions passed, 0 failed.
```

Exit code 0. Every count in Appendix E of `final.md` matches what the parser
extracted. The contract is read from the document at run time, never hardcoded.

The same counts are asserted against the live database by `tests/db.test.mjs`,
which ran in section 1:

| Table | Expected | Actual |
| --- | --- | --- |
| `calendar_days` | 150 | 150 |
| `week_days` | 126 | 126 |
| `week_links` | 120 | 120 |
| `resources` | 127 | 127 |
| `weeks` | 21 | 21 |
| `roles` | 7 | 7 |
| `skills` | 25 | 25 |
| `dsa_topics` | 18 | 18 |
| `dsa_problems` | 0 until a real CSV import | 0 |

`calendar_days` starts 2026-08-28, ends 2027-01-24, is contiguous with no gap or
duplicate, and splits into 3 launch, 126 study and 21 Sunday rows. `dsa_target`
sums to 415 over the study days, 6 over the launch days, 0 over the Sundays and
**421** overall.

`dsa_problems` holding 0 is correct, not a failure. `final.md` does not contain the
474 problem names, so they only arrive through `scripts/import-dsa.mjs`.

---

## 3. It compiles, and the production tree is clean

| Command | Exit | Output |
| --- | --- | --- |
| `npm run typecheck` | 0 | `tsc --noEmit`, strict, no errors |
| `npm run build` | 0 | the production build completes |
| `npm audit --omit=dev` | 0 | `found 0 vulnerabilities` |

`express`, `express-rate-limit`, `ejs` and `ip-address` appear nowhere in
`package-lock.json`. Rate limiting is `lib/server/rateLimit.ts`, written in the
project rather than taken from a package, which is why the advisory chain that
used to need managing here has gone rather than been pinned.

---

## 4. The screens against the API

```
npm test          # tests/screens.test.mjs, part of the 518
```

TypeScript cannot see a string. `useResource('/api/tday')` typechecks perfectly
and fails at runtime, and so does a sidebar entry pointing at a page nobody
created. Those are the two silent failures left once the screens are React
components, and they are what this file catches, statically, with no browser, no
server and no database:

| Rule | Why it is checked |
| --- | --- |
| Every `/api/...` path a screen asks for matches a route file that exists | A wrong path is an error card instead of data |
| That route exports the method the screen uses | A right path with a missing `POST` is a 405 |
| No two route files claim the same URL | The winner would be an accident of the build |
| Every route file exports at least one method | A 405 waiting to happen |
| Every path in the sidebar, the bottom bar and the command palette resolves to a `page.tsx` | A dead link in the shell |
| No screen still points at an endpoint the rewrite removed | The rewrite dropped four paths; a leftover caller would 404 |

Counted on disk: 23 `page.tsx` files under `app/(app)` and 75 `route.ts` files
under `app/api`.

**Retired check: per page "containers filled".** Earlier reports listed all 23
pages with a count of filled containers and a rendered character count, produced by
`scripts/smoke-screens.mjs`. That harness fetched a page's server rendered HTML,
installed it into a fake document and imported the screen's own ES module so its
`fetch` calls hit the real API. It cannot be carried over and has been deleted: a
screen is a compiled React component now, and it cannot be imported into a fake
document and made to hydrate. **No equivalent figure is reported here**, because
producing one needs a real browser. `scripts/smoke.mjs` replaced it with what can
be checked without one — see section 5 — and its header comment records the same
reasoning.

---

## 5. The HTTP surface

**Not exercised for this report.** No server was started, so the 60 tests in
`tests/http.test.mjs` skipped, as section 1 states.

What verifies it instead, and what each one covers:

| Check | Needs | What it asserts |
| --- | --- | --- |
| `npm test` with a server listening | `npm run build; npm start` in another terminal | The 60 tests above: every page redirects when anonymous, every sampled API route is 401, the headers, the cookie flags, the CSRF refusals, the ICS route |
| `npm run smoke -- --email=... --password=...` | A running or deployed origin and a real account | Signs in, then all 23 pages answer 200 carrying their own heading, all 34 read endpoints return `{ ok: true }` with the top level keys their screen reads, an anonymous request is refused, and a write with no CSRF token is refused |
| `docs/RUNBOOK.md` section 12.4 | The live domain | HSTS and `Secure` on the cookie, `Disallow: /`, `/signup` saying account creation is closed once the account exists, 302 from `/`, `UNAUTHORISED` from `/api/today`, no `x-powered-by` |

`npm run smoke` signs in as an existing account rather than creating one, so it
writes nothing but the session row, which it deletes. It does **not** assert that a
screen fills its panels: the data arrives after hydration, so that needs a real
browser.

---

## 6. The operational scripts

Every script under `scripts/` imports the TypeScript modules in `lib/`, so each one
runs through `tsx`. `node scripts/NAME.mjs` fails with `ERR_MODULE_NOT_FOUND`.
`scripts/seed-from-md.mjs` is the single exception, importing only `.mjs`, which is
why `npm run parse` calls plain `node`.

| Script | Command |
| --- | --- |
| Seed verifier | `npm run verify`, or `npx tsx scripts/verify-seed.mjs` |
| Migrator | `npm run migrate`, or `npx tsx scripts/migrate.mjs --status` |
| Link checker | `npx tsx scripts/check-links.mjs --dry-run --limit=4` |
| GitHub sync | `npx tsx scripts/sync-github.mjs --dry-run` |
| Export | `npx tsx scripts/export-all.mjs --zip` |
| Digest | `npx tsx scripts/weekly-digest.mjs --week=1` |
| Backup | `npm run backup`, or `bash scripts/backup.sh` |
| DSA import | `npx tsx scripts/import-dsa.mjs export.csv` |
| Password reset | `npx tsx scripts/reset-password.mjs --email=... --password=...` |

Section 2 is the one of these that was run for this report. The rest were last run
on 28 August 2026, **before** the scripts were ported to import `lib/*.ts`, so
their exit codes are not asserted for the current code. What can be checked today
is the output they left on disk:

| Artefact | On disk | What it shows |
| --- | --- | --- |
| `backups/export-2026-08-28-011817-…/` | 48 files plus `MANIFEST.txt`, 374.8 KB | The row counts in `MANIFEST.txt` sum to **778** |
| `backups/export-2026-08-28-011817-….zip` | 97,022 bytes (94.7 KB) | The same export, zipped |
| `backups/roadmap_tracker-2026-08-28-0653.sql.gz` | 183,303 bytes (179.0 KB) | A gzip dump, which `001_init.sql`'s 118 `CREATE TABLE` statements match |
| `backups/digest.md` | 3,717 bytes | A week rendered as Markdown |
| `backups/pw-2-….json` | present | `reset-password.mjs` saved the old hash before replacing it |

Re-run them with the commands above to produce fresh evidence. `import-dsa.mjs`
with no CSV exits 1 by design, printing the column mapping and the 18 steps.

**Retired check: the offline screen harness.** `scripts/verify-screens-offline.mjs`
rendered every EJS view and dispatched `fetch` straight into an Express router in
process. There are no EJS views and no Express routers, and the file has been
deleted. Nothing replaces it: what it caught, a missing view local, is now a
compile error.

---

## 7. Coverage audit

Two questions asked of the codebase directly.

**Does any endpoint have no interface?** 75 `route.ts` files under `app/api`. An
audit found five working endpoints that no screen called, and all five now have
one: lead CSV import on `/money`, add and reclassify a repository on `/pushes`,
manual session entry in the `/calendar` day drawer, and `GET /api/ops` on
`/profile`.

**Is any table never read?** `001_init.sql` creates 118 tables. Five were never
named in a server module: `app_meta` and `migrations_applied` are infrastructure,
and `link_check_runs`, `backup_log` and `dsa_imports` were written by the scripts
and read by nothing. `GET /api/ops` now reads all three and `/profile` shows them,
so "when was the last backup" has an answer that comes from the row the script
wrote.

---

## 8. Migration 005, applied this session

`migrations/005_hardening.sql` was applied and `npm run verify` still exits 0
after it. `001_init.sql` was deliberately not edited: `scripts/migrate.mjs` records
the SHA-256 of every migration and treats a changed file as a hard stop, so a
fresh install reaches the same state by applying 001 then 005.

Seven numbered blocks: six defects and one pair of missing indexes. Each is
explained in full in the file itself.

| # | Defect | What it did |
| --- | --- | --- |
| 1 | `trg_day_logs_no_backdate_upd` rejected **every** update to a `day_logs` row older than seven days | `recomputeDay()` writes `pushes`, `money_touches`, `day_colour`, `conditions_met` and `week_n`, which are derived rather than entered, and `recomputeRange()` walks all 150 days on GitHub sync, on a repository edit and on any start date change. From the eighth day of real use each of those would have raised SQLSTATE 45000 and surfaced as a 500. The trigger now fires only when a column a person enters actually changes, compared with the null safe `<=>` |
| 2 | `sessions` had no `user_id` | "Sign out everywhere" was `data LIKE '%"userId":12%'`, which also matches users 120, 123 and 1234. The column is added, backfilled from the stored JSON, and carries a foreign key |
| 3 | Anonymous session rows accumulated | `GET /api/csrf` is unauthenticated and wrote a 30 day row per call. The backlog is cleared here; `lib/server/session.ts` now gives a session with no user two hours |
| 4 | Two taps produced two open timers | Read-then-write race in `POST /api/sessions/start`. A generated column holds the user id only while a row is open, under `UNIQUE KEY uq_session_open_one`, so MySQL refuses the second |
| 5 | A day could be counted twice on `/pushes` | `uq_push_sha` was `(user_id, repo_id, sha_head)`, and a day's head commit changes between syncs. The key is now `(user_id, repo_id, push_date)`, which is what the sync loop iterates |
| 6 | Deleting a user deleted the audit trail | `fk_audit_user` was `ON DELETE CASCADE`, now `ON DELETE SET NULL` |
| 7 | Two hot paths had no index | `dsa_topics(ord)`, which `/dsa` orders by on every request, and `study_sessions(open_user_id, started_at)` for the open session lookup |

`tests/triggers.test.mjs` pins block 1 with **7 tests, all passing**. It cannot
insert an aged `day_logs` row, because the INSERT trigger correctly forbids exactly
that, so it builds a probe table with `CREATE TABLE … LIKE day_logs`, ages a row
inside it, and attaches the trigger body read verbatim out of
`migrations/005_hardening.sql` with only the names rewritten. The predicate under
test is therefore the shipped predicate. The probe table is dropped in a `finally`.

---

## 9. Known limits

Stated rather than hidden.

- **Whether a screen visibly fills its panels is not checked anywhere.** The data
  arrives after hydration, so it needs a real browser. Sections 4 and 5 are the
  two halves of what can be checked without one.
- **`dsa_problems` is empty.** Deliberate. `final.md` does not contain the 474
  names, so `/dsa` tracks per topic and says so until a real export is imported.
- **The 150 day window cannot move.** Appendix C lists every date and the four
  gates sit on named dates. The *start date* is per person and moves; days before
  it are neutral. See `docs/ADDITIONS.md`.
- **A stale server is still possible across a deployment.** A Next build compiles
  the screen and the route together, so they cannot disagree within one
  deployment. A browser holding an old page open against a new server still can.
  Screens normalise their payload so a missing field costs one panel rather than
  the page. `docs/RUNBOOK.md` section 12.8 gives the two commands that say whether
  a running process is older than the build.
- **Docker was not built here.** Docker is not installed on this machine.
  `docker-compose.yml` was parsed and validated as YAML (3 services, 1 volume) but
  no image was built and no container was run.
- **`GET /api/doc/:slug` returns Markdown source, not HTML.** There is no client
  side renderer, so `/reference` shows it in a `<pre>` and says so.
- **The block window check on a manual session can never fail** as
  `app/api/sessions/manual/route.ts` is written, because it passes the block's own
  start minute to `blockAllowedAt` rather than the wall clock. The rules are stated
  in the form regardless. Changing it would be a server side decision.
- **Login is rate limited** to 5 attempts per 15 minutes per address and per email,
  per section 5.3. `npm run smoke` signs in, so running it more than five times in
  a quarter hour is refused. That is the limiter working. Restarting the process
  clears the counters, because they live in memory.

---

## 10. Pre-deployment security audit

Run before the first internet deployment. Every line was checked in the source, not
assumed.

| Area | Finding |
| --- | --- |
| **Open signup** | **Was a blocker.** `requireAnon` was the only guard, so any stranger could register on the server. Now gated by `lib/server/signup.ts`: once the one account exists `POST /api/auth/signup` answers 403 `SIGNUP_CLOSED`, `GET /signup` answers 200 with a page saying account creation is closed, and `/login` stops offering the link. Fails closed if the user count cannot be read. Covered by 13 tests in `tests/signup-gate.test.mjs` |
| **`npm audit --omit=dev`** | **`found 0 vulnerabilities`**, exit 0. The two high severity `ip-address` advisories that used to need managing here came in through `express-rate-limit`; both that package and `express` itself are gone, and the limits are now `lib/server/rateLimit.ts` |
| SQL injection | Clean. Every query parameterised, `multipleStatements: false` in `lib/db/pool.ts`. Two dynamic `SET` clauses exist; both build column names from a hardcoded allow-list (`WRITABLE_DAY_FIELDS`, and literal keys in `saveState`). Two `IN (...)` clauses generate placeholders only, never values |
| XSS | `renderMarkdown()` escapes HTML before emitting it, asserted in `security.test.mjs` against a script tag, an `onerror` image and a fenced code block. On the client there is no `dangerouslySetInnerHTML` and no `innerHTML` anywhere under `app/` or `components/`, and the CSP sets `style-src-attr 'none'`, so no style attribute can be written into markup either |
| Session cookie | `httpOnly`, `SameSite=Lax`, `secure` when `NODE_ENV=production`, `path=/`, 30 day rolling, stored in MySQL. Name `roadmap.sid`, so no framework fingerprint. A session with no user gets two hours, not thirty days |
| CSRF | Guard on the whole of `/api`. A POST without a token gets 403 `FORBIDDEN`. Token rotated on signup and login |
| Password storage | Argon2id at m=19456, t=2, p=1, frozen so nothing can weaken it at runtime. Minimum 12 characters, local blocklist, no network service. Constant-time dummy verify on unknown email, so response timing does not reveal whether an account exists |
| Secrets in prod | Config **refuses to boot** in production without a 64 hex `TOKEN_ENC_KEY`, and refuses any `SESSION_SECRET` under 32 characters |
| Error leakage | Stack traces to the server log with a timestamp; the client gets a generic sentence. `x-powered-by` off |
| Headers | HSTS one year with subdomains in production. CSP carries a per request nonce, has no `unsafe-inline` on script and no `eval`; `object-src` and `frame-ancestors` are `none`. Permissions-Policy turns off camera, geolocation, microphone, payment and usb |
| Open redirect | `safeNextPath` refuses an absolute URL, a scheme-relative URL, the backslash variant, and anything with whitespace or a control character |
| Request size | 256 kB, enforced inside `parseBody` on both the declared and the real length, so no route can forget it |
| Indexing | `robots.txt` is `Disallow: /`. A personal tracker has no business in a search index |
| `/api/healthz` | Unauthenticated on purpose, for the proxy probe. Returns db up/down, the date, the current block and `env`. No credentials, no counts, no user data. `/healthz` is kept as an alias |
| GitHub token | Encrypted at rest with `TOKEN_ENC_KEY`. `GET /api/me` returns only `has_github_token` |
| Dead surface | There is no upload mount. The Express build served `public/uploads` statically against a directory that never existed; Next serves only what is in `public/`, and nothing writes there. `public_progress` and `public_slug` are stored and nothing serves a public page; `/profile` says so. Documented in RUNBOOK 12.6 |
| Secret hygiene | `.env` is in both `.gitignore` and `.dockerignore`, and the Dockerfile copies no secret into a layer. The development `DB_PASSWORD` still contains a placeholder word and **must be rotated** before deployment |

The production environment checklist is at the bottom of `.env.example`, and the
live-domain `curl` checks are in `docs/RUNBOOK.md` section 12.4.

---

## 11. How to reproduce all of it

```bash
npm run typecheck                                  # exit 0
npm run build                                      # exit 0
npm run verify                                     # SEED VERIFIED. 70 assertions
npm test                                           # 518 tests, 60 skipped with no server
npm audit --omit=dev                               # found 0 vulnerabilities
npx tsx scripts/check-links.mjs --dry-run --limit=4
npx tsx scripts/sync-github.mjs --dry-run
npx tsx scripts/export-all.mjs --dry-run
npx tsx scripts/backup.mjs --dry-run
npx tsx scripts/weekly-digest.mjs --week=1
```

For the 60 HTTP tests and the smoke run, a server has to be listening:

```bash
npm run build; npm start                                    # one terminal
npm test                                                    # the other: 518 passing, 0 skipped
npm run smoke -- --email=you@example.com --password=...
```
