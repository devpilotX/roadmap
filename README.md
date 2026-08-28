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

- **Node 24, Express 5, MySQL 8, EJS, vanilla ES modules.** No build step, no
  bundler, no framework on the client. One origin, so no CORS.
- **Everything is seeded from `final.md`.** A parser reads the document, a
  migration writes the rows, and a verifier refuses to pass unless the row counts
  match Appendix E of the document exactly.
- **Nothing is invented.** The clearest case is DSA: `final.md` names the Striver
  A2Z sheet and its 474 problems but does not list them, so this app ships the 18
  step names and nothing more. Problem names arrive from a real tracker export
  through `scripts/import-dsa.mjs`, and until they do, `/dsa` says plainly that
  problem level import is pending.

## Getting started

```bash
cp .env.example .env          # then fill in DB_* and the two secrets
npm install
npm run setup                 # parse final.md, migrate, verify the counts
npm start                     # http://127.0.0.1:3000
```

`npm run setup` is three steps and the third one is the important one: it fails
loudly if a single Appendix E count is off.

Generate the two secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`SESSION_SECRET` signs the session cookie. `TOKEN_ENC_KEY` encrypts the GitHub
token at rest and is **required** in production, because a token cannot be stored
without it.

### With Docker

```bash
cp .env.example .env          # set DB_HOST=db and a real DB_PASSWORD
docker compose up --build
docker compose exec app npm run setup
```

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Run the server |
| `npm run dev` | Run with `--watch` |
| `npm run parse` | Parse `final.md` into SQL and write `docs/PARSE-REPORT.md` |
| `npm run migrate` | Apply `migrations/*.sql` |
| `npm run verify` | Check every row count against Appendix E. Exit 1 on a mismatch |
| `npm run setup` | parse, migrate, verify, in that order |
| `npm test` | The full test suite, `node --test` |
| `npm run check-links` | HEAD every resource and week link, flag the dead ones || `npm run sync-github` | Pull commits into the push tracker |
| `npm run import-dsa` | Import a Striver A2Z or Codolio CSV export |
| `npm run export-all` | Every table to CSV and JSON on disk |
| `npm run digest` | The Saturday review as Markdown |
| `npm run backup` | mysqldump, verified and pruned |

Every script takes `--help`-style behaviour: run it with no arguments or with
`--dry-run` first. None of them write anything in a dry run.

### Verifying the screens really draw

`npm test` includes 192 static checks over the 24 client screen modules: that each
mounts only to ids its view declares, calls only registered API paths, imports only
real exports, and never leaves a panel on "Loading". To prove they draw against the
real database, start the server and run the end to end harness:

```bash
npm install linkedom --no-save     # dev only, deliberately not a dependency
node scripts/smoke-screens.mjs
```

It signs up a throwaway account, drives all 23 pages with a real session, asserts
every container filled, then deletes the account.

### Cron

```cron
30  2 * * *  cd /srv/roadmap-tracker && ./scripts/backup.sh                        >> /var/log/roadmap/backup.log 2>&1
10  3 * * *  cd /srv/roadmap-tracker && node scripts/check-links.mjs               >> /var/log/roadmap/links.log  2>&1
40  3 * * *  cd /srv/roadmap-tracker && node scripts/export-all.mjs                >> /var/log/roadmap/export.log 2>&1
0,30 * * * *  cd /srv/roadmap-tracker && node scripts/sync-github.mjs              >> /var/log/roadmap/github.log 2>&1
30 18 * * 6  cd /srv/roadmap-tracker && node scripts/weekly-digest.mjs --out=backups/digest-latest.md >> /var/log/roadmap/digest.log 2>&1
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
/data          final.md, the Striver step list, the password blocklist
/docs          PARSE-REPORT.md, ADDITIONS.md, RUNBOOK.md, QA-REPORT.md, BUILD-PROMPT.md
/migrations    001_init.sql and the three seed files
/scripts       the parser, the verifier, and the five operational scripts
/src           server.mjs, db/, routes/, middleware/, lib/, config.mjs
/public        css/, js/, img/  — served by Express, same origin
/views         layout partials and one EJS file per screen
/tests         node --test, no test framework dependency
/backups       dumps and exports, git ignored
```

## Security

- Argon2id at the OWASP parameters (m=19456, t=2, p=1), which is also the
  interview answer.
- Sessions in MySQL, cookie `HttpOnly` and `SameSite=Lax`.
- CSRF on every state changing request. A POST without a token gets 403.
- helmet, with a CSP that allows no inline script and no `eval`.
- Every query is parameterised; `multipleStatements` is off.
- The GitHub token is encrypted at rest with `TOKEN_ENC_KEY`.
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
