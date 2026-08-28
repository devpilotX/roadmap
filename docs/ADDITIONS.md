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

## 3. `src/lib/exportTables.mjs`

**What.** One list of exportable tables and one CSV writer, imported by
`src/routes/api/meta.mjs` and by `scripts/export-all.mjs`.

**Why.** The list existed twice, once in the API and once in the script. Two
copies means a table can become exportable in the interface and stay invisible to
the backup. Part 18.8 wants the export to be the whole thing, so there is now one
list and a test that asserts both callers produce identical CSV.

**Serves.** Part 18.8, the export contract.

**Remove it by.** Copying the map back into `meta.mjs`. The test in
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

**What.** 300+ tests across ten files, run by Node's own test runner.

**Why.** Section 20 of the build prompt asks for the boundaries to be tested. The
choices worth stating: no test framework was added, because Node 24 ships one and
this project has deliberately few dependencies; and the two tests that need
infrastructure skip themselves cleanly rather than failing, so the suite is useful
on a laptop with nothing running and thorough on a machine with everything up.

`tests/http.test.mjs` runs against an already listening server instead of
importing the app, because `src/server.mjs` starts on import and refactoring it to
export the app was a larger change than the coverage justified. The consequence is
that those tests are skipped when nothing is up, and the runbook says so.

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

**What.** 192 static assertions over the 24 client screen modules: that each one
mounts only to ids its EJS view actually declares, fills every container the view
left saying "Loading", calls only API paths the router registers, imports only
helpers that are exported, never uses `innerHTML` or a style attribute, renders an
`errorCard` on failure, and starts itself.

**Why.** Seventeen of the 24 screens were four line placeholders, so most pages
showed nothing but "Loading". Once they were written, the failure modes that
remained were all silent ones: a mount id that does not exist, an API path that
was never registered, a helper that is not exported. None of those are caught by
`node --check`, and each of them looks exactly like "the page is broken" to the
person using it. This file catches all three without a browser.

**Serves.** Section 20 of the build prompt, and every screen in sections 12 to 14.

**Remove it by.** Deleting the file. The screens keep working; the guard rail goes.

---

## 12. `scripts/smoke-screens.mjs`

**What.** A harness that signs up a throwaway account, fetches each of the 23
pages, parses the server rendered HTML, installs it as a real document, imports
the real screen module so its own fetch calls hit the real API and the real
database, then asserts every container ended up with content. It deletes the
throwaway account when it is done, including on the failure path.

**Why.** The static tests prove the wiring is consistent. They cannot prove a
screen actually draws. This does, and it is the only check that exercises the
whole path from MySQL through the API through the module into the DOM.

**Serves.** Section 20 of the build prompt.

**The dependency choice worth knowing.** It needs `linkedom` to have a DOM, and
`linkedom` is deliberately **not** in `package.json`. Install it for the run only:

```bash
npm install linkedom --no-save
node scripts/smoke-screens.mjs
```

Without it the script exits 2 and prints that line. The application itself never
imports it, so nothing ships that is not needed.

**Remove it by.** Deleting the file.

---

## 13. Five CSS classes moved into `components.css`

**What.** `.milestone` and its parts, `.costheading`, `.pwwrap`, `.funnelbar` and
`.videorow` moved out of individual screen stylesheets into `components.css`.

**Why.** `views/partials/head.ejs` loads tokens, base, layout and components on
every page, then exactly one `screens/NAME.css`. Each of those five classes was
defined inside one screen's file and then used from another: the milestone list by
`/ladder` and `/newzealand`, `costheading` by `/eligibility` and `/newzealand`,
`pwwrap` by the auth pages and `/profile`, `funnelbar` by `/applications` and
`/stats`, `videorow` by `/` and `/stats`. The second user of each got the markup
with none of the styling.

**Serves.** Section 15 of the build prompt, the design system.

**Remove it by.** Moving each block back, and accepting that the second page that
uses it will be unstyled.

---

## 14. Today shows an error card on a failed first load

**What.** `public/js/screens/today.mjs` used to show a toast when `/api/today`
failed. It now shows a toast only if the screen has already drawn once, and
renders an `errorCard` into `#t-now` if the very first load fails.

**Why.** A toast disappears. On a failed first load the whole of Today was left
sitting on "Loading" with no explanation, on the one screen that gets opened 150
times. A later refresh failing is genuinely a toast, because the last good draw is
still on screen, so the two cases are treated differently rather than the same.

**Serves.** Section 12 of the build prompt.

**Remove it by.** Reverting `refresh()` to a single `toastError`.

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

**Remove it by.** Deleting the `beforeStart` branch in `src/lib/streaks.mjs`, the
`startedOn()` reader in `src/db/progress.mjs`, and the `notStarted` guards in
`src/lib/warnings.mjs`. `tests/start-date.test.mjs` goes with them.

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
the five new sections from `views/screens/roles.ejs`.

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

## 18. `tests/screens.test.mjs` grew a per-page CSS check

**What.** Beyond checking that every class has a rule somewhere, the suite now
checks that every class is in a stylesheet **the page that uses it actually
loads**, and that no element stacks two flex containers.

**Why.** `head.ejs` loads tokens, base, layout and components on every page and
then exactly one `screens/NAME.css`. A class defined in another screen's stylesheet
renders with no styling at all, and nothing errors. This found seven such classes,
and 14 places where `row between` only worked because of declaration order.

**Serves.** Section 15, the design system.

**Remove it by.** Deleting the two `it` blocks.

---

## 19. `scripts/verify-screens-offline.mjs`

**What.** Renders every view with the same locals the page router supplies,
installs it as a document, and stubs `fetch` so a call to `/api/...` is dispatched
straight into the matching Express handler in process, against the real database.
All 23 pages verified with nothing listening.

**Why.** `scripts/smoke-screens.mjs` drives the real HTTP surface, which is the
better test, but it needs a running server and a throwaway account, and signup is
rate limited to five per quarter hour. This needs neither, writes nothing, and
catches a missing view local that only a browser would otherwise reveal.

**Serves.** Section 20.

**The limit, stated.** Every request is a GET, so write paths are not exercised
here. That is what `smoke-screens.mjs` is for. It also needs `linkedom`, installed
with `--no-save`.

**Remove it by.** Deleting the file.

---

## 20. Signup closes itself after the first account

**What.** `src/middleware/signup.mjs`. `GET /signup` and `POST /api/auth/signup`
are gated. With `ALLOW_SIGNUP` unset, signup is open only while the `users` table
is empty, so the first run creates the account and the door shuts. After that both
answer 403 `SIGNUP_CLOSED`, and `/login` stops offering the link. `ALLOW_SIGNUP=true`
forces it open for recreating a lost account, `false` forces it shut.

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
assertions in `tests/signup-gate.test.mjs`, including that an unreadable user count
**fails closed**. A door that opens when the database hiccups is not a door.

**Remove it by.** Dropping `requireSignupOpen` from the two routes. Do not, on
anything reachable from the internet.

---

## 21. `express-rate-limit` moved from 8.1.0 to 8.6.2

**What.** A pinned dependency was deliberately upgraded.

**Why.** `npm audit` reported two high severity advisories in `ip-address` 10.0.1,
which 8.1.0 pulls in. One of them has `Address4` decode a leading-zero octet as
decimal where a resolver decodes it as octal, which is a trust boundary bypass.
This was not theoretical here: `src/middleware/rateLimit.mjs` calls
`ipKeyGenerator(req.ip)` on every login, signup and API request, so with
`TRUST_PROXY=1` a crafted `X-Forwarded-For` could vary the rate limit key and
weaken login throttling. 8.6.2 resolves `ip-address` to 10.5.0 and `npm audit`
reports **0 vulnerabilities**.

**Serves.** Section 5.3, the login and signup rate limits.

**The related deployment note.** `TRUST_PROXY=1` only makes sense when the proxy
*overwrites* `X-Forwarded-For`. `docs/RUNBOOK.md` section 12.2 gives the nginx
lines, because `$proxy_add_x_forwarded_for` appends and would hand the attacker the
same bypass back.

**Do not pin it back.**

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

**A screen never stays on "Loading".** Every module wraps its work in a try/catch
and puts an `errorCard` in the first container on failure. A page that cannot load
says why. This is asserted for all 24 screens in `tests/screens.test.mjs`.

**The review screen does not pretend to save.** There is no endpoint that stores a
written review answer, so rather than a save button that quietly does nothing, the
screen states plainly that the text is not sent anywhere and offers to copy the
whole review out for `log.md`.

**The four exits live on `/eligibility`, not on `/after`.** `GET /api/after`
returns no exit data; `GET /api/eligibility` does, and `exitcard` is defined in
`eligibility.css`. Putting them on `/after` would have meant inventing fields.

**Two exits carry a cost note, not four.** The seed has `before_gate3 = 1` on
exits 1 and 2 only. The screen counts the costly exits from the data rather than
asserting a number.

**Reference renders Markdown as source, not as HTML.** `GET /api/doc/:slug`
returns `body_md`, which is Markdown, and there is no client side renderer. It goes
into a `<pre>` through `textContent`, and the panel says so, because the
alternative was either shipping a Markdown parser to the browser or injecting HTML
that `el()` and the CSP both refuse.

