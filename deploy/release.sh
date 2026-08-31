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
# --no-audit --no-fund keeps the output readable and avoids two network calls that
# can hang on a constrained box. Dev dependencies are installed on purpose.
if ! as_app "npm ci --no-audit --no-fund"; then
  warn "npm ci failed, retrying once with the cache cleaned"
  as_app "npm cache clean --force" || true
  as_app "npm ci --no-audit --no-fund" || die "npm ci failed twice"
fi
ok "dependencies installed"

say "Build"
# 946 MB of RAM, 6 GB of swap. The build is the most memory hungry thing that ever
# runs on this box, so the heap is bounded and the failure is explained rather than
# appearing as a silent kill by earlyoom.
if ! as_app "NODE_ENV=production NODE_OPTIONS=--max-old-space-size=512 npm run build"; then
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
    as_app "npm ci --no-audit --no-fund" || true
    as_app "NODE_ENV=production npm run build" || true
    systemctl restart "$SERVICE" || true
    warn "rolled back; the previous version is running again"
  fi
  die "deployment failed its health check"
fi

say "Reload Caddy"
if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
  systemctl reload caddy
  ok "caddy reloaded"
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
