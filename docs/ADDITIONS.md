# ADDITIONS.md

Everything in this application that is **not** in `final.md`, and why it is here.

Section 22 of the build prompt sets the rule: anything added has to be written
down with what it is, why it exists, which part of `final.md` it serves, and how to
remove it if it turns out to be noise. That is the format below.

The test for each of these was the same one the build prompt states: does it make
the daily checkbox faster to tick, or the daily number harder to fake? Anything
that did neither is not here.

---

## 1. `dsa_topics`, the 18 Striver step names

**What.** `data/striver-a2z-topics.json` holds the 18 step names of the Striver
A2Z sheet, and they are seeded into `dsa_topics`.

**Why.** Part 3, C14 of `final.md` names the sheet and its split of 474 problems
into 152 easy, 186 medium and 136 hard, but it does not list the steps or the
problems. Without the step names, `/dsa` has nothing to group progress by before a
CSV import happens, and day one of a 150 day plan would show an empty screen.

**Serves.** Part 3 C14, and Part 18.3, the DSA tracking contract.

**The line that was not crossed.** Step names only. No problem names. The file
records where the step list came from and the date it was checked, and
`scripts/import-dsa.mjs` is the only route by which a problem name can enter the
database.

**Remove it by.** Deleting `data/striver-a2z-topics.json` and the `dsa_topics`
seed block. `/dsa` then shows day level DSA counts only, which is still the number
that the gates are judged on.

---

## 2. `scripts/lib/cli.mjs`

**What.** A small shared module for the operational scripts: argument parsing,
fixed width tables, an RFC 4180 CSV reader and writer, and a wrapper that gives
every script a real exit code and closes the pool.

**Why.** Five scripts needed the same four things. Writing them five times would
have meant five slightly different CSV readers, and the CSV reader is the front
door for problem names.

**Serves.** Part 18 as a whole, and section 8 of the build prompt.

**Remove it by.** Inlining what each script uses. Nothing else imports it except
the tests.

---

## 3. `lib/exportTables.ts`

**What.** One list of exportable tables and one CSV writer, imported by
`app/api/export/all.json/route.ts`, `app/api/export/[name]/route.ts` and
`scripts/export-all.mjs`.

**Why.** The list existed twice, once in the API and once in the script. Two
copies means a table can become exportable in the interface and stay invisible to
the backup. Part 18.8 wants the export to be the whole thing, so there is now one
list and a test that asserts both callers produce identical CSV.

**Serves.** Part 18.8, the export contract.

**Remove it by.** Copying the map back into each caller. The test in
`tests/cli.test.mjs` that compares the two writers would go with it.

---

## 4. `scripts/backup.mjs` alongside `scripts/backup.sh`

**What.** Two implementations of the same backup. `backup.sh` is what cron calls
on the server. `backup.mjs` does the same work in Node and runs on Windows.

**Why.** The build prompt names `backup.sh`, and a shell script is the right thing
on a Linux host. But the development machine here is Windows, and a backup that
cannot be run on the machine where the data currently lives is not a backup. The
Node version was also what allowed the `backup_log` wiring to be tested for real
rather than assumed.

**Serves.** Section 20 of the build prompt, the backup and restore requirement.

**Both do the same four things.** Dump with `--single-transaction --routines
--triggers --events`, read the archive back and refuse to call it a success
without the `Dump completed` marker, prune on `BACKUP_KEEP_DAYS`, and write one row
to `backup_log` whether it worked or not.

**Remove it by.** Deleting `scripts/backup.mjs` and the `backup` entry in
`package.json`, on a host where bash is present.

---

## 5. Archive verification in the backup

**What.** Both backup scripts gunzip the dump they just wrote, count the
`CREATE TABLE` statements, and look for mysqldump's `Dump completed` marker. A
missing marker is a failure, and the failure is recorded.

**Why.** A truncated dump is silent. It has a plausible file size and it restores
most of the way. The build prompt asks for a backup that can be restored, and the
only cheap way to make that claim true is to read the file back.

**Serves.** Section 20 of the build prompt.

**Remove it by.** Passing `--quick`, which skips it per run, or deleting the
verify block.

---

## 6. Exit code 2 from `sync-github.mjs`

**What.** The GitHub sync exits 0 on success, 1 on a hard failure, and **2** when
a rate limit stopped it.

**Why.** Build prompt section 10 says never hammer the API. A 30 minute cron that
reports a rate limit as a failure produces an alert every half hour, and alerts
that fire constantly get muted. A distinct code lets cron treat it as "try later".

**Serves.** Part 18.4 and build prompt section 10.

**Remove it by.** Returning 0 instead of 2 in the `rate_limited` branch.

---

## 7. `HEAD` retried once as a ranged `GET` in the link checker

**What.** When a host answers `HEAD` with 400, 403, 405 or 501, the checker waits
one second and retries with `GET` and `Range: bytes=0-0`.

**Why.** Build prompt section 9.4 specifies `HEAD`. A number of hosts in Part 7 of
`final.md` refuse `HEAD` while serving `GET` perfectly well. Recording those as
dead would put a red badge on a working resource, and a tracker that cries wolf
gets ignored. The retry downloads one byte, so it is not a page fetch.

**Serves.** Part 7 and build prompt section 9.4.

**Remove it by.** Deleting the `HEAD_HOSTILE` set and the retry in
`scripts/check-links.mjs`.

---

## 8. `MANIFEST.txt` in every export

**What.** Each export folder gets a plain text file naming the user, the export
time, the roadmap window, and every file with its row count.

**Why.** Part 18.8 wants an export that is readable without this application. A
folder of 48 CSV files with no explanation is technically an export and
practically a puzzle.

**Serves.** Part 18.8.

**Remove it by.** Deleting the manifest block in `scripts/export-all.mjs`.

---

## 9. `tests/`, using `node --test`

**What.** 518 tests across thirteen files, run by Node's own test runner through
`tsx`.

**Why.** Section 20 of the build prompt asks for the boundaries to be tested. The
choices worth stating: no test framework was added, because Node 24 ships one and
this project has deliberately few dependencies; and the two tests that need
infrastructure skip themselves cleanly rather than failing, so the suite is useful
on a laptop with nothing running and thorough on a machine with everything up.

`tests/http.test.mjs` runs against an already listening server rather than
importing the app, because a stranger's view of the running server is the thing
worth testing: the redirects, the headers, the cookie flags and the CSRF refusals
are produced by `middleware.ts` and by Next itself, and importing route handlers
would skip every one of them. It also probes `/api/healthz` first and refuses to
run against something that is listening but is not this application, so another
project on port 3000 cannot produce a wall of false failures. The consequence is
that its 60 tests skip when nothing is up, which is 60 of the 518. The runbook and
`docs/QA-REPORT.md` both say so.

**Serves.** Section 20 of the build prompt.

**Remove it by.** Deleting `tests/` and the `test` script.

---

## 10. `docs/QA-REPORT.md`

**What.** A record of what was actually run and what it returned.

**Why.** The build prompt's completion checklist names it. It exists so that
"verified" is a citation rather than a claim.

**Serves.** Section 21 of the build prompt.

**Remove it by.** Deleting the file.

---

## 11. `tests/screens.test.mjs`

**What.** Static checks over every screen under `app/(app)`: that every `/api/...`
path a screen asks for resolves to a route file that exists and exports the method
the screen uses, that every path in the sidebar, the bottom bar and the command
palette resolves to a `page.tsx`, that no two route files claim the same URL, that
no route file exports nothing, and that no screen still points at one of the four
paths the rewrite removed.

**Why.** TypeScript cannot see a string. `useResource('/api/tday')` typechecks
perfectly and fails at runtime, and a sidebar entry pointing at a page nobody
created compiles cleanly and 404s. Those are the two silent failures left once the
screens are React components, and each of them looks exactly like "the page is
broken" to the person using it. This file catches both without a browser, a server
or a database.

**What it used to be.** In the Express build each page was an EJS view full of
empty containers plus one ES module that filled them, and this file checked that
the module mounted only to ids the view actually declared and filled every
container the view left saying "Loading". Those checks are gone because what they
guarded is gone: a container that does not exist is now a compile error.

**Serves.** Section 20 of the build prompt, and every screen in sections 12 to 14.

**Remove it by.** Deleting the file. The screens keep working; the guard rail goes.

---

## 12. `scripts/smoke.mjs`

**What.** A harness that signs in as a real account against a running server and
then, in one pass: asserts that all 23 pages answer 200 carrying their own heading
in the server rendered HTML, that all 34 read endpoints answer `{ ok: true }` with
the top level keys their screen actually reads, that an unauthenticated request is
refused rather than served, and that a state changing request with no CSRF token is
refused. Every request is a GET apart from the sign in and the two refusal probes,
so it writes nothing but the session row, which it deletes.

**Why.** The static tests prove the wiring is consistent. They cannot prove the
surface answers. This does, and it is the only check that exercises the whole path
from MySQL through the route into the rendered page.

**Serves.** Section 20 of the build prompt.

**It replaced two harnesses, and could not carry either over.** The Express build
had `scripts/smoke-screens.mjs`, which fetched a page's HTML, installed it into a
`linkedom` document and imported the screen's own ES module so its `fetch` calls hit
the real API; and `scripts/verify-screens-offline.mjs`, which rendered each EJS view
and dispatched `fetch` straight into an Express router in process. A screen is a
compiled React component now, so it cannot be imported into a fake document and made
to hydrate, and there are no EJS views and no Express routers. Both files are
deleted, and the header comment of `smoke.mjs` records the same reasoning.

**What it deliberately does not check.** Whether a screen visibly *fills* its
panels. The data arrives after hydration, so that needs a real browser; point
Playwright at the same list when you want it. Nothing here needs `linkedom` or any
other extra dependency.

```bash
npm run smoke -- --email=you@example.com --password=...
npx tsx scripts/smoke.mjs --only=money,stats
```

It signs in rather than signing up, so the account must already exist. With nothing
listening it exits 2 and says so.

**Remove it by.** Deleting the file and the `smoke` entry in `package.json`.

---

## 13. Five CSS classes that belong to more than one screen

**What.** `.milestone` and its parts, `.costheading`, `.pwwrap`, `.funnelbar` and
`.videorow` live in `app/design.css`, the sheet of reusable component classes, not
in `app/screens.css`, which holds only rules that belong to exactly one screen.

**Why.** In the Express build each page loaded exactly one screen stylesheet, and
each of these five classes was defined inside one screen's file and then used from
another: the milestone list by `/ladder` and `/newzealand`, `costheading` by
`/eligibility` and `/newzealand`, `pwwrap` by the auth pages and `/profile`,
`funnelbar` by `/applications` and `/stats`, `videorow` by `/` and `/stats`. The
second user of each got the markup with none of the styling.

**What changed with the rewrite.** `app/globals.css` imports `design.css` and
`screens.css`, and `app/layout.tsx` imports `globals.css`, so every page now loads
every rule and the original failure is structurally impossible. The split is kept
anyway, because "is this class shared" is a question worth being able to answer by
looking at which file it is in.

**Serves.** Section 15 of the build prompt, the design system.

**Remove it by.** Moving each block into `screens.css`. Nothing breaks; the
distinction between shared and single-screen rules is what is lost.

---

## 14. A failed first load is a card, a failed refresh is a toast

**What.** `useResource` in `components/ui/useResource.ts` carries an `error`
message alongside the payload, and a screen with no data and an error renders
`ErrorCard` from `components/ui/Basics.tsx` in place of the panel. A failure that
happens after the screen has already drawn is a toast instead, through
`toastError`, because the last good draw is still on screen.

**Why.** A toast disappears. On a failed first load the whole of Today used to be
left sitting on "Loading" with no explanation, on the one screen that gets opened
150 times. The two cases are genuinely different, so they are treated differently
rather than the same.

**Serves.** Section 12 of the build prompt.

**Remove it by.** Rendering the error as a toast in both cases. Every screen would
then have a silent failure mode.

---

## 15. The start date is the person's, the window is not

**What.** `profiles.roadmap_start` existed in the schema and was never read. It is
now honoured: a day inside the 150 day window but before it is **neutral**. It does
not break a streak, it is not a red day, and W1, W2, W6 and W9 stay quiet about it.
`PATCH /api/me/profile` sets it, validated to fall inside the window, and /profile
carries the control. Changing it repaints every day already on file, because
`day_colour` is stored rather than derived on read.

**Why.** The window itself cannot move. Appendix C of `final.md` lists all 150
dates, the four gates sit on named dates, and `npm run verify` enforces the counts,
so shifting the start by a day would contradict the document the application is
seeded from. But a person who opens the tracker on the first day and starts the day
after should not be greeted by a failure they had no opportunity to avoid. The
honest split: the plan's dates are fixed, the day you begin is yours.

**Serves.** Part 18.2 and Part 18.5. It changes nothing for anyone who leaves it at
the first day, which is what the seed sets.

**What is deliberately not suppressed.** W3 (a gate is close), W4 (video over the
cap), W5 (Anki overdue), W7 (applications have not started) and W8 (a problem beat
you twice) still fire. If a problem has already beaten you twice, that is true
whenever it happened.

**Remove it by.** Deleting the `beforeStart` branches in `lib/streaks.ts`, the
`startedOn()` reader in `lib/db/progress.ts`, and the `notStarted` guards in
`lib/warnings.ts`, which `lib/db/warnings.ts` feeds. `tests/start-date.test.mjs`
goes with them.

---

## 16. The Roles screen carries where to apply and interview preparation

**What.** `/roles` was the seven roles, the nine earlier roles and the skill
matrix. It now also carries, in one place: what each role's interview actually
tests and which project answers it, the five boards and two salary sources, the
seven apply rules, the six interview preparation links with your progress on each,
your logged mocks, what goes on the resume at each gate, and the unlock ladder with
the DSA thresholds against today.

**Why.** The material was all seeded and all scattered. "Where do I apply" lived in
the Week 21 LEARN block, which a person reads once in January. "How do I prepare"
lived in resource category 16 among 127 other links. "What do they test" was a
column in the `roles` table that nothing rendered. A person deciding what to apply
for had to visit four screens and remember.

**Serves.** Part 12, Part 13, Part 19.2, Part 7 categories 16 and 19, and the
Week 21 LEARN block of Part 4.

**Nothing was invented.** The boards are the five `final.md` names, the prep links
are its six, the rules are its seven bullets, and where it gives a figure with a
caveat the caveat comes with it. The one thing repeated in client code rather than
read from an endpoint is the Appendix B lead column list, noted in a comment naming
its source.

**Remove it by.** Reverting `GET /api/roles` to the four-field version and dropping
the five new sections from `app/(app)/roles/RolesScreen.tsx`.

---

## 17. Interfaces for five endpoints that had none

**What.** A coverage audit found five working endpoints that no screen called:

| Endpoint | Now on |
| --- | --- |
| `POST /api/leads/import` | `/money`, paste or choose a CSV, dry run first |
| `GET`/`POST /api/repos`, `PATCH /api/repos/:id` | `/pushes`, add and reclassify a repository |
| `POST /api/sessions/manual` | `/calendar`, in the day drawer |
| `GET /api/ops` (new) | `/profile`, what has actually run |

**Why.** Each was a real hole. The Money screen told the user to import sixty leads
from a CSV and gave them no importer. The push tracker could not mark a client
repository as a client repository, so client work kept counting towards the study
target. `POST /api/sessions/manual` is described in its own handler as "the fallback
that always exists" and did not exist in the interface. And `link_check_runs`,
`backup_log` and `dsa_imports` were written by the scripts and read by nothing, so
/profile could only claim a backup existed rather than show one.

**Serves.** Part 17.13 and Appendix B, Part 18.4, Part 18.7, and section 20.

**One server side fix went with it.** `POST /api/repos` upserts on
`(user_id, full_name)` and can therefore change whether a repository counts, but
unlike `PATCH` it did not repaint the window. It now recomputes when, and only
when, `counts_to_target` actually changes.

**Remove them by.** Deleting the four blocks and the `/ops` route.

---

## 18. Retired: the per-page CSS check

**What it was.** `tests/screens.test.mjs` used to check that every class was in a
stylesheet **the page that uses it actually loads**, and that no element stacked two
flex containers.

**Why it existed.** `views/partials/head.ejs` loaded tokens, base, layout and
components on every page and then exactly one `screens/NAME.css`. A class defined in
another screen's stylesheet rendered with no styling at all, and nothing errored. It
found seven such classes, and 14 places where `row between` only worked because of
declaration order. Section 13 is the fix it produced.

**Why it is gone.** `app/globals.css` imports `design.css` and `screens.css`, and
`app/layout.tsx` imports `globals.css`, so every page loads every rule. There is no
per-page stylesheet to be on the wrong side of, and a check that can never fail is
a check that teaches the reader something untrue about the build. The flex rule went
with it: the classes it flagged were fixed, and Tailwind's own utilities are now the
common case.

**Serves.** Section 15, the design system, historically.

---

## 19. Retired: `scripts/verify-screens-offline.mjs`

**What it was.** A harness that rendered every EJS view with the same locals the
page router supplied, installed it as a document, and stubbed `fetch` so a call to
`/api/...` was dispatched straight into the matching Express handler in process,
against the real database. It verified all 23 pages with nothing listening.

**Why it existed.** The HTTP harness needed a running server and a throwaway
account, and signup is rate limited. This needed neither and wrote nothing, and it
caught a missing view local that only a browser would otherwise have revealed.

**Why it is gone.** There are no EJS views and no Express routers to dispatch into,
so nothing it did can be pointed at the current code. Its whole purpose, catching a
template variable that was never passed, is now a TypeScript error at build time.
`scripts/smoke.mjs` in section 12 covers what is left, and needs a listening server
to do it. The gap that leaves is stated in `docs/QA-REPORT.md` section 5 rather than
papered over.

---

## 20. Signup closes itself after the first account

**What.** `lib/server/signup.ts`. `GET /signup` and `POST /api/auth/signup`
are gated. With `ALLOW_SIGNUP` unset, signup is open only while the `users` table
is empty, so the first run creates the account and the door shuts. After that
`POST /api/auth/signup` answers 403 `SIGNUP_CLOSED` and `/signup` answers **200
with a page that says account creation is closed**, because a page a person
navigated to should explain itself rather than hand them a bare status code.
`/login` stops offering the link. `ALLOW_SIGNUP=true` forces it open for recreating
a lost account, `false` forces it shut.

**Why.** This was found in the pre-deployment audit and it was the one genuine
blocker. `requireAnon` only keeps an already signed in visitor away from /signup; it
does nothing about a stranger. Deployed to the internet, anyone who found the URL
could register an account on the server and use it. The tracker is built for one
person, so the number of accounts it should ever accept is one.

**Serves.** Section 5 of the build prompt, and the single user premise the whole
application rests on.

**The policy is a pure function.** `decide(allowSignup, userCount)` takes both
facts as arguments rather than reading them, because a policy you cannot test
without setting environment variables is a policy nobody tests. It is covered by 13
tests in `tests/signup-gate.test.mjs`, including that an unreadable user count
**fails closed**. A door that opens when the database hiccups is not a door.

**Remove it by.** Dropping `assertSignupOpen` from `app/api/auth/signup/route.ts`
and the `signupState()` check from `app/signup/page.tsx`. Do not, on anything
reachable from the internet.

---

## 21. Rate limiting is written here, not taken from a package

**What.** `lib/server/rateLimit.ts` holds the login, signup, GitHub sync and general
API limits. No rate limiting package is installed. `express-rate-limit` was a
dependency of the Express build and went with it, along with `express` and `ejs`;
none of the three appears in `package-lock.json` now.

**Why.** Two reasons, in this order. The rewrite left nothing for it to plug into:
`express-rate-limit` is Express middleware, and there is no Express. And it had been
the source of the only real `npm audit` finding this project ever had. Version 8.1.0
pulled in `ip-address` 10.0.1, where `Address4` decodes a leading-zero octet as
decimal while a resolver decodes it as octal, and the login path called
`ipKeyGenerator(req.ip)` on every attempt, so with `TRUST_PROXY=1` a crafted
`X-Forwarded-For` could vary the rate limit key and weaken login throttling. That
was pinned around at the time by moving to 8.6.2; removing the package removed the
chain entirely, and `npm audit --omit=dev` reports **0 vulnerabilities**.

**Nothing about the limits changed.** Five login or signup attempts per fifteen
minutes, per address and per email, from section 5.3; six GitHub syncs per five
minutes, which is not configurable; and a wide per minute ceiling on everything
else, 300 in production. The counters live in process memory, which is exactly where
`express-rate-limit` kept them, so a restart still clears them and two instances
behind one proxy would still double the effective limit.
`tests/security.test.mjs` pins the defaults so they cannot drift quietly.

**Serves.** Section 5.3, the login and signup rate limits.

**The related deployment note.** `TRUST_PROXY=1` only makes sense when the proxy
*overwrites* `X-Forwarded-For`. `docs/RUNBOOK.md` section 12.2 gives the nginx
lines, because `$proxy_add_x_forwarded_for` appends and would hand a caller the same
bypass back. Where Next does not expose a client address at all, `clientIp` returns
the literal `local` and every caller shares one bucket, which limits more rather
than less.

**Remove it by.** Nothing to remove. Deleting the limiters would leave the login
form unthrottled; do not.

---

## 22. `migrations/005_hardening.sql` and `tests/triggers.test.mjs`

**What.** A migration of six corrections plus two missing indexes, and a test file
that pins the most consequential of them. `001_init.sql` was deliberately not
edited: `scripts/migrate.mjs` records the SHA-256 of every migration and treats a
changed file as a hard stop, so a fresh install reaches the same final state by
applying 001 then 005.

**Why.** Each one either breaks the running application or corrupts data, and none
of them was visible in use. The two worth knowing here, because they change
behaviour a person can observe:

- `trg_day_logs_no_backdate_upd` rejected **every** update to a `day_logs` row older
  than seven days. Part 18.7 rule 3 forbids a person editing such a day; it does not
  forbid the application recomputing a projection of it. `recomputeRange()` walks all
  150 days on a GitHub sync, a repository edit or a start date change, so from the
  eighth day of real use each of those would have raised SQLSTATE 45000 and surfaced
  as a 500. The trigger now fires only when a column a person enters actually
  changes, compared with the null safe `<=>` so a change to NULL cannot slip past.
- A study session left open on an earlier date is closed automatically, with
  `auto_closed = 1` and zero minutes, rather than blocking every future session. The
  old rule was right for a session started today and a dead end for one left running
  last Tuesday, because the only route out credited its minutes to a date the seven
  day rule had sealed, which failed and rolled back, leaving it open. A session open
  from **today** still refuses, which is the behaviour that was actually wanted.

The other four: `sessions` gains a `user_id`, so "sign out everywhere" is no longer
a `LIKE` on the session JSON that also matches users 120, 123 and 1234; anonymous
session rows get two hours instead of thirty days and the backlog is cleared; a
UNIQUE key over a generated column allows only one open session per person, so a
double tap is refused by MySQL rather than by a check a race can slip past; and
`github_pushes` is keyed on `(user_id, repo_id, push_date)`, so a day whose head
commit changes between syncs cannot be counted twice. `audit_log` now survives the
deletion of the user it audits.

**Serves.** Part 18.7 rule 3, Part 18.4, and Part 17.1.

**How the test tests what it claims to.** An aged `day_logs` row cannot be created,
because the INSERT trigger correctly forbids exactly that. So the suite builds a
probe table with `CREATE TABLE … LIKE day_logs`, which copies the columns and no
triggers, ages a row inside it, and attaches the trigger body **read verbatim out of
`migrations/005_hardening.sql`** with only the names rewritten. The predicate under
test is therefore the shipped predicate rather than a paraphrase of it. Seven tests,
all passing. The probe table is dropped in a `finally`, including on the failure
path.

**Remove it by.** You cannot, usefully: the migration is applied and its SHA is
recorded. A later migration would have to reverse the individual statements, and
reversing the first one reinstates a 500 on every GitHub sync after day eight.

---

## Decisions taken where the build prompt was ambiguous

Section 22 asks for these to be recorded here rather than left in the code.

**Dry run is the default for the destructive scripts.** `import-dsa.mjs` writes
nothing without `--write`. The build prompt asks for "a dry run mode"; making it
the default costs one flag and prevents a mis-mapped column from writing 474 wrong
rows.

**`export-all.mjs` includes reference tables, not only user tables.** Progress
without the plan it was measured against is not a record of anything. The files are
prefixed `mine-` and `plan-` so it is obvious which is which.

**Pushes are grouped by calendar date in `Asia/Kolkata`.** A commit at 01:00 IST
belongs to the day the person doing the work would call it. Grouping by UTC would
move roughly a quarter of late night commits to the previous day and quietly break
the push streak.

**A two condition day cannot be amber.** `dayColour` grades a study day on the six
conditions from Part 18.2 exactly as written. Sundays have two conditions, so
"more than half" cannot be satisfied by one of them, and a Sunday marked complete
with the hours missing is red. That is the honest answer rather than the
flattering one, and it is asserted in `tests/streaks.test.mjs` so it cannot drift.

**"Weakly" in Part 19.3 applies to the ladder row, not to one code inside it.**
Every role a qualified row introduces starts weak, and a later row that names a
role without the qualifier upgrades it. A full mention is never downgraded.

**A dead link never fails the nightly job.** `check-links.mjs` exits 0 with dead
links found, unless `--fail-on-dead` is passed. A dead link is a fact to act on in
the morning, not a broken cron job.

**A screen never stays on "Loading".** `useResource` returns an `error` string
alongside the payload, and a screen with no data and an error renders `ErrorCard`
rather than the loading state. A page that cannot load says why.

**The review screen does not pretend to save.** There is no endpoint that stores a
written review answer, so rather than a save button that quietly does nothing, the
screen states plainly that the text is not sent anywhere and offers to copy the
whole review out for `log.md`.

**The four exits live on `/eligibility`, not on `/after`.** `GET /api/after`
returns no exit data; `GET /api/eligibility` does, and `.exitcard` is defined in
`app/screens.css`. Putting them on `/after` would have meant inventing fields.

**Two exits carry a cost note, not four.** The seed has `before_gate3 = 1` on
exits 1 and 2 only. The screen counts the costly exits from the data rather than
asserting a number.

**Reference renders Markdown as source, not as HTML.** `GET /api/doc/:slug`
returns `body_md`, which is Markdown, and there is no client side renderer. It goes
into a `<pre>` as a text child, so React escapes it, because the alternative was
either shipping a Markdown parser to the browser or reaching for
`dangerouslySetInnerHTML`, which appears nowhere in this codebase and which the CSP
is there to make pointless anyway.

