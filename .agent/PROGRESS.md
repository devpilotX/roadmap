# Progress

Original branch: **main** (remote `https://github.com/devpilotX/roadmap.git`)
Working branch: `agent/perfect-and-deploy-20260831-065856`
Backups: `C:\Dev\apps\.agent-backups\roadmap-tracker-20260831-065856.bundle` (verified complete)
Ignored-file snapshot: `roadmap-tracker-ignored-20260831-065856.zip` (.env + backups/)

## Capability probe
| Capability | Result |
|---|---|
| Shell | yes (PowerShell). NOTE: the tool's `working_dir` is ignored, every command must `cd` first |
| Filesystem write | yes |
| Git | yes, 2.55.0. Repo already existed on `main`, 3 commits, clean tree |
| Test runner | yes, `node --test` via tsx |
| MySQL | yes, 8.4.9 local on 127.0.0.1:**3399** (not 3306), started by this run |
| Local web server | **FORBIDDEN BY USER** (07:07). No dev/prod server locally. HTTP suite runs against the live VPS instead |

## Baseline, measured not assumed
- `npm run typecheck` exit 0
- `npx next lint` exit 0 (but `next lint` is deprecated, removed in Next 16)
- `npm run build` exit 0
- `npm run verify` exit 0, 70 assertions
- `npm test` 510 tests / 450 pass / 0 fail / **60 skipped** (the whole HTTP suite: needs a listening server)
- Port 3000 locally belongs to a DIFFERENT project (`C:\Dev\apps\auspice`, next dev). Never touched.

## Log
- [06:59] Safety rail up. checkpoint/000-baseline, working branch, bundle verified.
- [07:05] Five parallel read-only audits completed: backend, frontend, security, docs/scripts, database.
- [07:20] Live data confirmed two audit findings independently:
  - `sessions` held **1,905 rows for 1 user** — the unauthenticated /api/csrf growth defect, already happening.
  - one open `study_sessions` row (user 2, 2026-08-28) that would have become unstoppable on 2026-09-05.
- [07:35] migration `005_hardening.sql` applied, 15 statements, exit 0. Every change verified via
  information_schema: sessions.user_id + FK CASCADE, fk_audit_user now SET NULL, uq_session_open_one,
  uq_push_day replacing uq_push_sha, idx_dsa_topics_ord, 5 triggers present, sessions swept 1905 -> 0.
- [07:40] `tests/triggers.test.mjs` added and GREEN 7/7. Proves the CRITICAL trigger fix by execution:
  a 30-day-old day_logs row now accepts the derived recomputation and still refuses a human edit,
  including the NULL case that a plain `!=` would have let through.
- [07:55] Code fixes done and verified: typecheck 0, eslint 0, `npm test` **518 / 458 pass / 0 fail**.
  One pre-existing test (`security.test.mjs:248`) was pinning the buggy LIKE pattern; it was
  retargeted at the corrected contract and made stricter, not deleted.

## Verified fixed
| # | Defect | Severity | Proof |
|---|---|---|---|
| 1 | `trg_day_logs_no_backdate_upd` blocked the app's own `recomputeDay`, breaking GitHub sync / repo edits / start-date changes from day 8 | CRITICAL | tests/triggers.test.mjs 7/7 |
| 2 | `recomputeRange` 500s over the 150-day window (same root cause) | CRITICAL | resolved by #1 |
| 3 | Stale open study session became an unrecoverable timer lockout | CRITICAL | start route auto-closes; stop route no longer rolls back on a sealed date |
| 4 | Cross-user session destruction via LIKE on session JSON (user 12 matched 123) | HIGH | sessions.user_id + regression guard in security.test.mjs |
| 5 | Unauthenticated /api/csrf grew 30-day session rows without bound | HIGH | 2h anon TTL + sweep on the anon path + 1905 rows cleared |
| 6 | Session stop double-credited minutes under concurrency | HIGH | close is now a claim: `AND ended_at IS NULL` inside the transaction |
| 7 | Two open sessions possible via read-then-write race | HIGH | uq_session_open_one enforced by MySQL |
| 8 | `github_pushes` double-counted a day when its head commit changed between syncs | HIGH | unique key is now (user_id, repo_id, push_date) |
| 9 | dsa_increment lost an increment (read-modify-write across connections) | HIGH | atomic `col = GREATEST(0, col + ?)` inside writeDayLog's transaction |
| 10 | Service worker cached authenticated page HTML forever; sign out left it readable | HIGH | v4 cache bump evicts, /login+/signup never cached, `signout` message empties it |
| 11 | Offline IndexedDB queue survived sign out and replayed under the next session | HIGH | `signOutEverywhere()` clears the queue |
| 12 | Sign out and theme toggle unreachable under 768px (sidebar is display:none) | HIGH | `AccountMenu` in the top bar, phone-only, focus-trapped and `hidden` when closed |
| 13 | audit_log was destroyed by user deletion (CASCADE) | HIGH | fk_audit_user is ON DELETE SET NULL |
| 14 | `EXPORTABLE['constructor']` passed the allow-list and returned 500 | MEDIUM | `Object.hasOwn` guard |
| 15 | Touch targets below the project's own --tap:44px | MEDIUM | coarse-pointer hit-area expansion, no layout change |
