# Definition of Done

Mission: harden and complete The Roadmap Tracker, then deploy it live at
https://roadmap.devpilotx.com on the Oracle VPS 168.138.15.182, verified end to
end, and push the result to GitHub.

Constraint from the user (2026-08-31 07:07): **do not run a local server.**
Local verification is limited to typecheck, lint, build, unit/integration tests
and static analysis. The HTTP surface suite is verified against the LIVE origin
after deployment, which is stronger evidence than localhost.

| # | Criterion | Verification | Status |
|---|-----------|--------------|--------|
| 1 | Type check clean | `npm run typecheck` exits 0 | PASS (baseline) |
| 2 | Lint clean, not on a deprecated runner | `npm run lint` exits 0 via eslint CLI | PENDING |
| 3 | Production build succeeds | `npm run build` exits 0 | PASS (baseline) |
| 4 | Unit + integration suite green | `npm test` 0 failures | PASS (baseline 450/0) |
| 5 | Seed contract holds | `npm run verify` exits 0, 70 assertions | PASS (baseline) |
| 6 | No stale documentation | QA-REPORT/RUNBOOK contain no reference to files or deps that no longer exist | PENDING |
| 7 | Every API route reachable from a UI, every UI call hits a real route | static cross-audit, 0 orphans | PENDING |
| 8 | Deployment artifacts complete | nginx conf + systemd unit + deploy script + prod env template committed | PENDING |
| 9 | Live: TLS + health | `curl -sI https://roadmap.devpilotx.com` 200, valid cert, HSTS present | PENDING |
| 10 | Live: every page route | all app pages 302 to /login unauthenticated; 200 authenticated | PENDING |
| 11 | Live: HTTP surface suite green | `PUBLIC_ORIGIN=https://roadmap.devpilotx.com npm test` runs the 60 previously-skipped tests, 0 failures | PENDING |
| 12 | Live: database up and seeded | `/api/healthz` reports `db: up`; `npm run verify` on the VPS exits 0 | PENDING |
| 13 | Live: auth works end to end | signup creates the single account, login sets a Secure cookie, logout clears it | PENDING |
| 14 | Live: signup closes after first account | `/signup` returns 403 SIGNUP_CLOSED once an account exists | PENDING |
| 15 | Secrets: no secret in git history or in any commit | secret scan clean; prod secrets generated fresh on the VPS only | PENDING |
| 16 | Pushed to GitHub | `git push` succeeds, remote HEAD equals local HEAD | PENDING |
