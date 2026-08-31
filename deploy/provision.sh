#!/usr/bin/env bash
#
# deploy/provision.sh | prepare a bare Oracle Linux 9 host to run this app.
#
# Run once, as a user with sudo. Safe to run again: every step checks before it
# acts, so a re-run repairs a half finished install rather than duplicating it.
#
#   sudo bash deploy/provision.sh
#
# What it does NOT do: deploy the code. That is deploy/release.sh, which can then
# be run as often as you like.
#
# What it does NOT touch: the existing Caddy site on this host. The site file is
# dropped into /etc/caddy/conf.d/ and the main Caddyfile only gains an import
# line, after being backed up.
#
set -euo pipefail

APP_USER=roadmap
APP_DIR=/opt/roadmap-tracker
ENV_DIR=/etc/roadmap-tracker
ENV_FILE="$ENV_DIR/roadmap.env"
DB_NAME=roadmap_tracker
DB_USER=roadmap
APP_PORT=3200
DOMAIN=roadmap.devpilotx.com
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[0;32mok\033[0m %s\n' "$*"; }
warn() { printf '    \033[0;33m!!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[0;31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run this with sudo"

# ---------------------------------------------------------------- 1. packages
say "Packages"
if ! command -v mysqld >/dev/null 2>&1; then
  # Oracle Linux 9 ships MySQL 8.0 in appstream. If that repo is unavailable for
  # any reason, fall back to the MySQL community repository rather than stopping.
  if dnf -y install mysql-server mysql >/dev/null 2>&1; then
    ok "mysql-server installed from the distribution repositories"
  else
    warn "appstream install failed, trying the MySQL community repository"
    dnf -y install "https://dev.mysql.com/get/mysql84-community-release-el9-1.noarch.rpm" \
      || die "could not add the MySQL community repository"
    dnf -y install mysql-server mysql || die "could not install mysql-server"
    ok "mysql-server installed from the community repository"
  fi
else
  ok "mysqld already present ($(mysqld --version 2>/dev/null | head -1))"
fi

command -v node >/dev/null 2>&1 || die "node is not installed on this host"
command -v npm  >/dev/null 2>&1 || die "npm is not installed on this host"
command -v git  >/dev/null 2>&1 || dnf -y install git
# gzip is needed by scripts/backup.mjs, tar by the release script.
command -v gzip >/dev/null 2>&1 || dnf -y install gzip
ok "node $(node --version), npm $(npm --version), git $(git --version | awk '{print $3}')"

NODE_MAJOR="$(node --version | sed 's/^v//' | cut -d. -f1)"
if (( NODE_MAJOR < 20 )); then
  die "node $(node --version) is too old; package.json requires >=20.9.0"
fi

# ------------------------------------------------------------- 2. mysql config
say "MySQL configuration for a 946 MB host"
install -o root -g root -m 0644 "$HERE/mysql-roadmap.cnf" /etc/my.cnf.d/roadmap.cnf
ok "/etc/my.cnf.d/roadmap.cnf written"

systemctl enable mysqld >/dev/null 2>&1 || true
if ! systemctl is-active --quiet mysqld; then
  systemctl start mysqld || {
    warn "mysqld did not start; last log lines follow"
    journalctl -u mysqld -n 30 --no-pager || true
    die "mysqld failed to start, see the log above"
  }
fi
# First start on a fresh datadir can take a while.
for _ in $(seq 1 30); do
  mysqladmin ping >/dev/null 2>&1 && break
  sleep 2
done
mysqladmin ping >/dev/null 2>&1 || die "mysqld is running but not answering"
ok "mysqld is up: $(mysql --version | awk '{print $3}')"

# --------------------------------------------------------- 3. database and user
say "Database, user and grants"

# A password is generated once and kept in the env file. If the env file already
# has one, it is reused, so re-running this script does not lock the app out of
# its own database.
if [[ -f "$ENV_FILE" ]] && grep -q '^DB_PASSWORD=' "$ENV_FILE"; then
  DB_PASSWORD="$(grep '^DB_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
  ok "reusing the existing database password from $ENV_FILE"
else
  DB_PASSWORD="$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-32)"
  ok "generated a new database password"
fi

# How to reach MySQL as an administrator. On a fresh Oracle Linux install root@
# localhost authenticates over the unix socket with no password when invoked as
# system root. If that is not the case, try the temporary password the server
# wrote to its log.
mysql_admin() { mysql --protocol=socket -u root "$@"; }
if ! mysql_admin -e 'SELECT 1' >/dev/null 2>&1; then
  TMP_PW="$(grep -oP 'temporary password is generated for root@localhost: \K.*' \
            /var/log/mysql/mysqld.log /var/log/mysqld.log 2>/dev/null | tail -1 || true)"
  if [[ -n "${TMP_PW:-}" ]]; then
    warn "using the temporary root password from the error log"
    ROOT_PW="$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-32)"
    mysql --connect-expired-password -u root -p"$TMP_PW" \
      -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$ROOT_PW';" \
      || die "could not set a root password"
    printf 'MySQL root password (store it somewhere safe): %s\n' "$ROOT_PW"
    mysql_admin() { mysql --protocol=socket -u root -p"$ROOT_PW" "$@"; }
  else
    die "cannot authenticate to MySQL as root; no temporary password found either"
  fi
fi
ok "authenticated to MySQL as root"

mysql_admin <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
ALTER  USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';

-- Everything the migrations and the application need, on this database only.
-- TRIGGER is required: 001_init.sql and 005_hardening.sql create five triggers,
-- and without it migrate.mjs fails partway with an access denied error.
-- EVENT is required by scripts/backup.mjs, which dumps with --events; without it
-- mysqldump aborts on "Couldn't execute 'show events': Access denied", so the
-- nightly backup fails while looking like a privilege problem in the app.
-- SUPER is deliberately absent, and so is any global privilege: mysqldump is
-- given --no-tablespaces precisely so it never asks for global PROCESS.
GRANT SELECT, INSERT, UPDATE, DELETE,
      CREATE, DROP, ALTER, INDEX, REFERENCES,
      CREATE TEMPORARY TABLES, LOCK TABLES,
      TRIGGER, EVENT, CREATE VIEW, SHOW VIEW,
      CREATE ROUTINE, ALTER ROUTINE, EXECUTE
  ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';

-- Anonymous users and the test database that some MySQL builds still ship.
DELETE FROM mysql.user WHERE User = '';
DROP DATABASE IF EXISTS test;

FLUSH PRIVILEGES;
SQL
ok "database $DB_NAME and user $DB_USER@localhost ready"

# ------------------------------------------------------------ 4. service user
say "Service user and directories"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$APP_DIR" --shell /sbin/nologin "$APP_USER"
  ok "created system user $APP_USER"
else
  ok "user $APP_USER exists"
fi

mkdir -p "$APP_DIR" "$APP_DIR/backups" "$ENV_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 0750 "$APP_DIR"
# 0750 root:roadmap, not 0700 root:root.
#
# systemd reads the EnvironmentFile as root before it drops privileges, so the
# service starts either way. Everything else does not: deploy/release.sh and all
# five cron jobs run as the service user and source this file directly, and a
# directory the service user cannot TRAVERSE gives "Permission denied" on a file
# whose own mode is perfectly correct. Group execute on the directory is what
# makes the 0640 group-readable file below actually reachable.
chown root:"$APP_USER" "$ENV_DIR"
chmod 0750 "$ENV_DIR"
ok "$APP_DIR and $ENV_DIR ready"

# --------------------------------------------------------------- 5. environment
say "Environment file"
if [[ -f "$ENV_FILE" ]]; then
  ok "$ENV_FILE already exists, leaving its secrets alone"
else
  SESSION_SECRET="$(openssl rand -hex 32)"
  TOKEN_ENC_KEY="$(openssl rand -hex 32)"
  cat > "$ENV_FILE" <<ENV
# /etc/roadmap-tracker/roadmap.env
#
# Generated by deploy/provision.sh on $(date -Is). Read by the systemd unit.
# Root owned, group readable by the service only. Never in git, never in the
# deployment directory.
#
# Rotating SESSION_SECRET signs everyone out, which is harmless.
# Rotating TOKEN_ENC_KEY makes a stored GitHub token undecryptable: clear the
# token on /profile FIRST.

NODE_ENV=production
PORT=$APP_PORT
HOST=127.0.0.1
PUBLIC_ORIGIN=https://$DOMAIN

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
DB_CONNECTION_LIMIT=10

SESSION_SECRET=$SESSION_SECRET
TOKEN_ENC_KEY=$TOKEN_ENC_KEY

TIMEZONE=Asia/Kolkata

# Caddy replaces X-Forwarded-For with the real peer address (see
# deploy/roadmap.caddy), so this header can be trusted and the login rate limit
# counts per visitor instead of putting every caller in one bucket.
TRUST_PROXY=1

# Left at the shipped defaults of 5 attempts per 15 minutes. Do not loosen these
# on something reachable from the internet.
# AUTH_RATE_LIMIT_MAX=
# AUTH_RATE_LIMIT_WINDOW_MINUTES=

# Unset means: signup is open only while the database has no users, so the first
# visit creates the account and the door closes by itself.
# ALLOW_SIGNUP=

FAKE_TODAY=
GITHUB_API=https://api.github.com

BACKUP_DIR=$APP_DIR/backups
BACKUP_KEEP_DAYS=14
MYSQLDUMP_BIN=mysqldump

# Bounds the JavaScript heap. This host has 946 MB of RAM and earlyoom is
# running; an unbounded heap is the thing that gets the process killed.
NODE_OPTIONS=--max-old-space-size=320
ENV
  chown root:"$APP_USER" "$ENV_FILE"
  chmod 0640 "$ENV_FILE"
  ok "$ENV_FILE written with freshly generated secrets"
fi

# ------------------------------------------------------------------ 6. systemd
say "systemd unit"
install -o root -g root -m 0644 "$HERE/roadmap-tracker.service" \
  /etc/systemd/system/roadmap-tracker.service
systemctl daemon-reload
systemctl enable roadmap-tracker >/dev/null 2>&1 || true
ok "roadmap-tracker.service installed and enabled"

# -------------------------------------------------------------------- 7. Caddy
say "Caddy site"
if ! command -v caddy >/dev/null 2>&1; then
  die "caddy is not installed; this host was expected to already be running it"
fi
mkdir -p /etc/caddy/conf.d /var/log/caddy

# The log file is created here, deliberately, with the right owner and the right
# SELinux label.
#
# Without this the deploy fails in a way that takes a while to read. `caddy
# validate` below runs as root and, in loading the config, OPENS the access log —
# which creates /var/log/caddy/roadmap.log owned by root and labelled var_log_t.
# Caddy itself runs as the caddy user under SELinux and needs httpd_log_t, so the
# subsequent `systemctl reload caddy` fails with "permission denied" on a file
# whose mode looks perfectly reasonable, and the site never comes up.
touch /var/log/caddy/roadmap.log
chown -R caddy:caddy /var/log/caddy 2>/dev/null || true
chmod 0640 /var/log/caddy/roadmap.log
if command -v restorecon >/dev/null 2>&1; then
  restorecon -R /var/log/caddy || true
  ok "SELinux context restored on /var/log/caddy"
fi
ok "/var/log/caddy ready for the caddy user"

# The existing Caddyfile serves another site and contains a credential. Back it
# up before touching it, every time, with a timestamp.
cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak.$(date +%Y%m%d-%H%M%S)"
ok "existing Caddyfile backed up"

install -o root -g root -m 0644 "$HERE/roadmap.caddy" /etc/caddy/conf.d/roadmap.caddy
if ! grep -q 'import /etc/caddy/conf.d/\*\.caddy' /etc/caddy/Caddyfile; then
  printf '\n# Added by deploy/provision.sh: per site files live in conf.d.\nimport /etc/caddy/conf.d/*.caddy\n' \
    >> /etc/caddy/Caddyfile
  ok "import line added to /etc/caddy/Caddyfile"
else
  ok "import line already present"
fi

if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
  ok "Caddy configuration is valid"
else
  warn "caddy validate failed; output follows"
  caddy validate --config /etc/caddy/Caddyfile || true
  die "refusing to reload Caddy with an invalid configuration"
fi

# ------------------------------------------------------------------- 8. cron
say "Scheduled jobs"
install -o root -g root -m 0644 "$HERE/crontab.roadmap" /etc/cron.d/roadmap-tracker
ok "/etc/cron.d/roadmap-tracker installed"

say "Provisioning complete"
cat <<NEXT
    Next: deploy the code.

        sudo bash $APP_DIR/deploy/release.sh

    The app will listen on 127.0.0.1:$APP_PORT and Caddy will serve
    https://$DOMAIN once the code is deployed and the service is running.
NEXT
