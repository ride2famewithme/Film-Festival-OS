// Static cross-layer regression: does not prove live RLS or franchise deployment.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const api = read('../data/workflows/franchise.ts');
const screen = read('../app/network.tsx');
const sql = read('../supabase/migrations/20260920015500_064_franchise_geography_capital_levels.sql');
const quoted = (value) => [...value.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
const sorted = (items) => [...items].sort();

const parents = {
  continent_master: ['global_master'],
  country_master: ['continent_master', 'global_master'],
  region_master: ['country_master'],
  capital_city: ['country_master'],
  regional_capital: ['region_master'],
  city_operator: ['region_master', 'capital_city', 'regional_capital', 'country_master'],
  festival_operator: ['city_operator', 'region_master', 'capital_city', 'regional_capital', 'country_master'],
  global_pool: ['global_master'],
};
const levels = ['global_master', ...Object.keys(parents)];

const typeBlock = api.match(/export type FranchiseLevel\s*=([\s\S]*?);/);
const checkBlock = sql.match(/franchise_level\s+in\s*\(([\s\S]*?)\)\s*\)/i);
const uiBlock = screen.match(/const creatableLevels:[\s\S]*?=\s*\[([\s\S]*?)\];/);
const rulesBlock = screen.match(/const parentRules:[\s\S]*?=\s*\{([\s\S]*?)\n\};/);

test('franchise levels agree between client type and SQL constraint', () => {
  assert.ok(typeBlock, 'FranchiseLevel type not found');
  assert.ok(checkBlock, 'SQL franchise-level constraint not found');
  assert.deepEqual(sorted(quoted(typeBlock[1])), sorted(levels));
  assert.deepEqual(sorted(quoted(checkBlock[1])), sorted(levels));
});

test('operator UI offers each non-HQ tier but not a second Global Master', () => {
  assert.ok(uiBlock, 'network UI level selector not found');
  const options = [...uiBlock[1].matchAll(/value:\s*'([a-z_]+)'/g)].map((match) => match[1]);
  assert.deepEqual(sorted(options), sorted(Object.keys(parents)));
  assert.doesNotMatch(uiBlock[1], /value:\s*'global_master'/);
});

test('UI permitted parents match the approved franchise hierarchy', () => {
  assert.ok(rulesBlock, 'network parentRules not found');
  const actual = {};
  for (const match of rulesBlock[1].matchAll(/([a-z_]+):\s*\[([\s\S]*?)\]/g)) {
    actual[match[1]] = quoted(match[2]);
  }
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(parents).sort());
  for (const [level, allowed] of Object.entries(parents)) {
    assert.deepEqual(sorted(actual[level]), sorted(allowed), level + ': incorrect parents');
  }
});

test('SQL validator retains the hierarchy parent checks', () => {
  assert.match(sql, /if p_level = 'global_master' then/);
  for (const [level, allowed] of Object.entries(parents)) {
    const marker = "when '" + level + "' then";
    const start = sql.indexOf(marker);
    assert.notEqual(start, -1, 'validator branch missing: ' + level);
    const next = sql.indexOf("\n    when '", start + marker.length);
    const branch = sql.slice(start, next < 0 ? undefined : next);
    assert.match(branch, /v_parent_level/, level + ': parent validation missing');
    for (const parent of allowed) {
      assert.ok(branch.includes("'" + parent + "'"), level + ': missing SQL parent ' + parent);
    }
  }
});
