# Decisions

Only decisions that were irreversible, architectural, or that a future maintainer
would otherwise have to reverse-engineer. Routine choices were made alone and are
in `ASSUMPTIONS.md`.

---

## ADR-001: Corrections ship as new migrations, never as edits to applied ones
Date: 2026-08-31 | Trigger: six schema defects in `001_init.sql` | Reversibility: easy

**Decision:** add `005_hardening.sql` and `006_lead_touch_idempotency.sql` rather
than editing `001_init.sql`.

**Rationale:** `scripts/migrate.mjs` records the SHA-256 of every migration and
treats a changed file as a hard stop, by design, because running different SQL
under the same name is how databases drift. Editing 001 would have made every
existing database refuse to migrate. A fresh install reaches the same final state
by applying 001 through 006 in order — verified on the VPS, which was a genuinely
empty database.

**Rejected:** editing 001 and re-running with `--force`. It would have worked on a
fresh host and silently diverged on any database that already existed.

**Reversal:** `DROP TRIGGER`/`ALTER TABLE` back, and delete the two rows from
`migrations_applied`.

---

## ADR-002: The 7-day retroactive rule applies to human edits, not to derived columns
Date: 2026-08-31 | Trigger: CRITICAL — the app could not write its own projections | Reversibility: easy

**Decision:** `trg_day_logs_no_backdate_upd` now fires only when a column a person
enters actually changes. `week_n`, `pushes`, `money_touches`, `day_colour` and
`conditions_met` are exempt.

**Rationale:** Part 18.7 rule 3 forbids rewriting history. Recomputing a projection
from other tables is not rewriting history; it is the application keeping itself
consistent. The original trigger blocked `recomputeDay()` outright, so from the
eighth day of real use GitHub sync, repository edits and any start-date change
would all have become 500s. Proven by `tests/triggers.test.mjs`, 7 assertions:
the derived write passes on a 30-day-old row, and every human edit — including
setting a nullable column to NULL, which a plain `!=` would have let through — is
still refused.

**Dissent (BREAKER):** the exempt list is now a second place that has to agree with
`recomputeDay()`. If someone adds a derived column and forgets the trigger, the bug
returns silently. Not resolved; mitigated only by the regression test and by both
sites naming each other in comments.

**Reversal:** restore the original two-line trigger body from `001_init.sql`.

---

## ADR-003: Deploy natively under systemd behind the existing Caddy, not Docker
Date: 2026-08-31 | Trigger: choosing the deployment shape | Reversibility: hard

**Decision:** run the app as a systemd service on 127.0.0.1:3200 and add a site
file to the Caddy instance already running on the host.

**Rationale:** evidence from the host, not preference. It already runs Caddy on 80
and 443 serving `mcp-albert.devpilotx.com`, and Docker and podman are both absent.
Installing nginx would have fought Caddy for port 443 and broken a working service.
Installing Docker on a 946 MB machine to run a container next to a native MySQL
would have spent memory the build already struggles for. Caddy also issues and
renews TLS itself, which removes certbot and a renewal cron entirely.

**Rejected:** Docker Compose (the repo has a working compose file). It would have
required installing a container runtime and duplicating the reverse proxy.

**Reversal:** hard but bounded. `docker-compose.yml` is still present and correct;
switching means installing a runtime, moving the database, and pointing Caddy at
the container port.

---

## ADR-004: `X-Forwarded-For` is overwritten at the proxy, not merely passed
Date: 2026-08-31 | Trigger: `TRUST_PROXY=1` is required for per-visitor rate limiting | Reversibility: easy

**Decision:** `deploy/roadmap.caddy` sets `header_up X-Forwarded-For {remote_host}`.

**Rationale:** the application is configured to believe that header when deciding
whose login attempt it is counting. Caddy's default appends the peer address to
whatever the client sent, so a caller supplying their own value can present a new
identity per request and walk straight past a per-address limit. Overwriting it is
the precondition that makes `TRUST_PROXY=1` safe at all. Caddy emits a cosmetic
"unnecessary header_up" warning for this; the warning is wrong about intent.

**Reversal:** delete the two `header_up` lines and set `TRUST_PROXY=0`, accepting
that every caller then shares one rate-limit bucket.

---

## ADR-005: The production host does not re-run lint and type-check during the build
Date: 2026-08-31 | Trigger: the build drove the host into swap and stalled | Reversibility: easy

**Decision:** `deploy/release.sh` sets `NEXT_SKIP_HOST_CHECKS=1`, which
`next.config.ts` reads to set `eslint.ignoreDuringBuilds` and
`typescript.ignoreBuildErrors`. Unset everywhere else.

**Rationale:** measured, not assumed. Compiling takes about six minutes on this
host; the lint and type-check phase afterwards pushed it to 1.3 GB of swap at 8%
CPU — thrashing, with earlyoom waiting. Neither check can tell the host anything
the authoring machine has not already established, where both are separate gates
that must exit 0. The checks that only the host can make — migrations, the seed
contract, and a health check against a real database — are the ones
`release.sh` does run, and it aborts and rolls back on any of them.

**Dissent (ARCHITECT):** a deployment that does not type-check is a deployment
that can ship a type error if someone bypasses the local gates. Accepted, because
the alternative was a deploy that cannot finish.

**Reversal:** remove the environment variable from `release.sh`.
