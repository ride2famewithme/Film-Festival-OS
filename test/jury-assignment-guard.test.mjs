// Static migration regression gate. A separate DB/JWT integration test is
// required before deployment; this test does NOT prove live RLS or trigger behaviour.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260926044000_095_jury_assignment_juror_write_guard.sql', import.meta.url),
  'utf8'
);

test('095 is transactional and checks existing RLS + review workflow', () => {
  assert.match(migration, /^begin;\s*$/im);
  assert.match(migration, /^commit;\s*$/im);
  assert.match(migration, /relrowsecurity/i);
  assert.match(migration, /jury_assignments_juror_update/);
  assert.match(migration, /submit_criterion_jury_review\(uuid,text,text\)/);
});

test('direct juror writes cannot change assignment governance columns', () => {
  assert.match(migration, /security invoker/i);
  assert.match(migration, /auth\.uid\(\) is distinct from old\.juror_user_id/i);
  assert.match(migration, /old\.tenant_id,\s*array\['juror'\]/i);
  assert.match(migration, /\(to_jsonb\(new\) - 'status'\) is distinct from\s*\(to_jsonb\(old\) - 'status'\)/i);
  assert.match(migration, /old\.status is distinct from 'assigned'/i);
  assert.match(migration, /new\.status is distinct from 'completed'/i);
});

test('completion requires the juror matching submitted review', () => {
  for (const clause of [
    /r\.assignment_id = old\.id/i,
    /r\.tenant_id = old\.tenant_id/i,
    /r\.submission_id = old\.submission_id/i,
    /r\.juror_user_id = auth\.uid\(\)/i,
    /r\.status = 'submitted'/i,
    /r\.submitted_at is not null/i,
  ]) {
    assert.match(migration, clause);
  }
});

test('trusted review/owner workflows remain possible and trigger is attached', () => {
  assert.match(migration, /current_user = 'postgres'/i);
  assert.match(migration, /auth\.role\(\) = 'service_role'/i);
  assert.match(migration, /public\.is_platform_admin\(\)/i);
  assert.match(migration, /old\.tenant_id,\s*array\['festival_owner'\]/i);
  assert.match(migration, /create trigger trg_guard_juror_assignment_update\s+before update on public\.jury_assignments/i);
});

test('095 does not mutate data, broaden privileges or replace existing RLS', () => {
  assert.doesNotMatch(migration, /^\s*(?:insert|update|delete|truncate)\s+(?:into\s+|from\s+)?public\./im);
  assert.doesNotMatch(migration, /^\s*(?:alter|create|drop)\s+policy\b/im);
  assert.doesNotMatch(migration, /^\s*grant\s+(?:select|insert|update|delete|all)\b/im);
  assert.doesNotMatch(migration, /public\.jury_reviews\s+set\b/im);
});
