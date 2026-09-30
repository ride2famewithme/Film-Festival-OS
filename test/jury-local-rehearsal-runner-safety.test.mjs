import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const script = readFileSync(
  new URL('./run-jury-095-096-local-rehearsal.sh', import.meta.url),
  'utf8'
);

test('local rehearsal creates and destroys a private PostgreSQL cluster', () => {
  assert.match(script, /mktemp -d/);
  assert.match(script, /initdb -D "\$PGDATA"/);
  assert.match(script, /pg_ctl -D "\$PGDATA" -w start/);
  assert.match(script, /pg_ctl -D "\$PGDATA" -m fast -w stop/);
  assert.match(script, /rm -rf "\$TMP_ROOT"/);
});

test('local rehearsal disables TCP and uses a private Unix socket', () => {
  assert.match(script, /listen_addresses = ''/);
  assert.match(script, /unix_socket_directories = '\$PGSOCK'/);
  assert.match(script, /export PGHOST="\$PGSOCK"/);
});

test('local rehearsal cannot target linked Supabase or an external database URL', () => {
  assert.doesNotMatch(script, /supabase\s+(?:link|db|migration)/i);
  assert.doesNotMatch(script, /https?:\/\//i);
  assert.doesNotMatch(script, /db\.[a-z0-9-]+\.supabase\.co/i);
  assert.match(script, /unset PGDATABASE DATABASE_URL SUPABASE_DB_URL/);
});

test('local rehearsal can discover common Mac PostgreSQL installations', () => {
  assert.match(script, /pg_config --bindir/);
  assert.match(script, /brew list --formula/);
  assert.match(script, /Postgres\.app\/Contents\/Versions/);
  assert.match(script, /\/Library\/PostgreSQL\/\*\/bin/);
  assert.match(script, /mdfind "kMDItemFSName == 'initdb'"/);
});

test('local rehearsal runs all three existing jury integration suites', () => {
  for (const path of [
    'test/sql/jury-assignment-guard-integration.sql',
    'test/sql/jury-review-immutability-integration.sql',
    'test/sql/jury-review-submit-rpc-integration.sql',
  ]) {
    assert.ok(script.includes(path), 'missing suite: ' + path);
  }
});
