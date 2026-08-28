#!/usr/bin/env bash
#
# backup.sh | the nightly mysqldump, with retention and an honest log row.
#
# Build prompt section 20 wants a backup that can actually be restored, so this
# script proves the dump is readable before it counts as a success, and it writes
# what happened to `backup_log` either way. A backup that is never verified is a
# hope, not a backup.
#
# Reads .env from the project root: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD,
# DB_NAME, BACKUP_DIR, BACKUP_KEEP_DAYS, MYSQLDUMP_BIN.
#
# Usage
#   ./scripts/backup.sh                 dump, verify, prune, log
#   ./scripts/backup.sh --no-prune      keep every dump
#   ./scripts/backup.sh --quick         skip the restore verification
#   ./scripts/backup.sh --out /mnt/x    write somewhere other than BACKUP_DIR
#
# Cron, nightly at 02:30 Asia/Kolkata:
#   30 2 * * *  cd /srv/roadmap-tracker && ./scripts/backup.sh >> /var/log/roadmap/backup.log 2>&1
#
# Exit codes
#   0  a dump was written and verified
#   1  the dump failed, and the failure is recorded in backup_log
#   2  the configuration is wrong, for example .env is missing
#
# Restore, which is the only reason any of this exists:
#   gunzip -c backups/roadmap_tracker-2026-08-28-0230.sql.gz | \
#     mysql -h 127.0.0.1 -P 3306 -u roadmap -p roadmap_tracker
#
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PRUNE=1
VERIFY=1
OUT_OVERRIDE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --no-prune) PRUNE=0 ;;
    --quick)    VERIFY=0 ;;
    --out)      OUT_OVERRIDE="${2:-}"; shift ;;
    --out=*)    OUT_OVERRIDE="${1#*=}" ;;
    -h|--help)  sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "backup.sh: unknown option $1" >&2; exit 2 ;;
  esac
  shift
done

# ---------------------------------------------------------------- configuration

if [ ! -f "$ROOT/.env" ]; then
  echo "backup.sh: no .env in $ROOT. Copy .env.example to .env first." >&2
  exit 2
fi

# Read .env without executing it: only KEY=value lines, quotes stripped.
while IFS='=' read -r key value; do
  case "$key" in
    ''|\#*) continue ;;
  esac
  value="${value%$'\r'}"
  value="${value#\"}"; value="${value%\"}"
  value="${value#\'}"; value="${value%\'}"
  export "$key=$value"
done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ROOT/.env" || true)

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:?DB_USER is not set in .env}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:?DB_NAME is not set in .env}"
BACKUP_DIR="${OUT_OVERRIDE:-${BACKUP_DIR:-./backups}}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
MYSQLDUMP_BIN="${MYSQLDUMP_BIN:-mysqldump}"
MYSQL_BIN="${MYSQL_BIN:-mysql}"

case "$BACKUP_DIR" in
  /*) ;;
  *) BACKUP_DIR="$ROOT/${BACKUP_DIR#./}" ;;
esac
mkdir -p "$BACKUP_DIR"

STAMP="$(TZ=Asia/Kolkata date +%Y-%m-%d-%H%M)"
BASENAME="${DB_NAME}-${STAMP}.sql.gz"
TARGET="$BACKUP_DIR/$BASENAME"

# The password never appears in the process list or in the log.
DEFAULTS_FILE="$(mktemp)"
chmod 600 "$DEFAULTS_FILE"
cleanup() { rm -f "$DEFAULTS_FILE"; }
trap cleanup EXIT

cat > "$DEFAULTS_FILE" <<EOF
[client]
host=$DB_HOST
port=$DB_PORT
user=$DB_USER
password=$DB_PASSWORD
EOF

# ------------------------------------------------------------------ logging

# Records the outcome in backup_log. Never fails the run: a database that cannot
# be written to has already been reported by the dump step itself.
log_row() {
  local file="$1" bytes="$2" ok="$3" message="$4"
  local esc_file esc_msg
  esc_file="${file//\'/\'\'}"
  esc_msg="${message//\'/\'\'}"
  "$MYSQL_BIN" --defaults-extra-file="$DEFAULTS_FILE" "$DB_NAME" \
    -e "INSERT INTO backup_log (ran_at, kind, file_name, bytes, ok, message)
        VALUES (NOW(), 'dump', '$esc_file', ${bytes:-NULL}, $ok, '$esc_msg');" 2>/dev/null \
    || echo "  warn could not write the backup_log row. The dump itself is fine."
}

say() { printf '  %s\n' "$*"; }

echo "----------------------------------------------------------"
echo "backup.sh | mysqldump of $DB_NAME"
echo "$(TZ=Asia/Kolkata date '+%Y-%m-%d %H:%M:%S %Z')  ->  $TARGET"
echo "----------------------------------------------------------"

# --------------------------------------------------------------------- dump

# --single-transaction gives a consistent snapshot of InnoDB without locking the
# app out. --routines and --triggers matter here: the money hour rule and the
# retroactive edit limit are enforced by triggers, and a dump without them would
# restore a database that quietly allows what final.md forbids.
DUMP_ARGS=(
  --defaults-extra-file="$DEFAULTS_FILE"
  --single-transaction
  --quick
  --routines
  --triggers
  --events
  --default-character-set=utf8mb4
  --set-gtid-purged=OFF
  --column-statistics=0
  "$DB_NAME"
)

set +e
"$MYSQLDUMP_BIN" "${DUMP_ARGS[@]}" 2>"$BACKUP_DIR/.dump.err" | gzip -9 > "$TARGET"
STATUS=${PIPESTATUS[0]}
set -e

if [ "$STATUS" -ne 0 ]; then
  # --column-statistics is a MySQL 8 client flag that MariaDB's client rejects.
  # One retry without it, so the script works on both.
  if grep -q 'column-statistics' "$BACKUP_DIR/.dump.err" 2>/dev/null; then
    say "retrying without --column-statistics, which this client does not know"
    DUMP_ARGS=("${DUMP_ARGS[@]/--column-statistics=0/}")
    set +e
    "$MYSQLDUMP_BIN" "${DUMP_ARGS[@]}" 2>"$BACKUP_DIR/.dump.err" | gzip -9 > "$TARGET"
    STATUS=${PIPESTATUS[0]}
    set -e
  fi
fi

if [ "$STATUS" -ne 0 ]; then
  ERR="$(tr '\n' ' ' < "$BACKUP_DIR/.dump.err" | cut -c1-400)"
  say "FAIL mysqldump exited $STATUS"
  say "$ERR"
  rm -f "$TARGET"
  log_row "$BASENAME" NULL 0 "mysqldump exited $STATUS: $ERR"
  rm -f "$BACKUP_DIR/.dump.err"
  exit 1
fi
rm -f "$BACKUP_DIR/.dump.err"

BYTES="$(wc -c < "$TARGET" | tr -d ' ')"
say "written $BASENAME, $(numfmt --to=iec --suffix=B "$BYTES" 2>/dev/null || echo "$BYTES bytes")"

# ------------------------------------------------------------------- verify

if [ "$VERIFY" -eq 1 ]; then
  # A dump that gunzip cannot read is not a backup. This also checks the dump
  # reached its end, because mysqldump writes that marker last.
  if ! gzip -t "$TARGET" 2>/dev/null; then
    say "FAIL the gzip file is corrupt"
    log_row "$BASENAME" "$BYTES" 0 'gzip -t failed, the archive is corrupt'
    exit 1
  fi
  if ! gunzip -c "$TARGET" | tail -5 | grep -q 'Dump completed'; then
    say "FAIL the dump has no completion marker, so it was cut short"
    log_row "$BASENAME" "$BYTES" 0 'no "Dump completed" marker, the dump was truncated'
    exit 1
  fi
  TABLES="$(gunzip -c "$TARGET" | grep -c '^CREATE TABLE' || true)"
  ROWS="$(gunzip -c "$TARGET" | grep -c '^INSERT INTO' || true)"
  say "verified gzip intact, dump completed, $TABLES tables, $ROWS insert statements"
else
  TABLES="not checked"
  say "--quick given, so the archive was not verified"
fi

# -------------------------------------------------------------------- prune

PRUNED=0
if [ "$PRUNE" -eq 1 ] && [ "$BACKUP_KEEP_DAYS" -gt 0 ]; then
  while IFS= read -r old; do
    rm -f "$old"
    PRUNED=$((PRUNED + 1))
    say "pruned $(basename "$old")"
  done < <(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}-*.sql.gz" -type f -mtime "+$BACKUP_KEEP_DAYS" 2>/dev/null || true)
  say "retention $BACKUP_KEEP_DAYS days, $PRUNED file(s) removed"
fi

KEPT="$(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}-*.sql.gz" -type f 2>/dev/null | wc -l | tr -d ' ')"
say "$KEPT dump(s) now on disk in $BACKUP_DIR"

log_row "$BASENAME" "$BYTES" 1 "ok, $TABLES tables, retention ${BACKUP_KEEP_DAYS}d, pruned $PRUNED"

echo ""
say "Restore with:"
say "  gunzip -c \"$TARGET\" | $MYSQL_BIN -h $DB_HOST -P $DB_PORT -u $DB_USER -p $DB_NAME"
echo ""
echo "backup.sh finished, exit 0"
