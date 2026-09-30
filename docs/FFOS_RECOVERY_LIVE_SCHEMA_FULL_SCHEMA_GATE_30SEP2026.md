# FFOS™ — Recovery → Live Schema → Full-Schema 095/096 → GO/HOLD
## Supervisor Batch 04 · 30 September 2026

**Release-candidate base:** `be8a9db69470e0b3dc1764ee77bfa65723a9f669`

## Current evidence

- Release-candidate source and CI: PASS.
- Migration 096 client compatibility: PASS.
- Disposable PostgreSQL 095/096 suites: PASS.
- Local Mac rehearsal: previously HOLD because PostgreSQL server tools were not discovered automatically. Batch 04 broadens safe Mac tool discovery; the rehearsal itself still uses a brand-new private temporary PostgreSQL cluster.
- Database recovery evidence: HOLD until the target project's backup/PITR evidence is recorded.
- Live-schema security: HOLD until the live read-only result table is captured and reviewed.
- Live 095/096: HOLD.

## Milestone 1 — Local Mac rehearsal FIX

`test/run-jury-095-096-local-rehearsal.sh` now discovers PostgreSQL server tools through:

- current PATH / `pg_config --bindir`
- installed Homebrew PostgreSQL formulae
- Postgres.app
- EnterpriseDB `/Library/PostgreSQL`
- common Intel/Apple Silicon Homebrew paths
- MacPorts and `/usr/local/pgsql`
- a bounded macOS Spotlight fallback

The runner then creates a new temporary cluster, disables TCP, runs the three jury suites, stops the cluster and removes it.

## Milestone 2 — Live-schema one-table verdict

Run `test/sql/live-jury-release-gate-summary-readonly.sql` on the target FFOS Supabase project **before** migrations 095/096.

It returns one concise table with PASS/HOLD/REVIEW for:

1. 095 not already applied
2. 096 not already applied
3. jury tables present with RLS enabled
4. migration-095 preflight objects present
5. 095/096 triggers absent before deployment
6. trusted submit RPC security boundary
7. review status/timestamp anomalies
8. completed-assignment linkage anomalies

The query is a single SELECT-only statement. It has no trailing transaction-control statement, so Supabase SQL Editor displays the verdict table directly.

## Milestone 3 — Full-schema isolated post-check

After a verified backup is restored/cloned to an isolated Supabase project or an equivalent full-schema staging target:

1. verify the clone/restored database before mutation
2. apply migration 095 there only
3. apply migration 096 there only
4. run a separate existing-schema regression harness against the isolated target, using dedicated test identities and rollback of test data; the existing integration suites CREATE fixture tables/functions/auth stubs and must run only in disposable fixture databases
5. run `test/sql/post-095-096-isolated-gate-summary-readonly.sql`

The post-check requires the migration records, both security triggers, revoked authenticated table-wide UPDATE on `jury_reviews`, exactly the three allowed column UPDATE grants, and no review timestamp/status anomalies.

## Recovery decision

Preferred recovery evidence is an independent Supabase restore/clone where physical backups are available. If a logical backup is used instead, record its timestamp, checksum and a successful isolated restore. A source-code archive is not a database recovery proof.

## Final GO/HOLD rule

GO may be proposed only after:

- recovery route: PASS
- live pre-deploy schema summary: PASS (REVIEW items resolved)
- full-schema isolated 095/096 rehearsal: PASS
- application compatibility: PASS
- owner/recovery contact and forward-repair notes recorded

Production migration execution still requires explicit owner approval after the evidence package. Any missing or conflicting evidence remains HOLD.
