#!/usr/bin/env bash
set -euo pipefail

# Film Festival OS™ — local PostgreSQL rehearsal for jury migrations 095/096.
# Safety boundary: this script rejects non-local PGHOST values and creates only
# uniquely named disposable databases. It never connects to linked Supabase.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOST="${FFOS_REHEARSAL_PGHOST:-127.0.0.1}"
PORT="${FFOS_REHEARSAL_PGPORT:-5432}"
USER_NAME="${FFOS_REHEARSAL_PGUSER:-${PGUSER:-$USER}}"

case "$HOST" in
  127.0.0.1|localhost|::1|/tmp|/var/run/postgresql) ;;
  *)
    echo "HOLD: refusing non-local PostgreSQL host: $HOST"
    exit 2
    ;;
esac

for cmd in psql createdb dropdb; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "HOLD: required local PostgreSQL command not found: $cmd"
    exit 2
  }
done

export PGHOST="$HOST" PGPORT="$PORT" PGUSER="$USER_NAME"

echo "=== LOCAL POSTGRESQL CONNECTION ==="
psql -X -v ON_ERROR_STOP=1 -d postgres -Atc   "select current_database() || '|' || current_user || '|' || current_setting('server_version');"

stamp="$(date +%Y%m%d%H%M%S)"
prefix="ffos_jury_rehearsal_${stamp}_$$"
db_guard="${prefix}_guard"
db_review="${prefix}_review"
db_rpc="${prefix}_rpc"

cleanup() {
  set +e
  dropdb --if-exists "$db_guard" >/dev/null 2>&1
  dropdb --if-exists "$db_review" >/dev/null 2>&1
  dropdb --if-exists "$db_rpc" >/dev/null 2>&1
}
trap cleanup EXIT INT TERM

echo "=== CREATE DISPOSABLE DATABASES ==="
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
echo "All disposable databases will now be dropped."
