# The Roadmap Tracker

A single user career tracker for the window **28 August 2026 to 24 January 2027**,
seeded entirely from `data/final.md`.

150 days. 21 weeks. 6 phases. 4 gates. 415 DSA problems to solve by the last day.
₹90,000 to earn in the money hour. Every one of those numbers comes out of the
document, not out of this code.

The point of the application is narrow: make the daily checkbox fast to tick and
the daily number hard to fake.

---

## What it is

- **Next.js 15 (App Router), React 19, TypeScript, Tailwind v4, MySQL 8.** One
  origin, so no CORS. Every page is a server component that renders its own shell,
  and one client island per screen fetches the JSON and fills it.
- **All business logic is server side.** `lib/` holds it, `app/api/` exposes it,
  and the screens only ever read the same JSON envelope a script would.
- **Everything is seeded from `final.md`.** A parser reads the document, a
  migration writes the rows, and a verifier refuses to pass unless the row counts
  match Appendix E of the document exactly.
- **Nothing is invented.** The clearest case is DSA: `final.md` names the Striver
  A2Z sheet and its 474 problems but does not list them, so this app ships the 18
  step names and nothing more. Problem names arrive from a real tracker export
  through `scripts/import-dsa.mjs`, and until they do, `/dsa` says plainly that
  problem level import is pending.

## Getting started

MySQL 8.0.16 or later and Node 20.9 or later. No migration creates the database or
its user, so that comes first.

```bash
mysql -u root -p -e "CREATE DATABASE roadmap_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
                     CREATE USER 'roadmap'@'localhost' IDENTIFIED BY 'pick something long';
                     GRANT ALL ON roadmap_tracker.* TO 'roadmap'@'localhost';"

cp .env.example .env          # then fill in DB_* and the two secrets
npm install
npm run setup                 # parse final.md, migrate, verify the counts
npm run build                 # compile the application
npm start                     # http://127.0.0.1:3000
```

For day to day work use `npm run dev`, which needs no build step. `npm start` serves
the compiled output only, so nothing you change on disk is live until `npm run build`
has run.

**Check `DB_PORT` before `npm run setup`.** `.env.example` ships `3306`, which is the
MySQL default and what `docker compose` uses. It is not universal: the instance this
was developed against listens on **3399**, and a wrong port fails at the first
migration with `ECONNREFUSED`. `mysql --port=...` and `DB_PORT` have to agree.

`npm run setup` is three steps and the third one is the important one: it fails
loudly if a single Appendix E count is off.

Generate the two secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`SESSION_SECRET` signs the session cookie. `TOKEN_ENC_KEY` encrypts the GitHub
token at rest and is **required** in production, because a token cannot be stored
without it.

Then open `/signup` and create the one account. Signup closes itself afterwards.

### The migrations

`npm run migrate` applies them in filename order, once each, recording the SHA-256
of every file. A migration whose content changed after it was applied is a hard
stop, because running different SQL under one name is how databases drift.

| File | What it is |
| --- | --- |
| `001_init.sql` | 118 tables, the foreign keys, and the triggers that enforce the money hour and the seven day retroactive limit |
| `002_seed_reference.sql` | Generated from `final.md` by `npm run parse`. Do not hand edit |
| `003_seed_calendar.sql` | The same, the 150 days |
| `004_seed_money.sql` | The same, Part 17 |
| `005_hardening.sql` | Six corrections found by audit, plus two missing indexes. Every one is explained in the file. The most consequential narrows the `day_logs` update trigger so it stops blocking the application's own derived recomputation, which would otherwise have failed every GitHub sync from the eighth day of use |

### With Docker

```bash
cp .env.example .env          # a real DB_PASSWORD and the two secrets
docker compose up --build -d  # detached, or the next line has no terminal
docker compose exec app npm run setup
```

`docker compose` creates the database and the user itself from `DB_NAME`, `DB_USER`
and `DB_PASSWORD`, and it overrides `DB_HOST` to `db` and `DB_PORT` to `3306` for the
containers, so leave those two at whatever suits your host. The database publishes no
port; reach it with `docker compose exec db mysql`. The five scheduled jobs are a
separate `cron` profile: `docker compose --profile cron up -d`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run in development, no build step |
| `npm run build` | Compile for production |
| `npm start` | Run the compiled application |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run lint` | Lint the application source |
| `npm run parse` | Parse `final.md` into SQL and write `docs/PARSE-REPORT.md` |
| `npm run migrate` | Apply `migrations/*.sql` |
| `npm run verify` | Check every row count against Appendix E. Exit 1 on a mismatch |
| `npm run setup` | parse, migrate, verify, in that order |
| `npm test` | 518 tests through `node:test` and `tsx`. 60 of them are the HTTP surface and skip themselves when no server is listening |
| `npm run smoke` | Drive every page and endpoint against a running server |
| `npm run check-links` | HEAD every resource and week link, flag the dead ones |
| `npm run sync-github` | Pull commits into the push tracker |
| `npm run import-dsa` | Import a Striver A2Z or Codolio CSV export |
| `npm run export-all` | Every table to CSV and JSON on disk |
| `npm run digest` | The Saturday review as Markdown |
| `npm run backup` | mysqldump, verified and pruned |

Locked out and cannot reach `/profile` to fix it:

```bash
npx tsx scripts/reset-password.mjs --email=you@example.com --password='the new one'
```

It saves the old hash to `backups/` first, so `--restore=backups/pw-....json` puts it
back. It applies the same password rules the API does, and it ends every session for
that account, because a password change that leaves old sessions alive has not
really changed anything.

### The login rate limit

Five attempts per fifteen minutes, per address and per email, from section 5.3. That
is the default and it is what ships.

With `TRUST_PROXY=0` there is no per-visitor address to key on, so every caller
shares one bucket, and five attempts at a form on your own machine locks that
machine out for a quarter of an hour with a message that reads exactly like a broken
application. For local work, loosen it in `.env`:

```
AUTH_RATE_LIMIT_MAX=50
AUTH_RATE_LIMIT_WINDOW_MINUTES=1
```

Raising these weakens brute force protection. **Leave them unset in production.**
The counters live in process memory, so a restart clears them either way.

Every script takes `--help`-style behaviour: run it with no arguments or with
`--dry-run` first. None of them write anything in a dry run.

The operational scripts import the TypeScript modules under `lib/`, so they run
through `tsx`. That is already wired into every `npm run` above; call them the
same way by hand, for example `npx tsx scripts/backup.mjs --dry-run`.

### Verifying the screens really draw

`npm test` holds the screens and the API together with static checks: every
`/api/...` path a screen asks for resolves to a route that exists and exports the
method it uses, and every path in the sidebar, the bottom bar and the command
palette resolves to a page. TypeScript cannot see either of those, because both are
strings.

To prove the whole surface answers against the real database, start the server and
run the smoke test:

```bash
npm run build; npm start          # in one terminal
npm run smoke -- --email=you@example.com --password=...
```

It signs in as a real account, asserts that nothing private is reachable without a
session, that a write without a CSRF token is refused, that all 23 pages answer
200 with their own heading, and that all 34 read endpoints return the keys their
screen depends on. It writes nothing but the session row, which it then deletes.

With the server up, `npm test` also stops skipping: the 60 tests in
`tests/http.test.mjs` check the redirects, the 401 bodies, the security headers,
the cookie flags and the CSRF refusals against the running process.

Whether a screen visibly *fills* its panels needs a real browser, because the data
arrives after hydration. Point Playwright at the same list when you want that.

### Cron

```cron
30  2 * * *  cd /srv/roadmap-tracker && ./scripts/backup.sh                                    >> /var/log/roadmap/backup.log 2>&1
10  3 * * *  cd /srv/roadmap-tracker && npx tsx scripts/check-links.mjs                        >> /var/log/roadmap/links.log  2>&1
40  3 * * *  cd /srv/roadmap-tracker && npx tsx scripts/export-all.mjs                         >> /var/log/roadmap/export.log 2>&1
0,30 * * * *  cd /srv/roadmap-tracker && npx tsx scripts/sync-github.mjs                       >> /var/log/roadmap/github.log 2>&1
30 18 * * 6  cd /srv/roadmap-tracker && npx tsx scripts/weekly-digest.mjs --out=backups/digest-latest.md >> /var/log/roadmap/digest.log 2>&1
```

`sync-github.mjs` exits **2** when a rate limit stopped it, so cron can treat that
as "try later" rather than as a failure.

## The screens

`/` Today · `/calendar` · `/weeks` and `/weeks/:n` · `/dsa` · `/library` ·
`/projects` · `/gates` · `/sundays` · `/pushes` · `/money` · `/applications` ·
`/ladder` · `/roles` · `/eligibility` · `/after` · `/newzealand` ·
`/everything` · `/stats` · `/profile` · `/review` · `/reference` · `/print/week`

`/everything` exists to prove nothing was lost: every trackable item in the
roadmap in one list, grouped by the part of `final.md` it came from.

## Layout

```
/app           the App Router
  layout.tsx     the document, the theme before first paint
  (app)/         one folder per screen: page.tsx plus its client island
  api/           one route.ts per endpoint, the whole JSON surface
  globals.css    the design tokens and the base layer
  design.css     the shell and every reusable component class
  screens.css    the rules that belong to exactly one screen
/components    the shell, the primitives, the providers
  ui/            Table, Charts, Basics, Controls, Fill, useResource
/lib           all business logic, all SQL, all auth
  db/            the pool and the data access modules
  server/        session, csrf, auth, rate limits, validation, route wrapper
  client/        the api client, the offline queue, formatting
/middleware.ts the Content Security Policy, with a per request nonce
/data          final.md, the Striver step list, the password blocklist
/docs          PARSE-REPORT.md, ADDITIONS.md, RUNBOOK.md, QA-REPORT.md, BUILD-PROMPT.md
/migrations    001_init.sql, three generated seed files, 005_hardening.sql
/scripts       the parser, the verifier, and the operational scripts
/public        img/, sw.js, manifest.webmanifest  — same origin
/tests         node:test through tsx, no test framework dependency
/backups       dumps and exports, git ignored
```

## Security

- Argon2id at the OWASP parameters (m=19456, t=2, p=1), which is also the
  interview answer.
- Sessions in MySQL, cookie `HttpOnly` and `SameSite=Lax`, rolling 30 days, and
  the id is regenerated on sign in so a planted id carries no authority.
- CSRF on every state changing request, double submit plus an `Origin` check. A
  POST without a token gets 403.
- A CSP with a **per request nonce**, so no inline script runs unless this server
  put it there. `style-src-attr` is `'none'`: no style attribute is ever written
  into markup, and dynamic geometry such as a meter width is applied from script.
- Every query is parameterised; `multipleStatements` is off.
- The GitHub token is encrypted at rest with `TOKEN_ENC_KEY` and is write only.
  No response returns it, not even masked.
- Changing the password ends every other session for that account.
- Signup closes itself after the first account unless `ALLOW_SIGNUP` says
  otherwise, and a user count that cannot be read fails **closed**.
- The app binds to `127.0.0.1`. Put nginx or the host's router in front of it.
  There is no authentication on the network interface itself, so **do not expose
  the port directly**.

## Your data

`GET /api/export/:table.csv` and `GET /api/export/all.json` export everything you
own, and `scripts/export-all.mjs` writes the same set to disk with a
`MANIFEST.txt` that explains each file. The export is deliberately readable
without this application: if the app is gone, the CSV files are still the record.

## Licence and scope

Private, single user, not a product. It tracks one person's 150 days.
