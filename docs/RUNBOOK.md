# RUNBOOK.md

What to do when something needs doing. Written for the person who has to fix it
at 23:00 with the streak on the line.

Every command assumes you are in the project root and `.env` is filled in.

The scripts under `scripts/` import the TypeScript modules in `lib/`, so they run
through `tsx`: **`npx tsx scripts/NAME.mjs`, never `node scripts/NAME.mjs`**, which
fails with `ERR_MODULE_NOT_FOUND`. The `npm run` entries already do this. That also
means `tsx` and `typescript` are needed at run time on the server even though they
are devDependencies, which is why no `npm ci` here uses `--omit=dev`. Auditing with
`--omit=dev` is a different question and is still right.

---

## 0. Is it actually broken?

```bash
curl -s http://127.0.0.1:3000/api/healthz
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/login
```

`/api/healthz` needs no session and answers the only question that matters first:

```json
{ "ok": true, "data": { "db": "up", "today": "2026-08-29", "block": "LEARN", "env": "production" } }
```

It answers **503** with `"db": "down"` when MySQL cannot be reached, which is what
the container health check and any monitor should watch. `/healthz` is kept as an
alias, so an existing nginx or monitor configuration still works.

`200` from `/login` and `"db": "up"` means the stack is up. Every other endpoint
answers **401** without a session, which is correct, not a fault.

To ask the database directly, without the application:

```bash
npx tsx -e "import('./lib/db/pool.ts').then(async m => { console.log('db:', await m.ping()); await m.closePool(); })"
```

Where the logs are:

- the server writes to stdout, so `journalctl -u roadmap-tracker` or the
  container log
- `link_check_runs`, `dsa_imports` and `backup_log` are the audit trail for the
  scripts, and `audit_log` for the app

---

## 1. Restore from a dump

The only reason backups exist. Do this at least once before you need it.

```bash
# 1. Find the dump. They are named roadmap_tracker-YYYY-MM-DD-HHMM.sql.gz
ls -lh backups/*.sql.gz

# 2. Confirm it is complete before you trust it
gzip -t backups/roadmap_tracker-2026-08-28-0230.sql.gz && echo 'archive ok'
gunzip -c backups/roadmap_tracker-2026-08-28-0230.sql.gz | tail -3   # expect "Dump completed"

# 3. Restore into a scratch database first. Never straight over the live one.
mysql -h 127.0.0.1 -u root -p -e "CREATE DATABASE roadmap_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
gunzip -c backups/roadmap_tracker-2026-08-28-0230.sql.gz | mysql -h 127.0.0.1 -u root -p roadmap_restore_test

# 4. Check it against the contract
DB_NAME=roadmap_restore_test npm run verify

# 5. Take a dump of the live database as it stands, before you drop it.
#    Step 4 proves the archive restores; it cannot prove the archive is the copy
#    you meant. Once the DROP has run, the current state is gone, so this is the
#    only way back if the wrong file was chosen.
systemctl stop roadmap-tracker         # or: docker compose stop app
./scripts/backup.sh                    # bash and mysqldump only, no Node needed
ls -lt backups/*.sql.gz | head -2      # the newest file is the pre-drop copy

# 6. Only now, swap for real. The app is already stopped, so nothing writes
#    during the restore.
mysql -h 127.0.0.1 -u root -p -e "DROP DATABASE roadmap_tracker; CREATE DATABASE roadmap_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
gunzip -c backups/roadmap_tracker-2026-08-28-0230.sql.gz | mysql -h 127.0.0.1 -u root -p roadmap_tracker
npm run verify
systemctl start roadmap-tracker
```

The dump carries `--routines --triggers --events`. That matters: the money hour
rule and the seven day retroactive limit are enforced by database triggers as
well as by application code. A restore without them gives you a database that
quietly allows what `final.md` forbids. If you restored from a dump made some
other way, check:

```sql
SHOW TRIGGERS FROM roadmap_tracker;
```

**A dump taken before 31 August 2026 carries the pre-005 triggers.** Restoring one
reinstates `trg_day_logs_no_backdate_upd` in its original, too-wide form, which
refuses the application's own derived recomputation on any day older than seven
days. After restoring an old dump, re-apply the migration:

```bash
npx tsx scripts/migrate.mjs --status      # 005_hardening.sql will show as pending
npm run migrate
```

Section 13 explains what that trigger does and does not block.

**Lost sessions are expected.** Restoring drops the `sessions` table contents, so
everyone signs in again. That is not damage.

---

## 2. Rotate the session secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the new value in `SESSION_SECRET` in `.env` and restart.

Every existing session cookie stops validating immediately, so you will be signed
out. That is the intended effect of a rotation. Nothing else is lost: sessions are
disposable, and clearing the table is safe.

```sql
-- optional, tidies rows that can no longer be validated anyway
DELETE FROM sessions;
```

Rotate it when: the value was ever pasted anywhere, `.env` was shared, or a
machine that held it was lost.

---

## 3. Revoke and replace the GitHub token

Do the revocation first. A token you are replacing because it leaked is still
live until GitHub says otherwise.

1. **Revoke at GitHub.** Settings, Developer settings, Personal access tokens,
   delete the token. If it might have been public, also check
   Settings, Security log for use you did not perform.

2. **Clear it locally.** `/profile` has a remove control. If you would rather do
   it in SQL:

   ```sql
   UPDATE profiles SET github_token = NULL WHERE user_id = 1;
   DELETE FROM github_sync_state WHERE user_id = 1;   -- drops stale ETags too
   ```

3. **Create a new fine grained token.** Read only. It needs `Contents: read` and
   `Metadata: read` on the repositories that count, and nothing else. This app
   never writes to GitHub.

4. **Store it** on `/profile`. It is encrypted with `TOKEN_ENC_KEY` before it
   reaches the database.

5. **Confirm the mode changed:**

   ```bash
   npx tsx scripts/sync-github.mjs --user=you@example.com
   ```

   The report should say `mode authenticated` and a budget of 5,000 an hour. If it
   still says `anonymous`, the token did not save.

**If `TOKEN_ENC_KEY` itself has to change**, the stored token cannot be decrypted
with the new key. Clear it first (step 2), change the key, restart, then store the
token again. There is no migration path and there should not be one.

---

## 4. Re-run the seed safely

The seed is idempotent by design: `001_init.sql` uses `CREATE TABLE IF NOT
EXISTS`, and the seed files upsert reference rows. Your progress lives in
different tables and is not touched.

```bash
npm run parse      # rewrites the SQL from final.md, updates docs/PARSE-REPORT.md
npm run migrate    # applies anything not yet in migrations_applied
npm run verify     # the contract. Exit 1 means stop.
```

Before you do it on live data, take a dump:

```bash
./scripts/backup.sh          # or: npm run backup
```

**What re-seeding will not do:** it will not delete `day_logs`, `dsa_progress`,
`applications`, `deals`, `github_pushes`, `study_sessions` or anything else you
entered. If a change to `final.md` removes a reference row that your progress
points at, the foreign keys are `ON DELETE CASCADE` and that progress row goes
with it. So when you edit `final.md`, dump first.

If you edited `final.md`, expect `PARSE-REPORT.md` to change: the SHA-256 of the
source is recorded there, and a different hash with identical counts is the normal
result of a wording fix.

---

## 5. When the seed verification fails

`npm run verify` exits 1 and names the table, the expected count and the actual
count. Work through it in this order.

**a. Read which direction it is wrong.**

- *Actual is 0* — the migration did not run, or it ran against a different
  database. Check `DB_NAME`, then `SELECT * FROM migrations_applied;`.
- *Actual is lower than expected* — the parser dropped rows. Usually a heading in
  `final.md` was renamed, so a section no longer matches.
- *Actual is higher than expected* — the seed ran twice into a table without a
  unique key, or Appendix E was edited without the body of the document.

**b. Find out whether the parser or the document changed.**

```bash
npm run parse                       # writes docs/PARSE-REPORT.md
git diff docs/PARSE-REPORT.md       # if this is a git repo
```

`PARSE-REPORT.md` holds the SHA-256 of `data/final.md`. If the hash moved, the
document changed and Appendix E has to agree with the change. **Appendix E is the
contract: fix the document, never the expected number in the code.**

**c. Reset only the reference data if you must.**

```bash
./scripts/backup.sh
mysql -u root -p roadmap_tracker -e "SELECT COUNT(*) FROM day_logs;"   # know what you are risking
```

Then drop and re-create the database and run `npm run setup`. Restore your
progress tables from the dump afterwards. This is the last resort, not the first
move.

**d. `dsa_problems` reporting 0 is not a failure.** The verifier treats it as
deferred, because `final.md` does not contain the 474 problem names. See section 6.

---

## 6. Import the 474 DSA problems

```bash
npx tsx scripts/import-dsa.mjs export.csv                 # dry run, always first
npx tsx scripts/import-dsa.mjs export.csv --write          # after the report looks right
npx tsx scripts/import-dsa.mjs export.csv --write --user=you@example.com   # also import solved status
```

The column mapping is printed on every run and documented at the top of the
script. The importer refuses to write unless the counts match Appendix E, which is
474 total, 152 easy, 186 medium and 136 hard. `--allow-partial` overrides that
when you know the export is a subset.

It matches existing rows on **(topic, problem name)**, never on row order, so
re-importing a longer export later adds the new rows and leaves `dsa_progress`
alone. Nothing is ever deleted.

A row whose topic does not match one of the 18 steps is skipped and reported. A
nineteenth step would be an invention.

---

## 7. A link went dead

```bash
npx tsx scripts/check-links.mjs --dry-run --limit=20   # see the shape of it
npx tsx scripts/check-links.mjs                        # write is_alive and last_checked
```

The rule is fixed: **a dead link is flagged, never deleted.** The checker
cross references Appendix A of `final.md`, so if a replacement is already on file
it prints it. When it is not:

1. Find the new address.
2. Add it to Appendix A of `data/final.md`.
3. `npm run setup`.

Some hosts answer `HEAD` with 403 or 405 and serve `GET` perfectly well. The
checker retries those once with a ranged `GET`, so a server quirk is not recorded
as a broken resource. Rate is one request per second and the timeout is ten
seconds; `--delay` cannot go below 1000 ms.

---

## 8. GitHub sync is not picking up pushes

Run it directly and read the report:

```bash
npx tsx scripts/sync-github.mjs --user=you@example.com
```

- **`no username`** — set the GitHub username on `/profile`.
- **`mode anonymous`** — no token. 60 requests an hour for the whole IP. Seven
  requests a run at a 30 minute cron is 14 an hour, which fits, but a token
  removes the worry.
- **exit code 2** — a rate limit stopped the run. Nothing was hammered. The
  reset time is in the report and in `github_sync_state.rate_reset_at`.
- **`free replies`** high and `pushes stored` zero — that is ETags working. The
  responses were 304 and cost nothing. There genuinely were no new commits.
- **404 on a repository** — it does not exist yet, or it is private and there is
  no token.

To force a full re-read of history, drop the stored ETags:

```sql
DELETE FROM github_sync_state WHERE user_id = 1;
```

Then `npx tsx scripts/sync-github.mjs --since=2026-08-28`.

Manual entry on `/pushes` always works. A sync that cannot run is an
inconvenience, never a dead end.

---

## 9. Get all the data out

```bash
npx tsx scripts/export-all.mjs --dry-run       # list what would be written
npx tsx scripts/export-all.mjs --zip           # CSV + all.json + MANIFEST.txt, zipped
```

Or from the app: `GET /api/export/all.json` and `GET /api/export/:table.csv`.

The table list is shared between the API and the script
(`lib/exportTables.ts`), so nothing can be exportable in one and missing from
the other.

---

## 10. Deploy a change

```bash
npm test                    # 518 tests. 60 skip without a server, which is section 1 of the QA report
npm run verify              # the seed contract still holds
./scripts/backup.sh         # before, not after
git pull
npm ci                      # NOT --omit=dev. tsx and typescript are devDependencies,
                            # and npm run verify below and four of the five cron
                            # jobs all run through tsx
npm run build               # nothing you pulled is live until this runs
npm run verify              # again, in case the pull carried a migration
systemctl restart roadmap-tracker
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/login   # expect 200
```

`npm ci --omit=dev` is the right instinct on a server and the wrong command here,
because it removes the runtime every operational script needs. The `npm run verify`
above would fail with `tsx: not found`, and so would the link check, the export, the
GitHub sync and the digest. Only `scripts/backup.sh` survives it, being bash and
`mysqldump`. `npm audit --omit=dev` is still the right way to audit the production
tree: auditing and installing are different questions.

If `npm test` reports the HTTP tests as skipped, no server was listening. Start
one and run it again to get that coverage.

To prove the whole surface answers against the real database, not just that the
wiring is consistent, run the smoke test with the server up:

```bash
npm run smoke -- --email=you@example.com --password=...
```

It signs in as a real account, then asserts that all 23 pages answer 200 carrying
their own heading, that all 34 read endpoints return the keys their screen reads,
that nothing private is reachable without a session, and that a write without a
CSRF token is refused. It writes nothing but the session row, which it deletes.

It does not check that a screen visibly fills its panels: the data arrives after
hydration, so that needs a real browser. Point Playwright at the same list when you
want that.

---

## 11. Time is wrong on a screen

Everything user facing is a plain `YYYY-MM-DD` string, and "today" is computed
server side in `Asia/Kolkata`. The client clock is never trusted for anything that
writes.

To test a specific day, set `FAKE_TODAY` in `.env` and restart:

```
FAKE_TODAY=2026-12-13     # Gate 3
FAKE_TIME=17:30           # inside the money hour
```

**Unset both before you go back to using it for real.** The application says
plainly when it is running on a fake clock, but a forgotten `FAKE_TODAY` will
happily let you log the wrong day.

If dates look shifted by one, check that the pool still sets
`time_zone = '+05:30'` and that `dateStrings` is still on in `lib/db/pool.ts`.
Those two settings are the reason a calendar date can never drift.


---

## 12. Going onto the internet

Work top to bottom. All of this was checked before the first deployment, and is
worth re-checking after any change to `.env` or `next.config.ts`.

### 12.1 The environment

`.env.example` carries the full list at the bottom of the file. The four that
actually change behaviour:

| Variable | Value | What it turns on |
| --- | --- | --- |
| `NODE_ENV` | `production` | `secure` on the session cookie, HSTS for a year, `upgrade-insecure-requests`, and **`TOKEN_ENC_KEY` becomes mandatory** |
| `TRUST_PROXY` | `1` | `req.ip` is the real client, so the rate limiters count per visitor |
| `PUBLIC_ORIGIN` | `https://your-domain` | absolute URLs in the ICS export and the manifest |
| `HOST` | `127.0.0.1` | leave it. The proxy reaches it on loopback |

Rotate `DB_PASSWORD`, `SESSION_SECRET` and `TOKEN_ENC_KEY` to fresh values. The
development ones have been sitting on a laptop.

### 12.2 The proxy must overwrite X-Forwarded-For

`TRUST_PROXY=1` tells `lib/server/rateLimit.ts` to believe that header. If the
proxy *appends* to whatever the client sent rather than replacing it, a visitor can
put any address they like at the front and the login rate limiter counts them as a
new person every time. In nginx:

```nginx
proxy_set_header X-Forwarded-For $remote_addr;      # set, not add
proxy_set_header X-Real-IP       $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
```

Use `$remote_addr`, not `$proxy_add_x_forwarded_for`, unless there is a further
proxy in front that you also control.

### 12.3 Account creation closes itself

`/signup` is reachable by anyone who finds it, so it is gated. With `ALLOW_SIGNUP`
unset, signup is open only while the `users` table is empty: the first run creates
the account and the door shuts behind it. After that `POST /api/auth/signup` answers
**403 `SIGNUP_CLOSED`**, and `GET /signup` answers **200 with a page that says
account creation is closed** — a person who navigated there is shown a sentence
rather than a status code — and `/login` stops offering the link.

To recreate a lost account: set `ALLOW_SIGNUP=true`, restart, sign up, then **unset
it and restart again**.

If the user count cannot be read, the gate fails **closed**. A door that opens when
the database hiccups is not a door.

### 12.4 Checks to run against the live domain

```bash
curl -sI https://your-domain/login | grep -i 'strict-transport-security\|set-cookie'
#   expect Strict-Transport-Security, and Secure; HttpOnly; SameSite=Lax

curl -s https://your-domain/robots.txt
#   expect: User-agent: *   then   Disallow: /

curl -s https://your-domain/signup | grep -i 'account creation is closed'
#   expect a match once the account exists. The page answers 200 and explains
#   itself; POST /api/auth/signup is the one that answers 403 SIGNUP_CLOSED, and a
#   bare curl POST cannot tell that apart from the 403 the missing CSRF token
#   earns, so read the page rather than the status code

curl -s -o /dev/null -w '%{http_code}\n' https://your-domain/
#   expect 302, to /login

curl -s https://your-domain/api/today
#   expect {"ok":false,"error":{"code":"UNAUTHORISED",...}}

curl -sI https://your-domain/login | grep -i 'x-powered-by'
#   expect nothing at all
```

`/healthz` is deliberately unauthenticated so the proxy can probe it. It returns
whether the database answers, today's date, the current block and `env`. No
credentials, no counts, no user data. If you would rather it were private, block it
at the proxy for everything except the health checker.

### 12.5 Dependencies

```bash
npm audit --omit=dev        # expect: found 0 vulnerabilities
npm ci                      # exactly the lockfile. Not --omit=dev: see section 10
```

Rate limiting is now written into `lib/server/rateLimit.ts` rather than taken from
a package. That removed `express-rate-limit`, and with it the `ip-address`
dependency whose two high severity advisories had to be pinned around: 8.1.0
pulled in `ip-address` 10.0.1, where `Address4` read a leading-zero octet as
decimal while a resolver reads it as octal, and the login path called
`ipKeyGenerator(req.ip)` on every attempt, so it was reachable rather than
theoretical.

The limits themselves are unchanged: five login or signup attempts per fifteen
minutes per address and per email, six GitHub syncs per five minutes, and a wide
per minute ceiling on everything else. The counters live in process memory, which
is exactly where `express-rate-limit` kept them, so the guarantee is the same and a
restart still clears them.

**One thing to know before you scale out.** Those counters are per process. Run two
instances behind nginx and the effective limit doubles. For one person's tracker
that is irrelevant; if it ever stops being one person's tracker, move the counters
into MySQL or Redis before adding the second instance.

**And one thing to know while developing.** With `TRUST_PROXY=0` there is no
per-visitor address to key on, so `clientIp` returns the literal `local` and every
caller shares one bucket. Five attempts at the login form on your own machine
therefore locks that machine out for fifteen minutes, and the message is
indistinguishable from the application being broken. Two settings exist for this:

```
AUTH_RATE_LIMIT_MAX=50
AUTH_RATE_LIMIT_WINDOW_MINUTES=1
```

Unset, they are 5 and 15, which is section 5.3. Raising them weakens brute force
protection, so leave them unset in production. A restart clears the counters
regardless, because they are in memory.

If you are locked out and cannot wait, restart the process. If you are locked out of
the account itself, `scripts/reset-password.mjs` is in section 3.

### 12.6 What is deliberately not exposed

- There is no upload mount at all. The Express build mounted `public/uploads` as
  static, unauthenticated, against a directory that never existed. Next serves only
  what is in `public/`, and nothing writes there. If you ever add avatar uploads,
  do not put them under `public/`: anything in it is world readable by design.
- `user_settings.public_progress` and `public_slug` are stored and **nothing serves
  a public page**. Turning the switch on publishes nothing, and /profile says so in
  as many words.
- The GitHub token is encrypted at rest with `TOKEN_ENC_KEY`, and `GET /api/me`
  returns only `has_github_token`, never the value.
- Stack traces go to the server log with a timestamp. The client gets a generic
  sentence and never a trace.

### 12.7 First run on the server

```bash
cp .env.example .env && $EDITOR .env     # the production values from 12.1
# The database and its user have to exist first. No migration creates them.
mysql -u root -p -e "CREATE DATABASE roadmap_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
                     CREATE USER 'roadmap'@'localhost' IDENTIFIED BY 'the DB_PASSWORD from .env';
                     GRANT ALL ON roadmap_tracker.* TO 'roadmap'@'localhost';"
npm ci                                   # the whole lockfile, dev tree included
npm run setup                            # parse, migrate, verify
npm run build                            # npm start has nothing to serve without it
npm start                                # or the service unit
# open https://your-domain/signup, create the one account, then it closes itself
./scripts/backup.sh                      # prove a backup works before you need one
```

Two things that look like they can be trimmed and cannot. `npm ci --omit=dev`
removes `tsx`, and `npm run setup` on the very next line runs two of its three
steps through it. Skipping `npm run build` leaves `npm start` serving nothing,
because there are no files served straight from disk any more; 12.8 is the same
rule stated again.

Then add the cron entries from the README, and rehearse a restore into a scratch
database as described in section 1. A backup you have never restored is a hope.


### 12.8 Rebuild and restart after changing code

There are no files served straight from disk any more. `npm run build` compiles
everything, `npm start` serves the compiled output, and **nothing you change on
disk is live until you do both**:

```bash
npm run build && npm start        # or: docker compose up --build -d app
```

In development `npm run dev` recompiles on save and needs neither.

The hazard the Express build had is smaller but has not gone. There, the client
picked up a new module immediately while the server kept the old handler, and that
produced exactly one bug: `/roles` was extended to return `applications`,
`where_to_apply`, `interview_prep`, `resume_stages` and `unlocks`, the browser
loaded the new screen, the server returned the old payload, and the screen died on
`Cannot read properties of undefined (reading 'total')`.

A Next build compiles the screen and the route together, so those two cannot
disagree **within one deployment**. They can still disagree across one: a browser
holding an old page open talks to a new server, or the service worker in 12.9
serves a cached page. To tell whether a running server is stale:

```bash
# when the process started
ps -o lstart= -p "$(pgrep -f 'next start|node server.js' | head -1)"
# when the build was produced
stat -c '%y' .next/BUILD_ID
```

If `BUILD_ID` is newer than the process, restart it. If your source is newer than
`BUILD_ID`, you have not rebuilt.

Screens are still written to survive a mismatch: each one normalises the payload
and renders its panels independently, so a field the server does not send costs one
panel and a plain explanation, not the page. That is a safety net, not a substitute
for the rebuild.

### 12.9 The service worker cache

`public/sw.js` is the offline shell. Two caches, and what happens to each on a
release is different:

- **the build output**, everything under `/_next/static/`, is cached on first use
  and never revalidated, which is safe because every one of those filenames
  carries a content hash. A new build produces new names, so there is nothing
  stale to serve.
- **pages** are network first. A reload gets the new HTML whenever the server is
  reachable, and the cached copy is only used when it is not. `/login` and `/signup`
  are never cached, and signing out deletes the whole page cache: without that, the
  last seen HTML of every screen stayed readable on the device after sign out.
- **the icons and the manifest** are the only fixed URLs, and they are cache first.

That is the one thing a release can leave stale, and it is why `VERSION` exists.

**Bump `VERSION` in `public/sw.js` when you change an icon or the manifest**, or when
you change the caching rules themselves, because the bump is what evicts the existing
caches on activate. It is at the top of the file with a changelog comment. Currently
`v4`, where the bump was part of a fix rather than housekeeping: it is what removed
the page caches written before signing out started clearing them. The Express build
needed a bump on every CSS or JS change; this one does not, because those files are
hashed.

To clear it by hand while developing: DevTools, Application, Service Workers,
Unregister, then hard reload.

---

## 13. "Retroactive editing is limited to 7 days", or the timer will not start

Both of these come from `day_logs` and `study_sessions`, and both changed in
`migrations/005_hardening.sql`. If you are seeing either symptom on a database that
predates 31 August 2026, check that 005 is applied before anything else:

```bash
npx tsx scripts/migrate.mjs --status
```

### 13.1 What the seven day rule blocks, and what it does not

Part 18.7 rule 3 says a day older than seven days cannot be edited retroactively.
Two triggers enforce it, and they are not symmetrical.

| Trigger | Fires on | Behaviour |
| --- | --- | --- |
| `trg_day_logs_no_backdate_ins` | INSERT | Refuses to create a `day_logs` row dated more than seven days ago. Unchanged by 005 |
| `trg_day_logs_no_backdate_upd` | UPDATE | Refuses an update to a row older than seven days **only when a column a person enters actually changes** |

Before 005 the UPDATE trigger rejected every update to such a row, whatever the
column. That was too wide, because the application updates those rows itself:
`recomputeDay()` writes `pushes`, `money_touches`, `day_colour`, `conditions_met`
and `week_n`, all of which are projections of other tables rather than history, and
`recomputeRange()` walks the whole 150 day window whenever the GitHub sync runs, a
repository is added or reclassified, or the start date moves. From the eighth day of
real use each of those would have raised SQLSTATE 45000 and surfaced as a 500.

So the rule now reads:

- **Blocked**, with `Retroactive editing is limited to 7 days`: any change to
  `dsa_solved`, the four block done flags and their minutes, the close and night
  fields, `money_done`, `money_minutes`, `anki_overdue`, `video_minutes`,
  `blocked_on`, `notes`, and the row's own `log_date` or `user_id`. Setting one of
  those to `NULL` is blocked too: the comparison is the null safe `<=>`, so it is
  not fooled the way a plain `!=` would be.
- **Allowed**: `pushes`, `money_touches`, `day_colour`, `conditions_met`, `week_n`,
  and the id and timestamp columns. A GitHub sync that repaints a day in October is
  not a person rewriting it.
- **Allowed**: an UPDATE that sets a human column to the value it already holds.
  Nothing changed, so nothing is refused.

`tests/triggers.test.mjs` pins both halves against the trigger body read verbatim
out of the migration, so a future edit that widens it again fails the suite.

If you genuinely have to correct an old day, the honest route is a row in
`audit_log` and a note, not a wider trigger. The rule is from the document.

### 13.2 The timer says a session is already running

`POST /api/sessions/start` refuses when a session is already open **on today's
date**, and that refusal is correct: stop the one you are running before starting
another.

A session left open on an **earlier** date is closed automatically instead, with
`auto_closed = 1` and zero minutes, and the response says which one it closed.
Nobody can say how long an abandoned timer was really used, so it credits nothing.
That path exists because the old behaviour was a dead end: the only way to close
yesterday's session was `POST /api/sessions/:id/stop`, which credits its minutes to
its own date, and on a date the seven day rule has sealed that INSERT failed and
rolled the whole transaction back, leaving `ended_at` NULL and the timer bricked
with no route out except SQL.

Stopping a session dated outside the editable window now closes it and marks it
`auto_closed` without touching the day log, and says so in the response.

Two open timers can no longer exist at all: `uq_session_open_one` is a UNIQUE key
over a generated column that holds the user id only while a row is open, so a double
tap is refused by MySQL rather than by a check that a race can slip past. To see
what is open:

```sql
SELECT id, block, session_date, started_at, auto_closed
  FROM study_sessions
 WHERE user_id = 1 AND ended_at IS NULL;
```

If one is stuck and the API will not close it, closing it by hand is safe, because
a zero minute session credits nothing:

```sql
UPDATE study_sessions
   SET ended_at = started_at, minutes = 0, auto_closed = 1
 WHERE id = ? AND user_id = 1 AND ended_at IS NULL;
```
