import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(
  new URL('../data/workflows/festival-core.ts', import.meta.url),
  'utf8'
);

test('jury review creation remains draft-only for migration 096', () => {
  const inserts = [
    ...source.matchAll(
      /\.from<any>\('jury_reviews'\)\.insert\(\{([\s\S]*?)\}\);/g
    ),
  ];

  assert.equal(
    inserts.length,
    1,
    'expected one application insert path for jury_reviews'
  );

  const body = inserts[0][1];
  assert.match(body, /status:\s*'draft'/);
  assert.match(body, /submitted_at:\s*null/);
  assert.doesNotMatch(body, /status:\s*'submitted'/);
});

test('application does not directly update jury_reviews into submitted state', () => {
  assert.doesNotMatch(
    source,
    /\.from<any>\('jury_reviews'\)[\s\S]{0,120}\.update\s*\(/
  );
});

test('final jury submission uses the trusted submit RPC', () => {
  assert.match(
    source,
    /client\.rpc\(\s*'submit_criterion_jury_review'/
  );
});

test('application still scopes review draft access to tenant and juror', () => {
  const start = source.indexOf("export async function getOrCreateJuryReview");
  const end = source.indexOf("export async function listCriterionScores", start);
  const block = start >= 0 && end > start ? source.slice(start, end) : source;

  assert.match(block, /\.eq\('tenant_id',\s*ctx\.tenantId\)/);
  assert.match(block, /\.eq\('juror_user_id',\s*ctx\.userId\)/);
});
