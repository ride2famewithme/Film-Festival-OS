# FFOS™ — Database Recovery + Live-Schema Verification Gate
## Supervisor Batch 02 · 30 September 2026

**Target project ref:** `htvmmciewewcdavgsdxe`
**Release candidate baseline:** `12e42169274800d5356899ddd523c1176bbb1496`
**Production decision:** HOLD until every required evidence item below is recorded.

This pack verifies evidence only. It does **not** apply migrations 095/096, restore a database, change memberships, expose juror content, process payments, or deploy the app.

## Milestone R1 — Recovery evidence

Record the Supabase **Database → Backups** page for the target project:

- latest available backup timestamp/date
- backup type shown by Supabase (logical / physical where displayed)
- whether PITR is enabled
- retention window where displayed
- whether “Restore to a New Project” or an equivalent non-destructive restore route is available
- named recovery owner
- target recovery objective agreed for this release

Do not click Restore while collecting evidence.

A local Git/source archive is not proof of database recovery. A downloadable dump is useful evidence, but recovery is not fully verified until a restore is rehearsed in an isolated/local or new staging project and the restored schema/data checks pass.

## Milestone S1 — Live target-schema inventory

Run `test/sql/live-jury-security-inventory-readonly.sql` in the **target FFOS Supabase SQL Editor**.

The script starts an explicit READ ONLY transaction and returns only schema/security metadata and aggregate counts. It intentionally omits juror identities, review text, film titles, emails and payment data.

Expected pre-deployment baseline:

1. `jury_assignments` and `jury_reviews` exist with RLS enabled.
2. Existing `jury_assignments_juror_update` UPDATE policy exists.
3. `submit_criterion_jury_review(uuid,text,text)` exists.
4. Migrations `20260926044000` (095) and `20260926090000` (096) should **not** appear as applied if the live hold has been respected.
5. New triggers from 095/096 should not already be present before approval:
   - `trg_guard_juror_assignment_update`
   - `trg_enforce_submitted_jury_review_immutability`
6. Aggregate anomaly counts are reviewed before any migration approval.

Any mismatch means HOLD and investigation. Do not “repair” the live schema during evidence collection.

## Milestone S2 — Isolated rehearsal

After R1 and S1 are accepted:

- restore/clone the production database to an isolated target, or reproduce the full production migration order in a staging database
- apply 095 then 096 there only
- run the existing jury assignment guard, submitted-review immutability and submit-RPC integration suites
- add distinct juror / other-juror / manager / trusted-RPC / cross-tenant negative checks against the restored/full schema
- test legacy clients for any direct submitted-review insert path that 096 would block

CI disposable fixtures already passing are supporting evidence, not a substitute for a restored/full-schema rehearsal.

## Milestone G — GO / HOLD record

A GO recommendation requires all of:

- restorable backup or isolated restore route evidenced
- live target schema matches 095/096 preflight assumptions
- full-schema isolated rehearsal PASS
- negative access tests PASS
- application compatibility PASS
- recovery owner and forward-repair procedure recorded
- explicit owner approval **after** the evidence package

Until then: **HOLD migrations 095/096.**

## Current official Supabase recovery context

Supabase documentation states that database backups and PITR are managed at the platform level depending on plan/configuration, and that restoring to a new project can provide an isolated database copy for testing. A database restore does not automatically reproduce every non-database service/configuration, so Edge Functions, Auth settings/API keys, Realtime settings, Storage objects/settings and similar external configuration must be checked separately.
