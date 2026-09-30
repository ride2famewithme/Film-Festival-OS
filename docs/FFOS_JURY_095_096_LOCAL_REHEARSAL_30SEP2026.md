# FFOS™ — Local 095/096 Rehearsal + Application Compatibility
## Supervisor Batch 03 · 30 September 2026

**Release-candidate base:** `4f99bde960588fb869c1ee76e0d3b5b38b2b84a4`
**Purpose:** extend the jury release gate beyond disposable CI by giving the operator a repeatable local PostgreSQL rehearsal and a regression guard for the real application submission path.

## Milestone 1 — Local PostgreSQL rehearsal

Run:

```bash
bash test/run-jury-095-096-local-rehearsal.sh
```

The runner refuses non-local PostgreSQL hosts, creates three uniquely named disposable databases, runs the existing assignment-guard, submitted-review immutability and combined submit-RPC/095/096 suites, and drops those databases on exit.

A PASS here is independent local evidence, but it is still not a restored production-schema rehearsal.

## Milestone 2 — Application compatibility beyond 096

`test/jury-review-client-compat.test.mjs` verifies the release-candidate client:

- creates `jury_reviews` only as `draft`
- writes `submitted_at: null` at creation
- does not directly UPDATE `jury_reviews` through the application workflow
- finalizes through `submit_criterion_jury_review`
- retains tenant and juror scoping on draft lookup

This protects the client from silently reintroducing a direct-submission path that migration 096 would reject.

## Milestone 3 — Evidence escalation

The production gate remains separate:

1. Capture Supabase backup/PITR evidence for project `htvmmciewewcdavgsdxe`.
2. Run the merged read-only live-schema inventory and retain its result grid.
3. Compare live columns, RLS, policies, triggers, grants, function security and aggregate anomaly counts against the 095/096 preflight.
4. If recovery and live schema are clean, create an isolated restore/clone or logical schema/data rehearsal and run the same 095/096 suite there.
5. Only then prepare the explicit GO/HOLD record for live migration approval.

## Current verdict

- Source/CI safety: PASS.
- Existing disposable PostgreSQL 095/096 tests: PASS.
- Local Mac PostgreSQL rehearsal: PENDING until operator run.
- Database recovery: HOLD until backup/PITR evidence is captured.
- Live-schema security: HOLD until the read-only inventory results are captured and reviewed.
- Live 095/096 deployment: HOLD.
