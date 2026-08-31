#!/usr/bin/env bash
#
# deploy/release.sh | put the current code live.
#
#   sudo bash /opt/roadmap-tracker/deploy/release.sh
#
# Order matters, and this order is the one the runbook used to get wrong:
#
#   npm ci  ->  build  ->  migrate  ->  verify  ->  restart  ->  health check
#
# Two things it deliberately does NOT do:
#
#   * `npm ci --omit=dev`. tsx and typescript are devDependencies, and every one of
#     the five cron jobs and `npm run verify` need tsx at runtime. Omitting dev
#     dependencies produces a deployment where the app serves pages and every
#     scheduled job fails silently at 02:30.
#   * skip the build. `next start` has nothing to serve without .next, and the
#     failure looks like a broken proxy rather than a missing build.
#
# A failed health check rolls the service back to the previous commit and restarts
# it, so a bad deploy costs seconds rather than an outage.
#
set -euo pipefail

APP_USER=roadmap
APP_DIR=/opt/roadmap-tracker
ENV_FILE=/etc/roadmap-tracker/roadmap.env
SERVICE=roadmap-tracker
APP_PORT=3200
DOMAIN=roadmap.devpilotx.com

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[0;32mok\033[0m %s\n' "$*"; }
warn() { printf '    \033[0;33m!!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[0;31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run this with sudo"
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE is missing; run deploy/provision.sh first"
[[ -d "$APP_DIR" ]]  || die "$APP_DIR is missing; run deploy/provision.sh first"

cd "$APP_DIR"

# What we roll back to if the health check fails.
PREVIOUS="$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo none)"
ok "current commit: $PREVIOUS"

# Everything below runs as the service user. Building as root would leave
# root-owned files in .next that the service then cannot write.
#
# The environment is sourced INSIDE the sudo shell, not outside it. sudo resets the
# environment by default, so sourcing the file in this script and then calling sudo
# hands the child a shell with no DB_USER and no DB_PASSWORD — which fails as
# "DB_USER and DB_NAME are not set" at the migrate step, after a five minute build,
# which is exactly how this was found. The service user can read the file because
# it is 0640 root:roadmap.
as_app() {
  sudo -u "$APP_USER" bash -lc "set -a; . '$ENV_FILE'; set +a; cd '$APP_DIR' && $*"
}

say "Ownership"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
ok "$APP_DIR owned by $APP_USER"

say "Dependencies"
# --include=dev is NOT redundant, and leaving it off cost a deploy.
#
# The environment file sets NODE_ENV=production, and `npm ci` honours that by
# omitting devDependencies exactly as though --omit=dev had been passed. tsx and
# typescript are devDependencies, and tsx is what runs the migrations, the seed
# verification and all five cron jobs. Without this flag the install silently
# produces a host where the app builds and every scheduled job fails at 02:30.
#
# --no-audit --no-fund keeps the output readable and avoids two network calls that
# can hang on a constrained box.
if ! as_app "npm ci --include=dev --no-audit --no-fund"; then
  warn "npm ci failed, retrying once with the cache cleaned"
  as_app "npm cache clean --force" || true
  as_app "npm ci --include=dev --no-audit --no-fund" || die "npm ci failed twice"
fi
as_app "test -d node_modules/tsx" \
  || die "tsx is missing after npm ci; the migrations and every cron job need it"
ok "dependencies installed, tsx present"

say "Build"
# 946 MB of RAM, 6 GB of swap. The build is the most memory hungry thing that ever
# runs on this box, so the heap is bounded and the failure is explained rather than
# appearing as a silent kill by earlyoom.
#
# A stale webpack cache left behind by an interrupted or differently-owned build
# produces a stream of ENOENT rename warnings and can wedge the build. It is a
# cache; deleting it costs one slower build.
as_app "rm -rf .next/cache" || true
#
# NEXT_SKIP_HOST_CHECKS=1 skips the lint and type check that next build would run.
# See the comment in next.config.ts: on this host those two took the machine into
# 1.3 GB of swap at 8% CPU, and they can tell us nothing that `npm run typecheck`
# and `npm run lint` have not already established on the authoring machine. The
# checks that can ONLY be made here — migrations, seed contract, health — are run
# below and abort the deploy.
if ! as_app "NODE_ENV=production NEXT_SKIP_HOST_CHECKS=1 NODE_OPTIONS=--max-old-space-size=512 npm run build"; then
  warn "the build failed; if it was killed, that is memory. Checking:"
  dmesg 2>/dev/null | tail -5 | grep -i -E 'killed process|out of memory' || true
  journalctl -t earlyoom -n 5 --no-pager 2>/dev/null || true
  die "npm run build failed"
fi
ok "build complete"

say "Migrations"
as_app "npm run migrate" || die "migrations failed; the database is NOT at the expected schema"
ok "migrations applied"

say "Seed contract"
# Exit 1 here means the reference data does not match Appendix E of final.md. That
# is a stop, not a warning: the whole application is derived from that data.
as_app "npm run verify" || die "seed verification failed"
ok "seed verified"

say "Restart"
systemctl restart "$SERVICE"
sleep 3
systemctl is-active --quiet "$SERVICE" || {
  journalctl -u "$SERVICE" -n 40 --no-pager
  die "$SERVICE did not stay running"
}
ok "$SERVICE is active"

say "Health check"
HEALTH=""
for attempt in $(seq 1 20); do
  HEALTH="$(curl -fsS --max-time 5 "http://127.0.0.1:$APP_PORT/api/healthz" 2>/dev/null || true)"
  if [[ "$HEALTH" == *'"db":"up"'* ]]; then
    ok "local health check passed: $HEALTH"
    break
  fi
  sleep 2
done

if [[ "$HEALTH" != *'"db":"up"'* ]]; then
  warn "health check did not pass. Last response: ${HEALTH:-<empty>}"
  journalctl -u "$SERVICE" -n 40 --no-pager
  if [[ "$PREVIOUS" != none ]]; then
    warn "rolling back to $PREVIOUS"
    git -C "$APP_DIR" reset --hard "$PREVIOUS"
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
    # Same flags as the forward path. A rollback that installs a different
    # dependency tree than the deploy did is not a rollback.
    as_app "npm ci --include=dev --no-audit --no-fund" || true
    as_app "NODE_ENV=production NEXT_SKIP_HOST_CHECKS=1 npm run build" || true
    systemctl restart "$SERVICE" || true
    warn "rolled back; the previous version is running again"
  fi
  die "deployment failed its health check"
fi

say "Reload Caddy"
# `caddy validate` runs as root and opens the access log, which can leave it
# root-owned and labelled var_log_t. Caddy runs as the caddy user and needs
# httpd_log_t, so repair both before reloading or the reload fails with a
# permission denied on a file whose mode looks fine. See provision.sh.
chown -R caddy:caddy /var/log/caddy 2>/dev/null || true
command -v restorecon >/dev/null 2>&1 && restorecon -R /var/log/caddy 2>/dev/null || true

if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
  chown -R caddy:caddy /var/log/caddy 2>/dev/null || true
  command -v restorecon >/dev/null 2>&1 && restorecon -R /var/log/caddy 2>/dev/null || true
  if systemctl reload caddy; then
    ok "caddy reloaded"
  else
    warn "caddy reload failed; the app is healthy but the public site may be stale"
    journalctl -u caddy -n 15 --no-pager | grep -i error | tail -3 || true
  fi
else
  warn "caddy configuration is invalid, NOT reloading"
  caddy validate --config /etc/caddy/Caddyfile || true
fi

say "Public check"
# Caddy may still be obtaining the certificate on a first deploy, so this is
# reported rather than fatal: the service itself has already been proven healthy.
PUBLIC="$(curl -fsS --max-time 15 "https://$DOMAIN/api/healthz" 2>/dev/null || true)"
if [[ "$PUBLIC" == *'"db":"up"'* ]]; then
  ok "https://$DOMAIN/api/healthz answers: $PUBLIC"
else
  warn "https://$DOMAIN did not answer yet: ${PUBLIC:-<empty>}"
  warn "if this is the first deploy, Caddy is probably still issuing the certificate."
  warn "watch it with: journalctl -u caddy -f"
fi

say "Released"
printf '    commit  %s\n' "$(git -C "$APP_DIR" rev-parse --short HEAD)"
printf '    service %s\n' "$(systemctl is-active "$SERVICE")"
printf '    logs    journalctl -u %s -f\n' "$SERVICE"
