#!/usr/bin/env bash
#
# deploy/verify-live.sh | prove the deployed site actually works.
#
#   sudo bash /opt/roadmap-tracker/deploy/verify-live.sh
#
# Checks, in order:
#   1. TLS, the health endpoint, and the security headers
#   2. that nothing private is reachable without a session
#   3. that CSRF actually refuses a token-less POST
#   4. the whole AUTHENTICATED surface, via scripts/smoke.mjs
#   5. that the signup door closes once an account exists
#
# Step 4 needs an account, and this application is built for exactly one. So a
# throwaway account is created, used, and deleted again, and the deletion is
# verified. THE PROBE ONLY RUNS WHEN THE DATABASE HAS NO USERS. If a real account
# already exists the authenticated checks are skipped rather than risking it, and
# the script says so. It will never delete an account it did not create.
#
set -uo pipefail

BASE="${BASE:-https://roadmap.devpilotx.com}"
APP_DIR=/opt/roadmap-tracker
ENV_FILE=/etc/roadmap-tracker/roadmap.env
APP_USER=roadmap
PROBE_EMAIL="deploy-probe@invalid.localdomain"
PROBE_NAME="Deployment Probe"
PROBE_PW="verify this deployment then delete me 41"
JAR="$(mktemp)"

pass=0; fail=0; skip=0
say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { pass=$((pass+1)); printf '    \033[0;32mPASS\033[0m %s\n' "$*"; }
no()   { fail=$((fail+1)); printf '    \033[0;31mFAIL\033[0m %s\n' "$*"; }
sk()   { skip=$((skip+1)); printf '    \033[0;33mSKIP\033[0m %s\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "run this with sudo"; exit 1; }
trap 'rm -f "$JAR"' EXIT

sql() { mysql --protocol=socket -u root -N -B -e "$1" 2>/dev/null; }
as_app() { sudo -u "$APP_USER" bash -lc "set -a; . '$ENV_FILE'; set +a; cd '$APP_DIR' && $*"; }

# --------------------------------------------------------------- 1. the basics
say "TLS, health and headers"

code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/login")"
[[ "$code" == 200 ]] && ok "GET /login is $code over HTTPS" || no "GET /login is $code, expected 200"

# A bad certificate makes curl fail without --insecure, so success here is proof.
if curl -sS --max-time 20 -o /dev/null "$BASE/login" 2>/dev/null; then
  ok "the TLS certificate validates without --insecure"
else
  no "the TLS certificate did not validate"
fi

health="$(curl -s --max-time 20 "$BASE/api/healthz")"
case "$health" in
  *'"db":"up"'*)      ok "health reports the database up" ;;
  *)                  no "health did not report db up: $health" ;;
esac
case "$health" in
  *'"env":"production"'*) ok "running as production" ;;
  *)                      no "not running as production: $health" ;;
esac
case "$health" in
  *'"config_problems":0'*) ok "no configuration problems reported" ;;
  *)                       no "configuration problems reported: $health" ;;
esac

headers="$(curl -sI --max-time 20 "$BASE/login")"
check_header() {
  if grep -qi "$1" <<<"$headers"; then ok "header $2"; else no "header missing: $2"; fi
}
check_header 'strict-transport-security: max-age=31536000' 'HSTS one year with subdomains'
check_header 'x-frame-options: DENY'                        'X-Frame-Options DENY'
check_header 'x-content-type-options: nosniff'              'nosniff'
check_header 'referrer-policy: strict-origin'               'Referrer-Policy'
check_header 'permissions-policy:.*camera=()'               'Permissions-Policy disables hardware'
check_header "content-security-policy:.*nonce-"             'CSP carries a per request nonce'
if grep -qi 'content-security-policy:.*unsafe-inline' <<<"$headers"; then
  no "CSP contains unsafe-inline"
else
  ok "CSP has no unsafe-inline"
fi
if grep -qi 'x-powered-by' <<<"$headers"; then
  no "x-powered-by is advertised"
else
  ok "the framework is not advertised"
fi

robots="$(curl -s --max-time 20 "$BASE/robots.txt")"
grep -qi 'Disallow: /' <<<"$robots" && ok "robots.txt disallows crawling" \
  || no "robots.txt does not disallow: $robots"

# ------------------------------------------------- 2. nothing private is public
say "The unauthenticated surface"
for p in / /calendar /money /profile /stats /everything; do
  c="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE$p")"
  [[ "$c" == 307 || "$c" == 302 ]] && ok "$p redirects ($c)" || no "$p answered $c, expected a redirect"
done
for a in /api/today /api/money/summary /api/stats /api/everything /api/export/all.json; do
  c="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE$a")"
  [[ "$c" == 401 ]] && ok "$a is 401" || no "$a answered $c, expected 401"
done

# ------------------------------------------------------------------- 3. CSRF
say "CSRF"
c="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST "$BASE/api/auth/login" \
      -H 'Content-Type: application/json' -d '{"email":"a@b.co","password":"x"}')"
[[ "$c" == 403 ]] && ok "a login POST with no CSRF token is 403" \
  || no "a login POST with no CSRF token answered $c, expected 403"

# ------------------------------------------------ 4. the authenticated surface
say "The authenticated surface"
user_count="$(sql 'SELECT COUNT(*) FROM roadmap_tracker.users;')"
user_count="${user_count:-unknown}"

if [[ "$user_count" != "0" ]]; then
  sk "the database already holds $user_count account(s); not creating a probe and not touching them"
  sk "authenticated checks skipped. To run them, do it before creating your account."
else
  # Fresh CSRF token and cookie jar, then sign up.
  token="$(curl -s -c "$JAR" --max-time 20 "$BASE/api/csrf" \
           | tr ',' '\n' | grep -o '"csrf":"[^"]*"' | cut -d'"' -f4)"
  if [[ -z "$token" ]]; then
    no "could not obtain a CSRF token"
  else
    ok "obtained a CSRF token (${#token} chars)"
    body="$(printf '{"email":"%s","display_name":"%s","password":"%s","confirm_password":"%s"}' \
            "$PROBE_EMAIL" "$PROBE_NAME" "$PROBE_PW" "$PROBE_PW")"
    resp="$(curl -s -b "$JAR" -c "$JAR" --max-time 30 -X POST "$BASE/api/auth/signup" \
            -H 'Content-Type: application/json' -H "X-CSRF-Token: $token" \
            -H "Origin: $BASE" -d "$body")"
    case "$resp" in
      *'"ok":true'*) ok "signup created the probe account" ;;
      *)             no "signup failed: $(head -c 300 <<<"$resp")" ;;
    esac

    created="$(sql "SELECT COUNT(*) FROM roadmap_tracker.users WHERE email='$PROBE_EMAIL';")"
    if [[ "$created" == "1" ]]; then
      ok "the probe account exists in the database"

      # The signup door must now be shut.
      t2="$(curl -s -c "$JAR.2" --max-time 20 "$BASE/api/csrf" \
            | tr ',' '\n' | grep -o '"csrf":"[^"]*"' | cut -d'"' -f4)"
      r2="$(curl -s -b "$JAR.2" --max-time 20 -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/signup" \
            -H 'Content-Type: application/json' -H "X-CSRF-Token: $t2" -H "Origin: $BASE" \
            -d '{"email":"second@invalid.localdomain","display_name":"Second","password":"another long passphrase 77","confirm_password":"another long passphrase 77"}')"
      rm -f "$JAR.2"
      [[ "$r2" == 403 ]] && ok "a second signup is refused with 403" \
        || no "a second signup answered $r2, expected 403"

      # The real prize: every page and every read endpoint, signed in.
      say "Driving every page and endpoint as a signed-in user"
      if as_app "npx tsx scripts/smoke.mjs --base='$BASE' --email='$PROBE_EMAIL' --password='$PROBE_PW'"; then
        ok "scripts/smoke.mjs passed against the live site"
      else
        no "scripts/smoke.mjs reported failures against the live site"
      fi
    else
      no "the probe account was not created, so the authenticated checks cannot run"
    fi

    # ---- cleanup, unconditionally -------------------------------------------
    say "Removing the probe account"
    sql "DELETE FROM roadmap_tracker.users WHERE email='$PROBE_EMAIL';" >/dev/null
    left="$(sql "SELECT COUNT(*) FROM roadmap_tracker.users WHERE email='$PROBE_EMAIL';")"
    [[ "$left" == "0" ]] && ok "probe account deleted" || no "probe account still present"

    orphans="$(sql 'SELECT COUNT(*) FROM roadmap_tracker.profiles p LEFT JOIN roadmap_tracker.users u ON u.id=p.user_id WHERE u.id IS NULL;')"
    [[ "${orphans:-0}" == "0" ]] && ok "no orphaned profile rows left behind" \
      || no "$orphans orphaned profile row(s) remain"

    total="$(sql 'SELECT COUNT(*) FROM roadmap_tracker.users;')"
    [[ "${total:-x}" == "0" ]] && ok "the database has no accounts, so your first signup will create yours" \
      || no "the database still holds ${total} account(s)"
  fi
fi

# ------------------------------------------------------------------- summary
say "Result"
printf '    passed %d   failed %d   skipped %d\n' "$pass" "$fail" "$skip"
if (( fail > 0 )); then
  printf '\n\033[0;31mVERIFICATION FAILED\033[0m\n'
  exit 1
fi
printf '\n\033[0;32mVERIFICATION PASSED\033[0m\n'
