import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const inventory = readFileSync(
  new URL('./sql/live-jury-security-inventory-readonly.sql', import.meta.url),
  'utf8'
);

const executable = inventory
  .split('\n')
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('live inventory is explicitly transaction read-only', () => {
  assert.match(executable, /\bbegin\s*;/i);
  assert.match(executable, /\bset\s+transaction\s+read\s+only\s*;/i);
  assert.match(executable, /\brollback\s*;/i);
});

test('live inventory contains no mutation or privilege-changing statements', () => {
  for (const forbidden of [
    /\binsert\s+into\b/i,
    /\bupdate\s+[a-z_."']/i,
    /\bdelete\s+from\b/i,
    /\btruncate\b/i,
    /\balter\b/i,
    /\bcreate\b/i,
    /\bdrop\b/i,
    /\bgrant\b/i,
    /\brevoke\b/i,
    /\bset\s+role\b/i,
    /\breset\s+role\b/i,
    /\bcall\b/i,
    /\bdo\s+\$/i,
  ]) {
    assert.doesNotMatch(executable, forbidden);
  }
});

test('live inventory never selects sensitive jury content columns', () => {
  assert.doesNotMatch(executable, /\bfilmmaker_name\b/i);
  assert.doesNotMatch(executable, /\brecipient_email\b/i);
  assert.doesNotMatch(executable, /\brecommendation\s*(?:,|from)/i);
  assert.doesNotMatch(executable, /\bnotes\s*(?:,|from)/i);
  assert.doesNotMatch(executable, /\btitle\s*(?:,|from)/i);
});

test('live inventory covers issue-23 release-gate evidence', () => {
  for (const required of [
    'supabase_migrations.schema_migrations',
    'jury_assignments',
    'jury_reviews',
    'pg_catalog.pg_policies',
    'pg_catalog.pg_trigger',
    'submit_criterion_jury_review',
    'guard_juror_assignment_update',
    'enforce_submitted_jury_review_immutability',
    'information_schema.role_table_grants',
    'information_schema.role_column_grants',
    'completed_assignment_without_submitted_review',
  ]) {
    assert.ok(inventory.includes(required), 'missing evidence: ' + required);
  }
});
