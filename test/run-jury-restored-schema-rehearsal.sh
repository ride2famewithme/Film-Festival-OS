#!/usr/bin/env bash
set -euo pipefail

# Isolated database only; build uses placeholders and offline Expo settings.
# No dependency installs, deployment or replacement schema objects.
ffos_repo="${1:?Pass the existing application checkout}"
ffos_work="${2:?Pass a new evidence directory}"
ffos_container="ffos-restore-bootstrap-30sep2026"
ffos_sql="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sql/jury-restored-schema-regression.sql"
ffos_step="isolated container identity"
ffos_repo="$(cd "$ffos_repo" && pwd)"
if test -e "$ffos_work"; then
  echo 'HOLD: evidence directory already exists; refusing to overwrite it'
  exit 1
fi
mkdir -p "$ffos_work"
ffos_work="$(cd "$ffos_work" && pwd)"

report_exit() {
  ffos_exit=$?
  if test "$ffos_exit" -ne 0; then
    echo "HOLD at: $ffos_step"
    for ffos_log in "$ffos_work"/*.log; do
      if test -s "$ffos_log"; then
        echo "=== $ffos_log ==="
        tail -n 25 "$ffos_log"
      fi
    done
    echo "Evidence retained: $ffos_work"
  fi
}
trap report_exit EXIT

test "$(docker inspect --format '{{index .Config.Labels "ffos.purpose"}}' "$ffos_container" </dev/null)" = isolated-restore
test "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$ffos_container" </dev/null)" = none
test "$(docker inspect --format '{{.State.Running}}' "$ffos_container" </dev/null)" = true
test -s "$ffos_sql"

sql_stream() {
  docker exec -i "$ffos_container" psql -X -h /tmp \
    -U ffos_restore_admin -d ffos_restored -v ON_ERROR_STOP=1 "$@"
}
schema_snapshot() {
  docker exec "$ffos_container" pg_dump -h /tmp \
    -U ffos_restore_admin -d ffos_restored --schema-only </dev/null |
    sed '/^\\restrict /d; /^\\unrestrict /d'
}
data_snapshot() {
  sql_stream -At -F '|' <<'SQL'
select format(
 'select %L, count(*), md5(coalesce(string_agg(to_jsonb(t)::text,E''\n'' order by to_jsonb(t)::text),'''')) from %I.%I t;',
 schemaname||'.'||tablename,schemaname,tablename)
from pg_tables where schemaname in ('public','auth','vault')
order by schemaname,tablename
\gexec
SQL
}

echo '=== M1/2: RESTORED-SCHEMA RPC AND TENANT REGRESSION ==='
ffos_step="capture schema and row baselines"
schema_snapshot > "$ffos_work/schema-before.sql"
data_snapshot > "$ffos_work/rows-before.txt"

ffos_step="existing-schema metadata"
sql_stream > "$ffos_work/schema-metadata.txt" <<'SQL'
select table_schema,table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where (table_schema='public' and table_name in
 ('tenants','memberships','submissions','jury_panel_members','jury_scoring_forms',
  'jury_scoring_criteria','jury_assignments','jury_reviews','jury_review_criterion_scores'))
 or (table_schema='auth' and table_name='users')
order by table_schema,table_name,ordinal_position;
select t.tgrelid::regclass as table_name,t.tgname,pg_get_triggerdef(t.oid)
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal
 and ((n.nspname='auth' and c.relname='users')
   or (n.nspname='public' and c.relname in
     ('tenants','memberships','submissions','jury_panel_members','jury_scoring_forms',
      'jury_scoring_criteria','jury_assignments','jury_reviews','jury_review_criterion_scores')))
order by t.tgrelid::regclass::text,t.tgname;
SQL

ffos_step="real RPC, role isolation, governance and lock tests"
sql_stream < "$ffos_sql" > "$ffos_work/restored-regression.log" 2>&1
test "$(awk '/^PASS:/ {n++} END {print n+0}' "$ffos_work/restored-regression.log")" = 5
awk '/^PASS:/ {print}' "$ffos_work/restored-regression.log"

ffos_step="rollback row and schema comparison"
data_snapshot > "$ffos_work/rows-after.txt"
schema_snapshot > "$ffos_work/schema-after.sql"
if ! diff -u "$ffos_work/rows-before.txt" "$ffos_work/rows-after.txt" > "$ffos_work/rows.diff"; then
  cat "$ffos_work/rows.diff"
  exit 1
fi
if ! diff -u "$ffos_work/schema-before.sql" "$ffos_work/schema-after.sql" > "$ffos_work/schema.diff"; then
  cat "$ffos_work/schema.diff"
  exit 1
fi
echo 'M1 PASS — public/Auth/Vault table row hashes and database schema unchanged'

echo '=== M2/2: CLIENT CONTRACT, TYPESCRIPT AND WEB BUILD ==='
ffos_step="existing local build tools"
command -v node >/dev/null
test -x "$ffos_repo/node_modules/.bin/tsc"
test -x "$ffos_repo/node_modules/.bin/expo"
cd "$ffos_repo"
ffos_step="jury client compatibility contract"
node --test test/jury-review-client-compat.test.mjs > "$ffos_work/client-contract.log" 2>&1
tail -n 12 "$ffos_work/client-contract.log"

ffos_step="TypeScript release check"
ffos_config="tsconfig.app-check.json"
if test -f tsconfig.release.json; then ffos_config="tsconfig.release.json"; fi
./node_modules/.bin/tsc --noEmit -p "$ffos_config" > "$ffos_work/typescript.log" 2>&1
ffos_step="web export with CI placeholders"
EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co \
EXPO_PUBLIC_SUPABASE_ANON_KEY=ci-placeholder-anon-key \
EXPO_PUBLIC_ADAPTER=supabase \
EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 CI=1 \
./node_modules/.bin/expo export --platform web --output-dir "$ffos_work/web" \
  > "$ffos_work/web-build.log" 2>&1
test -s "$ffos_work/web/index.html"

echo '=== FINAL SAFETY PREVIEW ==='
echo 'DATABASE SCHEMA DIFF: EMPTY'
echo 'PUBLIC/AUTH/VAULT TABLE ROW DIFF: EMPTY'
git --no-pager diff --check
git --no-pager diff --stat
git status --short --branch
git rev-parse HEAD > "$ffos_work/app-commit.txt"
git diff --binary > "$ffos_work/app-working-tree.diff"
printf 'M1: PASS\nM2: PASS\nLive database: untouched\nLive release: HOLD — browser/Auth/Storage runtime smoke still pending\n' \
  > "$ffos_work/checkpoint.txt"
date -u '+Completed: %Y-%m-%dT%H:%M:%SZ' >> "$ffos_work/checkpoint.txt"
cat "$ffos_work/checkpoint.txt"
echo "Evidence: $ffos_work"
