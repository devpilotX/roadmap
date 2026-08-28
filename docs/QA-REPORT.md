# QA-REPORT.md

What was actually run, and what it returned. Every number here is copied from a
command whose output was read, not from an intention.

Generated 28 August 2026. Environment: Windows, Node 24.19.0, MySQL 8.4.9 on
127.0.0.1:3399, database `roadmap_tracker`.

---

## 1. The test suite

```
npm test
```

| Measure | Result |
| --- | --- |
| Tests | **604** |
| Suites | 83 |
| Pass | **604** |
| Fail | **0** |
| Skipped | 0 |
| Duration | ~0.6 s |

Node's own test runner, no framework dependency. The files:

| File | What it defends |
| --- | --- |
| `dates.test.mjs` | The 150 day window, the block boundaries, the seven day retroactive limit, Asia/Kolkata across midnight |
| `streaks.test.mjs` | Part 18.2: six of six is green, five is not, rest Sundays are neutral |
| `warnings.test.mjs` | W1 to W10, including that red cannot be dismissed |
| `money.test.mjs` | Part 17 arithmetic, and that a total never double counts |
| `eligibility.test.mjs` | Part 19, including that eligible is not advised |
| `start-date.test.mjs` | The per person start date, and that nothing changes when it is not moved |
| `cli.test.mjs` | The CSV reader and writer, the argument parser, the export table list |
| `security.test.mjs` | Argon2 parameters, password rules, markdown escaping, the ICS writer |
| `screens.test.mjs` | The 24 client screens: mount ids, API paths, imports, CSP rules, CSS availability |
| `db.test.mjs` | The Appendix E row counts, against the live database |
| `http.test.mjs` | The HTTP surface, against a running server |

`db.test.mjs` and `http.test.mjs` skip themselves when MySQL or the server is not
up. Both ran with their infrastructure present for this report, so nothing was
skipped.

---

## 2. The seed contract

```
node scripts/verify-seed.mjs
```

```
SEED VERIFIED. 70 assertions passed, 0 failed.
```

Every count in Appendix E of `final.md` matches what the parser extracted. The
contract is read from the document at run time, never hardcoded.

Spot checks confirmed directly against the database:

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

## 3. Every screen, against the real database

```
npm install linkedom --no-save
node scripts/smoke-screens.mjs
```

The harness signs up a throwaway account, fetches each page's server rendered
HTML, installs it as a real document, imports the real screen module so its own
`fetch` calls hit the real API and MySQL, then asserts every container that said
"Loading" no longer does. It deletes the account afterwards, including on the
failure path.

```
23 of 23 screens filled every container.
throwaway account deleted: confirmed gone
orphaned profile rows: 0
```

| Page | Containers filled | Rendered |
| --- | --- | --- |
| `/` | 7 of 7 | 1,918 chars |
| `/calendar` | 3 of 3 | 1,976 |
| `/weeks` | 2 of 2 | 2,345 |
| `/weeks/1` | 2 of 2 | 3,338 |
| `/dsa` | 5 of 5 | 4,436 |
| `/library` | 3 of 3 | 17,865 |
| `/projects` | 2 of 2 | 3,597 |
| `/gates` | 2 of 2 | 2,412 |
| `/sundays` | 2 of 2 | 5,096 |
| `/pushes` | 5 of 5 | 4,797 |
| `/money` | 10 of 10 | 17,940 |
| `/applications` | 5 of 5 | 3,005 |
| `/ladder` | 4 of 4 | 3,435 |
| `/roles` | 3 of 3 | 7,014 |
| `/eligibility` | 8 of 8 | 10,956 |
| `/after` | 4 of 4 | 4,485 |
| `/newzealand` | 8 of 8 | 8,997 |
| `/everything` | 4 of 4 | 93,097 |
| `/stats` | 8 of 8 | 3,278 |
| `/profile` | 5 of 5 | 4,050 |
| `/review` | 2 of 2 | 2,961 |
| `/reference` | 2 of 2 | 27,186 |
| `/print/week` | 2 of 2 | 5,238 |

Those figures were taken before the Roles page was extended with where to apply,
interview preparation, the resume stages and the unlock ladder, so `/roles` is now
substantially larger than 7,014 characters.

---

## 4. The HTTP surface, unauthenticated

55 assertions in `http.test.mjs`, all passing.

| Check | Result |
| --- | --- |
| All 23 page routes without a session | **302 to `/login`** |
| 14 sampled API routes without a session | **401**, JSON, code `UNAUTHORISED` |
| The 401 body | Leaks no row of data, under 500 bytes |
| `/login` and `/signup` | 200, `text/html` |
| An unknown route | 404 |
| `POST /api/auth/login` with no CSRF token | **403**, code `FORBIDDEN` |
| `POST /api/auth/signup` with no CSRF token | **403** |
| `x-powered-by` | Absent |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| CSP | `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, no `unsafe-inline` on script, no `unsafe-eval` |
| Permissions-Policy | camera, geolocation, microphone, payment and usb all `()` |
| Session cookie | `HttpOnly`, `SameSite=Lax`, `Path=/` |
| `/api/calendar.ics` | 401 |

Static assets: 24 screen modules, 23 screen stylesheets and 12 shared assets all
served 200 with the correct content type. Zero bad.

---

## 5. The operational scripts

Each was run and its exit code read.

| Script | Command | Exit | Result |
| --- | --- | --- | --- |
| Seed verifier | `node scripts/verify-seed.mjs` | 0 | 70 assertions passed |
| Link checker | `node scripts/check-links.mjs --dry-run --limit=4` | 0 | 4 urls probed, all 200, 2 redirects followed, nothing written |
| GitHub sync | `node scripts/sync-github.mjs --dry-run` | 0 | 1 user, anonymous mode reported with its 60 an hour cost, no username so skipped |
| Export | `node scripts/export-all.mjs --zip` | 0 | 48 files, 778 rows, 371.1 KB, plus `MANIFEST.txt` and a 94.7 KB zip |
| Digest | `node scripts/weekly-digest.mjs --week=1` | 0 | Week 1 rendered as Markdown |
| Backup | `node scripts/backup.mjs` | 0 | 179.0 KB gzip, verified readable, **118 tables**, `Dump completed` marker present |
| DSA import | `node scripts/import-dsa.mjs` | 1 | Correct: with no CSV it prints the column mapping and the 18 steps, then exits 1 |
| Backup shell | `bash -n scripts/backup.sh` | 0 | Syntax clean |

`backup_log` was checked directly afterwards and holds both rows:

```
2026-08-28 06:48:19  export  export-2026-08-28-011817-...zip  380010  ok  48 files, 778 rows
2026-08-28 06:53:06  dump    roadmap_tracker-2026-08-28-0653.sql.gz  183303  ok  118 tables, 92 inserts
```

### The DSA importer, tested against a hostile CSV

A synthetic Striver export was fed in, containing a quoted field with a comma and
a row claiming step 99. The importer:

- mapped all five columns by alias, and listed the two it ignored
- parsed `"Frog Jump, with K distances"` intact
- **rejected step 99** and said why: a nineteenth step would be an invention
- **refused to write**, because 5 problems is not 474, and named the flag that
  would override it

---

## 6. Client code rules

Enforced by 242 assertions in `screens.test.mjs`, all passing, for all 24 screens:

| Rule | Why it is checked |
| --- | --- |
| No placeholder stubs | 17 screens were four line stubs; the pages showed only "Loading" |
| Mounts only to ids its view declares | A wrong id leaves a panel on "Loading" forever |
| Fills every container the view leaves on "Loading" | Same failure, from the other direction |
| Calls only API paths the router registers | A wrong path shows an error card instead of data |
| Imports only helpers that are exported | A blank page with a console error |
| No `innerHTML`, no `html:` to `el()`, no style attribute | `el()` throws, and the CSP forbids inline style |
| Renders an `errorCard` on failure | A screen must never fail silently |
| Starts itself at the top level | Otherwise it defines its work and never does it |
| Every class it uses has a rule | A class with no rule is invisible: right markup, wrong layout |
| **Every class is in a stylesheet that page loads** | `head.ejs` loads one screen stylesheet; a class from another screen is unstyled |
| No two flex containers on one element | The winner would depend on stylesheet order |

The last two caught eight real defects: `.milestone`, `.costheading`, `.pwwrap`,
`.funnelbar`, `.videorow`, `.bigrow` and `.linklist` were each defined inside one
screen's stylesheet and used from another, and `row between` appeared 14 times
where the gap only resolved correctly by accident of declaration order. All are
fixed; the shared classes now live in `components.css`.

---

## 7. Coverage audit

Two questions were asked of the codebase directly.

**Does any API route have no interface?** 82 routes. Eight looked unreferenced;
three were false positives from the auth prefix. The other five were real and are
now built: lead CSV import, add and reclassify a repository, and manual session
entry.

**Is any table never read?** 118 tables. Five were never named in a server module:
`app_meta` and `migrations_applied` are infrastructure, and `link_check_runs`,
`backup_log` and `dsa_imports` were written by the scripts and read by nothing.
`GET /api/ops` now reads all three and `/profile` shows them, so "when was the last
backup" has an answer that comes from the row the script wrote.

---

## 8. Known limits

Stated rather than hidden.

- **The offline harness cannot catch a stale server.** `verify-screens-offline.mjs`
  imports the handlers from source, so the client and server are always the same
  version inside it. A running server older than the client is invisible to it.
  This happened once: `/roles` passed every check while the deployed process was
  still returning the previous payload, and the browser threw
  "Cannot read properties of undefined (reading 'total')". Two mitigations are in
  place: `roles.mjs` normalises the payload so a missing field degrades one panel
  instead of the page, and section 12.8 of the runbook says to restart after any
  change under `src/`. **Restart the server after changing server code.**
- **`dsa_problems` is empty.** Deliberate. `final.md` does not contain the 474
  names, so `/dsa` tracks per topic and says so until a real export is imported.
- **The 150 day window cannot move.** Appendix C lists every date and the four
  gates sit on named dates. The *start date* is per person and moves; days before
  it are neutral. See `docs/ADDITIONS.md`.
- **The smoke harness needs `linkedom`,** installed with `--no-save`. It is not a
  dependency and never ships.
- **Docker was not built here.** Docker is not installed on this machine. The
  `docker-compose.yml` was parsed and validated as YAML (3 services, 1 volume) but
  no image was built and no container was run.
- **`GET /api/doc/:slug` returns Markdown source, not HTML.** There is no client
  side renderer, so `/reference` shows it in a `<pre>` and says so.
- **The block window check on manual sessions can never fail** as the handler is
  written, because it tests each block's own start minute rather than the wall
  clock. The rules are stated in the form regardless. Changing that would be a
  server side decision, not a client one.
- **Signup is rate limited** to 5 per 15 minutes per IP, per section 5.3. Running
  the smoke harness more than five times in a quarter hour will be refused. That
  is the limiter working.

---

## 10. Pre-deployment security audit

Run before the first internet deployment. Every line was checked in the source, not
assumed.

| Area | Finding |
| --- | --- |
| **Open signup** | **Was a blocker.** `requireAnon` was the only guard, so any stranger could register on the server. Now gated: closed after the first account, 403 `SIGNUP_CLOSED`. Fails closed if the user count cannot be read. |
| **`npm audit`** | **Was 2 high severity.** `ip-address` 10.0.1 via `express-rate-limit` 8.1.0, and reachable because `ipKeyGenerator(req.ip)` runs on every login. Upgraded to 8.6.2, `ip-address` 10.5.0. Now **0 vulnerabilities**. |
| SQL injection | Clean. Every query parameterised, `multipleStatements` off. Two dynamic `SET` clauses exist; both build column names from a hardcoded allow-list (`WRITABLE_DAY_FIELDS`, and literal keys in `saveState`). Two `IN (...)` clauses generate placeholders only, never values. |
| XSS | One unescaped template output, `verificationLogHtml` on /reference. It is `renderMarkdown()` output over `data/final.md`, and `renderMarkdown` escapes HTML, which is asserted in `security.test.mjs`. Client side, `el()` throws on `html:` and there is no `innerHTML` anywhere; enforced for all 24 screens by `screens.test.mjs`. |
| Session cookie | `httpOnly`, `SameSite=Lax`, `secure` when `NODE_ENV=production`, `path=/`, 30 day rolling, stored in MySQL, `proxy` aware. Name `roadmap.sid`, so no framework fingerprint. |
| CSRF | Guard on the whole of `/api`. A POST without a token gets 403 `FORBIDDEN`. Token rotated on signup and login. |
| Password storage | Argon2id at m=19456, t=2, p=1. Options frozen. Minimum 12 characters, local blocklist, no network service. Constant-time dummy verify on unknown email, so response timing does not reveal whether an account exists. |
| Secrets in prod | Config **refuses to boot** in production without a 64 hex `TOKEN_ENC_KEY`, and refuses any `SESSION_SECRET` under 32 characters. Both verified by simulating production config. |
| Error leakage | Stack traces to the server log with a timestamp; the client gets a generic sentence. `x-powered-by` off. |
| Headers | HSTS one year with subdomains in production. CSP has no `unsafe-inline` on script or style and no `eval`; `object-src`, `frame-src` and `frame-ancestors` all `none`. Permissions-Policy turns off camera, geolocation, microphone, payment and usb. |
| Indexing | `robots.txt` is `Disallow: /`. A personal tracker has no business in a search index. |
| `/healthz` | Unauthenticated on purpose, for the proxy probe. Returns db up/down, the date, the current block and `env`. No credentials, no counts, no user data. |
| GitHub token | Encrypted at rest. `GET /api/me` returns only `has_github_token`. |
| Dead surface | `public/uploads` is mounted static but the directory does not exist and no route writes to it. `public_progress` and `public_slug` are stored and nothing serves a public page; /profile says so. Both documented in RUNBOOK 12.6. |
| Secret hygiene | `.env` is in both `.gitignore` and `.dockerignore`, and the Dockerfile copies no secret into a layer. The development `DB_PASSWORD` still contains a placeholder word and **must be rotated** before deployment. |

The production environment checklist is at the bottom of `.env.example`, and the
live-domain `curl` checks are in `docs/RUNBOOK.md` section 12.4.

---

## 11. How to reproduce all of it

```bash
npm test                                  # 604 tests
npm run verify                            # the Appendix E contract
npm install linkedom --no-save
node scripts/smoke-screens.mjs            # 23 of 23 screens, needs the server up
node scripts/check-links.mjs --dry-run --limit=4
node scripts/sync-github.mjs --dry-run
node scripts/export-all.mjs --dry-run
node scripts/backup.mjs --dry-run
node scripts/weekly-digest.mjs --week=1
```

