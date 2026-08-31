# Assumptions

Each one was chosen alone, is reversible, and states what it would cost to reverse.

**A-001** The application port on the VPS is **3200**.
Chosen because 3000 was taken by a different project on the developer machine and
8000 by the MCP gateway on the host. Reverse by: change `PORT` in
`/etc/roadmap-tracker/roadmap.env`, the `-p` flag in
`deploy/roadmap-tracker.service`, and the upstream in `deploy/roadmap.caddy`.
3 lines, 2 minutes, one restart.

**A-002** The app lives at **/opt/roadmap-tracker** as a flat git checkout, not a
`releases/current` symlink layout. Chosen for legibility: rollback is
`git reset --hard <commit>` plus `release.sh`, which is one concept rather than
three. Reverse by: adopting a symlink layout, roughly 30 lines in `release.sh`.

**A-003** Secrets live in **/etc/roadmap-tracker/roadmap.env**, outside the
deployment directory, so `git reset --hard` can never destroy them and a directory
listing can never expose them. Reverse by: symlinking `.env` into the app
directory, 1 line.

**A-004** The MySQL buffer pool is **96 MB** and `performance_schema` is **OFF**.
Sized for 946 MB of total RAM. `performance_schema` alone costs 150-200 MB, which is
a fifth of this machine spent instrumenting a single-user application. Reverse by:
edit `/etc/my.cnf.d/roadmap.cnf` and restart mysqld. Raise the pool first on any
larger host.

**A-005** The binary log is **disabled**. There is no replica, and it is pure write
amplification plus growth on a 30 GB volume. Point-in-time recovery comes from the
nightly `mysqldump`. Reverse by: remove `disable_log_bin`, restart. Do this before
adding a replica.

**A-006** The anonymous session TTL is **2 hours**. Long enough to fetch a CSRF
token and post the form it belongs to, short enough that unauthenticated traffic
cannot accumulate rows — this database had 1,905 of them. Reverse by:
`ANON_SESSION_TTL_SECONDS` in `lib/server/session.ts`, 1 line.

**A-007** An abandoned timer is auto-closed with **zero minutes**, not with an
estimate. Nobody can say how long a timer left running overnight was really used,
and crediting a guess into a day's totals is worse than crediting nothing. It is
recorded as `auto_closed = 1` so the interface can distinguish it. Reverse by:
compute a duration in `app/api/sessions/start/route.ts`, about 5 lines.

**A-008** Pagination defaults to **500 rows, maximum 1000**. Chosen to be far above
any real page for a single user while still bounded. Reverse by: the constants in
`lib/db/pool.ts` (`MAX_PAGE_SIZE`) and the zod schemas in the affected routes.

**A-009** `LIMIT`/`OFFSET` are **interpolated as clamped integers**, not bound as
parameters. Not a preference: MySQL rejects a bound parameter in `LIMIT` inside a
prepared statement, which is what every helper in `lib/db/pool.ts` uses, and it
fails at runtime with "Incorrect arguments to mysqld_stmt_execute". `limitOffset()`
runs both values through `Math.trunc` and clamps them, so nothing but an integer in
range can reach the SQL — proven by feeding it a SQL injection string, a float, NaN
and an object. Reverse by: switching the helpers to `query()` instead of
`execute()`, which gives up prepared statements everywhere.

**A-010** The "Make my progress public" control is **disabled and labelled**, not
removed. The `public_progress` and `public_slug` columns are real and visible in the
user's own export, so deleting the control would hide that rather than explain it.
Reverse by: delete the block in `app/(app)/profile/DataSection.tsx`.

**A-011** `.agent/` is **committed**. It is the audit trail for this run and reads as
engineering documentation. If it is unwanted in a portfolio repository:
`git rm -r --cached .agent && echo .agent/ >> .gitignore`. One command.

**A-012** The work is squashed into **one commit on `main`**, with the full
checkpoint history preserved on the `agent/perfect-and-deploy-20260831-065856`
branch. `main` reads as a professional history; nothing is lost, because the branch
and all five `checkpoint/*` tags are pushed too. Reverse by: `git reset --hard` main
to `83c7e6c` and merge the branch normally instead.
