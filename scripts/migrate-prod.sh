#!/usr/bin/env bash
# Backs up the production database, then applies new migrations.
# The owner runs this by hand before merging code. See "Migrating production"
# in the README.
set -euo pipefail

cd "$(dirname "$0")/.."

# pg_dump refuses a server newer than itself, so it runs in the server's version.
PG_IMAGE="${PG_IMAGE:-postgres:17}"
BACKUP_DIR="${BACKUP_DIR:-backups}"

fail() {
  echo "Stopped: $1" >&2
  exit 1
}

[ -t 0 ] || fail "run this by hand in a terminal."
[ -n "${PROD_DATABASE_URL:-}" ] || fail "PROD_DATABASE_URL is not set."
[ -n "${PGPASSWORD:-}" ] || fail "PGPASSWORD is not set."
# Command arguments can be seen in the process list, so the address has no password.
case "$PROD_DATABASE_URL" in
*://*:*@*) fail "take the password out of PROD_DATABASE_URL and put it in PGPASSWORD." ;;
esac
command -v docker >/dev/null || fail "Docker is needed to run pg_dump."
docker info >/dev/null 2>&1 || fail "Docker is not running."

# Inside Docker, 127.0.0.1 is the container, so a local test database needs its
# own address here. Production leaves this unset.
dump_url="${PG_DUMP_URL:-$PROD_DATABASE_URL}"

target="${PROD_DATABASE_URL##*@}"
target="${target%%\?*}"

echo "Database: $target"
echo
pnpm exec supabase db push --remote="$PROD_DATABASE_URL" --dry-run ||
  fail "couldn't read the migrations on this database."
echo

read -r -p "Type \"migrate\" to back up and apply them: " answer
[ "$answer" = "migrate" ] || fail "nothing was changed."

umask 077
mkdir -p "$BACKUP_DIR"
backup="$BACKUP_DIR/prod-$(date +%Y%m%d-%H%M%S).dump"

echo "Backing up to $backup"
# `-e NAME` copies the value from this environment, so it stays out of the arguments.
if ! DUMP_URL="$dump_url" docker run --rm -e DUMP_URL -e PGPASSWORD "$PG_IMAGE" sh -c \
  'exec pg_dump --format=custom --no-owner --no-privileges --schema=public --schema=auth --schema=supabase_migrations --dbname="$DUMP_URL"' \
  >"$backup"; then
  rm -f "$backup"
  fail "pg_dump failed, so nothing was migrated."
fi

[ -s "$backup" ] || fail "the backup is empty, so nothing was migrated."
docker run --rm -i "$PG_IMAGE" pg_restore --list <"$backup" >/dev/null ||
  fail "the backup can't be read, so nothing was migrated."

echo "Applying migrations"
pnpm exec supabase db push --remote="$PROD_DATABASE_URL" --yes ||
  fail "the migration failed. The backup is $backup."

echo "Done. The backup is $backup."
