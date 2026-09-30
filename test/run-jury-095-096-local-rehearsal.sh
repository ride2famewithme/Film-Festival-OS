#!/usr/bin/env bash
set -euo pipefail

# Film Festival OS™ — isolated local PostgreSQL rehearsal for jury migrations 095/096.
#
# No Collateral Damage™:
# - creates a brand-new temporary PostgreSQL cluster under mktemp
# - disables TCP listening; connections use only its private Unix socket
# - never uses the linked Supabase project or an existing local database cluster
# - removes the whole temporary cluster on exit
#
# Requires local PostgreSQL server tools: initdb, pg_ctl, psql, createdb.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

find_pg_bin() {
  command -v initdb >/dev/null 2>&1 && return 0

  local candidate
  for candidate in     /Applications/Postgres.app/Contents/Versions/latest/bin     /opt/homebrew/opt/postgresql@*/bin     /opt/homebrew/opt/postgresql/bin     /usr/local/opt/postgresql@*/bin     /usr/local/opt/postgresql/bin     /Library/PostgreSQL/*/bin
  do
    if [ -x "$candidate/initdb" ]; then
      PATH="$candidate:$PATH"
      export PATH
      return 0
    fi
  done
  return 1
}

find_pg_bin || {
  echo "HOLD: PostgreSQL server tools were not found in PATH or common Mac locations."
  echo "Need: initdb, pg_ctl, psql and createdb."
  exit 2
}

for cmd in initdb pg_ctl psql createdb; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "HOLD: required PostgreSQL command not found: $cmd"
    exit 2
  }
done

TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ffos-jury-rehearsal.XXXXXX")"
PGDATA="$TMP_ROOT/data"
PGSOCK="$TMP_ROOT/socket"
mkdir -p "$PGSOCK"

cleanup() {
  set +e
  if [ -s "$PGDATA/postmaster.pid" ]; then
    pg_ctl -D "$PGDATA" -m fast -w stop >/dev/null 2>&1
  fi
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT INT TERM HUP

echo "=== INITIALISE PRIVATE POSTGRESQL CLUSTER ==="
initdb -D "$PGDATA" -A trust --no-locale --encoding=UTF8 >/dev/null

cat >> "$PGDATA/postgresql.conf" <<EOF
listen_addresses = ''
unix_socket_directories = '$PGSOCK'
fsync = off
synchronous_commit = off
full_page_writes = off
EOF

pg_ctl -D "$PGDATA" -w start >/dev/null

export PGHOST="$PGSOCK"
export PGPORT="5432"
export PGUSER="$(id -un)"
unset PGDATABASE DATABASE_URL SUPABASE_DB_URL

echo "=== PRIVATE CLUSTER IDENTITY ==="
psql -X -v ON_ERROR_STOP=1 -d postgres -Atc   "select current_database() || '|' || current_user || '|' || current_setting('server_version');"

prefix="ffos_jury_rehearsal_$$"
db_guard="${prefix}_guard"
db_review="${prefix}_review"
db_rpc="${prefix}_rpc"

createdb "$db_guard"
createdb "$db_review"
createdb "$db_rpc"

echo "=== 1/3 ASSIGNMENT WRITE GUARD ==="
psql -X -v ON_ERROR_STOP=1 -d "$db_guard"   -f test/sql/jury-assignment-guard-integration.sql

echo "=== 2/3 SUBMITTED REVIEW IMMUTABILITY ==="
psql -X -v ON_ERROR_STOP=1 -d "$db_review"   -f test/sql/jury-review-immutability-integration.sql

echo "=== 3/3 SUBMIT RPC + 095 + 096 COMBINED ==="
psql -X -v ON_ERROR_STOP=1 -d "$db_rpc"   -f test/sql/jury-review-submit-rpc-integration.sql

echo "=== FFOS LOCAL 095/096 REHEARSAL PASS ==="
echo "Temporary PostgreSQL cluster: PASS; cleanup will remove it now."
