# Deferred and known gaps

Nothing here was dropped silently. Each item states its impact and the next step.
Swept once before delivery, as required.

---

## D-001 | Dockerfile ships the dev dependency tree
**Impact: HIGH (container path only, which is not the deployment in use)**

`Dockerfile` copies the full `node_modules` over the minimal tree that
`output: 'standalone'` traced, so a built image would carry typescript, eslint and
tailwindcss at runtime. The exact fix — a third `clideps` stage installing
production dependencies plus `tsx` only — is written out in a comment at that line.

Not applied because it cannot be verified: Docker is installed on neither the
development machine nor the production host. The live deployment runs natively
under systemd behind Caddy and never touches this file.

**Next step:** build the image once, confirm `npx tsx scripts/verify-seed.mjs` runs
inside it, then apply the commented change.

---

## D-002 | `recomputeRange` is a query per day
**Impact: MEDIUM**

`lib/db/progress.ts` `recomputeRange()` loops the 150-day window calling
`recomputeDay()`, which issues roughly four queries each: about 600 round trips
per GitHub sync, repository edit or start-date change. The reference data it needs
is already memoised on `globalThis` (`lib/db/reference.ts`), so the cost is purely
SQL round trips over loopback.

It is now CORRECT — migration 005 removed the trigger that made it fail outright —
and it is slow, not broken. Rewriting the recompute engine into set-based SQL is a
genuine redesign of the code that decides day colour, which is the single most
load-bearing calculation in the application. Not something to do in the same pass
as a deployment.

**Next step:** measure it on real data first. If a sync exceeds a couple of
seconds, fold the push and touch counts into one aggregate query keyed by date and
apply the colours in a single UPDATE ... JOIN.

---

## D-003 | Rate limiting is per process and in memory
**Impact: MEDIUM**

`lib/server/rateLimit.ts` keeps a fixed-window map in process memory. It resets on
restart and is not shared between workers. Two mitigations are now in place: the
service runs as a single process, and `TRUST_PROXY=1` combined with Caddy
overwriting `X-Forwarded-For` (see `deploy/roadmap.caddy`) means the limiter keys
on a real client address instead of putting every caller in one bucket, which was
the more serious half of the finding.

**Next step:** if this ever runs more than one process, move the counter into the
`sessions` database or a small table keyed by address and window.

---

## D-004 | No absolute cap on session lifetime
**Impact: LOW**

Sessions roll forward 30 days on use, so an account used daily is never signed
out. `startedAt` is written into the session but never read, so there is no
absolute maximum age.

Deliberately not changed: the units of `startedAt` were not verified against every
writer, and guessing at a timestamp unit in authentication code to add a hardening
nicety is how a working sign-in gets broken. Two hours of anonymous TTL — the part
that was actually causing harm — is fixed and verified live.

**Next step:** confirm whether `startedAt` is seconds or milliseconds at each
write site, then reject a session older than, say, 90 days in `readSession()`.

---

## D-005 | Fifteen reference-side foreign keys cascade into user history
**Impact: MEDIUM**

Deleting a reference row (a resource, a week link, a DSA problem) cascades up to
three levels deep and takes the user's progress rows with it, without an
`audit_log` entry. This is by design for re-seeding — `docs/RUNBOOK.md` section 4
tells you to dump before editing `final.md` — but it is a sharp edge.

Not changed because switching them to `RESTRICT` would make a legitimate re-seed
fail instead, and choosing between those two behaviours is a product decision about
what should happen when `final.md` drops a row somebody has progress against.

**Next step:** decide the intended behaviour, then either restrict the deletes or
add a pre-delete audit trigger.

---

## D-006 | The drawer animation was lost to correctness
**Impact: LOW**

The calendar day drawer now uses `hidden` when closed, so it is out of the
accessibility tree and the tab order. A `display: none` element cannot run a CSS
transition, so the 120 ms slide no longer plays. Correct keyboard behaviour was
judged worth more than the animation.

**Next step:** if the animation matters, drive it from an `inert` attribute plus
`visibility`/`transform` rather than `display`, and keep the focus handling.

---

## D-007 | The command palette lost middle-click-to-new-tab
**Impact: LOW**

Making the palette rows valid `role="option"` elements meant they can no longer be
anchors, so a middle click no longer opens a destination in a new tab.

**Next step:** accept it, or render an anchor inside each option and accept the
extra ARIA complexity.

---

## D-008 | Six API routes have no interface
**Impact: LOW**

`POST /api/care-plans`, `PATCH /api/care-plans/[id]`,
`POST /api/money/scripts/[code]/version`, `GET /api/day-logs`,
`GET /api/sessions` and `DELETE /api/leads/[id]` are reachable and correct but no
screen calls them. They are authenticated, CSRF-protected and validated, so this is
unfinished surface rather than exposure.

**Next step:** either build the controls or remove the routes. Do not leave them
undocumented.

---

## D-009 | No browser pass over the UI changes
**Impact: MEDIUM**

The frontend fixes — the mobile account menu, the chart scroll floor, the ring
style for the previously invisible `calcell__dot--todo`, the drawer focus handling
— are verified by static analysis, by every class resolving against a real design
token, by ESLint, and by 23 of 23 pages rendering their heading over HTTPS on the
live site. None of it has been looked at in an actual browser, because the user
withdrew permission to run a local server and a rendered pixel cannot be asserted
over curl.

**Next step:** open https://roadmap.devpilotx.com on a phone and on a desktop and
check: the account menu opens and signs out, the charts are legible, an unlogged
calendar day shows a ring, and Tab cannot enter a closed drawer.

---

## D-010 | `next build` no longer type-checks on the production host
**Impact: LOW**

`NEXT_SKIP_HOST_CHECKS=1` is set by `deploy/release.sh` only. On that 946 MB host
the lint and type-check phases drove the machine into 1.3 GB of swap at 8% CPU.
Everywhere else, including a developer machine and any CI, both still run and a
type error still fails the build. `npm run typecheck` and `npm run lint` remain
separate gates that must pass before a commit.

**Next step:** if CI is ever added, make it the place that enforces both, and keep
the host doing only what only the host can do.
