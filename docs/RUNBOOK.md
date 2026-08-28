# RUNBOOK.md

What to do when something needs doing. Written for the person who has to fix it
at 23:00 with the streak on the line.

Every command assumes you are in the project root and `.env` is filled in.

---

## 0. Is it actually broken?

```bash
node -e "import('./src/db/pool.mjs').then(async m => { console.log('db:', await m.ping()); await m.closePool(); })"
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/login
```

`200` from `/login` and `db: true` means the stack is up. `/api/health` answers
**401** without a session, which is correct, not a fault.

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

# 5. Only when that passes, swap for real
#    Stop the app first, so nothing writes during the restore.
systemctl stop roadmap-tracker         # or: docker compose stop app
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
   node scripts/sync-github.mjs --user=you@example.com
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
node scripts/import-dsa.mjs export.csv                 # dry run, always first
node scripts/import-dsa.mjs export.csv --write          # after the report looks right
node scripts/import-dsa.mjs export.csv --write --user=you@example.com   # also import solved status
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
node scripts/check-links.mjs --dry-run --limit=20   # see the shape of it
node scripts/check-links.mjs                        # write is_alive and last_checked
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
node scripts/sync-github.mjs --user=you@example.com
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

Then `node scripts/sync-github.mjs --since=2026-08-28`.

Manual entry on `/pushes` always works. A sync that cannot run is an
inconvenience, never a dead end.

---

## 9. Get all the data out

```bash
node scripts/export-all.mjs --dry-run       # list what would be written
node scripts/export-all.mjs --zip           # CSV + all.json + MANIFEST.txt, zipped
```

Or from the app: `GET /api/export/all.json` and `GET /api/export/:table.csv`.

The table list is shared between the API and the script
(`src/lib/exportTables.mjs`), so nothing can be exportable in one and missing from
the other.

---

## 10. Deploy a change

```bash
npm test                    # 500+ tests, and they are fast
npm run verify              # the seed contract still holds
./scripts/backup.sh         # before, not after
git pull && npm ci --omit=dev
systemctl restart roadmap-tracker
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/login   # expect 200
```

If `npm test` reports the HTTP tests as skipped, no server was listening. Start
one and run it again to get that coverage.

To prove the screens actually draw against the real database, not just that their
wiring is consistent, run the end to end harness with the server up:

```bash
npm install linkedom --no-save
node scripts/smoke-screens.mjs
```

It signs up a throwaway account, drives all 23 pages, asserts every container
filled, and deletes the account again. Expect the last line to read
`23 of 23 screens filled every container.`

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
`time_zone = '+05:30'` and that `dateStrings` is still on in `src/db/pool.mjs`.
Those two settings are the reason a calendar date can never drift.


---

## 12. Going onto the internet

Work top to bottom. All of this was checked before the first deployment, and is
worth re-checking after any change to `.env` or `src/server.mjs`.

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

`TRUST_PROXY=1` tells Express to believe that header. If the proxy *appends* to
whatever the client sent rather than replacing it, a visitor can put any address
they like at the front and the login rate limiter counts them as a new person every
time. In nginx:

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
the account and the door shuts behind it. After that both `GET /signup` and
`POST /api/auth/signup` answer **403 `SIGNUP_CLOSED`**, and `/login` stops offering
the link.

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

curl -s -o /dev/null -w '%{http_code}\n' https://your-domain/signup
#   expect 403 once the account exists

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
npm ci --omit=dev           # exactly the lockfile, no dev tree
```

`express-rate-limit` is pinned at **8.6.2** for a reason. 8.1.0 pulled in
`ip-address` 10.0.1, which carries two high severity advisories. One of them has
`Address4` read a leading-zero octet as decimal where a resolver reads it as octal,
and this application calls `ipKeyGenerator(req.ip)` on every login attempt, so it
was reachable rather than theoretical. Do not pin it back.

### 12.6 What is deliberately not exposed

- `public/uploads` is mounted as static, but the directory does not exist and no
  route writes to it, so nothing is served. If you ever add avatar uploads,
  remember that mount is **unauthenticated**: put the files elsewhere or guard it.
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
npm ci --omit=dev
npm run setup                            # parse, migrate, verify
npm start                                # or the service unit
# open https://your-domain/signup, create the one account, then it closes itself
./scripts/backup.sh                      # prove a backup works before you need one
```

Then add the cron entries from the README, and rehearse a restore into a scratch
database as described in section 1. A backup you have never restored is a hope.


### 12.8 Restart after changing anything under src/

Static files are served from disk, so a change to `public/js` or `public/css` is
live on the next request, subject to the service worker cache in 12.9. **Server
code is not.** `src/**` is loaded once at boot, so a changed route handler keeps
serving the old response until the process restarts.

This is not theoretical. It produced exactly one bug: `/roles` was extended to
return `applications`, `where_to_apply`, `interview_prep`, `resume_stages` and
`unlocks`, the browser picked up the new module immediately, the server kept
returning the old payload, and the screen died on
`Cannot read properties of undefined (reading 'total')`.

To tell whether a running server is stale:

```bash
# when the process started
ps -o lstart= -p "$(pgrep -f 'node src/server.mjs' | head -1)"
# when the server code last changed
find src -name '*.mjs' -newermt "$(ps -o lstart= -p "$(pgrep -f 'node src/server.mjs' | head -1)")" | head
```

Anything listed is newer than the running process. Restart it.

Screens are written to survive this: each one normalises the payload and mounts its
panels independently, so a field the server does not send costs one panel and a
plain explanation, not the page. That is a safety net, not a substitute for the
restart.

### 12.9 The service worker cache

`public/js/sw.js` serves everything under `/css` and `/js` **cache first**, and only
evicts when its `VERSION` constant changes. A CSS or JS change is therefore
invisible to a browser that has visited before, however many times you reload.

**Bump `VERSION` in `public/js/sw.js` on every release that touches `public/`.**
It is at the top of the file with a changelog comment. Currently `v2`.

To clear it by hand while developing: DevTools, Application, Service Workers,
Unregister, then hard reload.
