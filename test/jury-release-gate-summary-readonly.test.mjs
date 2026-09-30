import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const files = [
  './sql/live-jury-release-gate-summary-readonly.sql',
  './sql/post-095-096-isolated-gate-summary-readonly.sql',
];

const stripComments = (text) =>
  text
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

for (const file of files) {
  test(file + ' remains explicitly read-only', () => {
    const sql = stripComments(
      readFileSync(new URL(file, import.meta.url), 'utf8')
    );

    assert.match(sql, /\bbegin\s*;/i);
    assert.match(sql, /\bset\s+transaction\s+read\s+only\s*;/i);
    assert.match(sql, /\brollback\s*;/i);

    for (const forbidden of [
      /^\s*insert\s+into\b/im,
      /^\s*update\s+[a-z_."']/im,
      /^\s*delete\s+from\b/im,
      /^\s*truncate\b/im,
      /^\s*alter\b/im,
      /^\s*create\b/im,
      /^\s*drop\b/im,
      /^\s*grant\b/im,
      /^\s*revoke\b/im,
      /^\s*set\s+role\b/im,
      /^\s*call\b/im,
      /^\s*do\s+\$/im,
    ]) {
      assert.doesNotMatch(sql, forbidden);
    }
  });
}

test('pre-deploy summary covers the live 095/096 decision signals', () => {
  const sql = readFileSync(
    new URL(files[0], import.meta.url),
    'utf8'
  );
  for (const required of [
    '095 not yet applied',
    '096 not yet applied',
    'jury tables exist and RLS enabled',
    '095 preflight objects exist',
    '095/096 triggers absent before deployment',
    'submit RPC security boundary',
    'review status/timestamp anomalies',
    'completed assignment linkage',
  ]) {
    assert.ok(sql.includes(required), 'missing check: ' + required);
  }
});

test('post-deploy isolated summary covers the expected 095/096 controls', () => {
  const sql = readFileSync(
    new URL(files[1], import.meta.url),
    'utf8'
  );
  for (const required of [
    '095 applied in isolated target',
    '096 applied in isolated target',
    'security triggers installed',
    'jury_reviews authenticated table-wide UPDATE revoked',
    'jury_reviews authenticated column UPDATE limited',
  ]) {
    assert.ok(sql.includes(required), 'missing check: ' + required);
  }
});
