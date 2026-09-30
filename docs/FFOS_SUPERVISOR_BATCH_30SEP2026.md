# Film Festival OS™ + Franchise — Supervisor batch 01

**Date:** 30 September 2026  
**Target:** `ci/ffos-release-candidate-22sep2026`  
**Baseline:** `690c4c391d09654161689727455ae983b7c74b4a`  
**Mode:** isolated source changes, deterministic CI, no production mutations.

## Four-milestone batch

| Milestone | Deliverable / evidence | Gate |
| --- | --- | --- |
| M1 — Source and architecture | Operator reported clean Mac release-candidate checkout at the baseline; original `16a7b6b` retained in a local recovery branch. Existing PR #24 CI had four worker jobs and Supervisor success. | Source baseline PASS; no full live-schema assurance implied. |
| M2 — Franchise implementation contract | Add `test/franchise-hierarchy-contract.test.mjs` to compare client FranchiseLevel, UI create choices and allowed parents, and migration 064 SQL tier/parent guards. Covers distinct national and regional capitals and prevents Global Master from being a normal UI creation option. | Static regression required; real database and permissions need separate tests. |
| M3 — Automated QA/QC | Wire the new franchise contract test into the existing QA/security GitHub Actions job, alongside TypeScript, web export, Edge Function checks and disposable PostgreSQL jury tests. Existing Supervisor remains fail-closed if a worker fails. | CI result must be checked on the draft PR; CI PASS is not a live release approval. |
| M4 — Release and franchise control | Preserve the HOLD from issue #23 on jury migrations 095/096. The initial filename search of one older HDD backup folder found no matching database dump; the separate archive and Supabase-managed backups have **not** been verified. Franchise quarterly policy material remains controlled draft outside the app and requires separate adoption checks. | No migration, payment, production deployment or public franchise offer under this batch. |

## Supervisor next batch — four independent lanes

1. **Recovery:** confirm target Supabase backup/PITR availability and a tested restore or staged recovery method. An archived source tree or SQL migrations are not proof of a restorable database.
2. **Security:** collect *read-only* target-schema inventory and compare it with migration 095/096 expectations. Then rehearse the complete migration sequence and negative cross-tenant/juror tests in an isolated full-schema clone.
3. **Application:** review the People & Roles workspace-context behaviour and franchise onboarding UI against the current tenant/RLS boundaries. A prior workspace-context discrepancy is not, by itself, proof of a data leak. Build regression tests before any change.
4. **Franchise governance:** map the private quarterly-return policy and controlled forms to role-scoped intake, submission status, exception handling and evidence retention. Do not infer a statutory audit, production adoption or executed franchise agreement from draft documentation.

## No Collateral Damage™ gate

Changes in this batch are limited to the new static test, CI wiring and this checkpoint. The branch is separate from `main` and the release candidate until review/integration. Never treat a source backup as a database restore, CI PASS as a production deployment authorization, or staged migrations as already applied. The full live-schema security and recovery gate remains HOLD pending evidence and the owner's explicit authorization for live operations.
