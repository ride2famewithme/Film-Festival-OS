# Film Festival OS™ — Backend Block 6: Operations + HQ Workflows
**Version:** v4.0 FINAL  
**Date:** 2026-09-03

## Purpose
Close the next operational gap after submission/jury/commercial/awards workflows by implementing communication-template records, reporting/export job records, an operational snapshot dashboard, audit visibility and Global HQ tenant oversight.

## Implemented
- Communication Templates: create/list/pause active tenant templates.
- Notification Queue remains connected from Blocks 4–5; external send worker is explicitly deferred.
- Export Centre: request CSV/XLSX/JSON export jobs; inspect lifecycle; placeholder generated/expiry state.
- Operational Dashboard: adapter-backed counts for submissions, jury, notifications, payments, awards, PM and risks.
- Audit Event Register: tenant-scoped view of audit events written by implemented workflows.
- Global HQ Tenant Oversight: list tenant hierarchy and controlled operating status changes.
- Supabase migration `20260903_005_operations_hq.sql` with new tables, indexes and RLS policies.

## Database additions
- `communication_templates`
- `export_jobs`

## Important boundary
This block does **not** claim:
- external email delivery/retry webhooks;
- server-generated CSV/XLSX files or secure object-storage downloads;
- MFA/security-event telemetry;
- backup/restore assurance;
- production deployment or live Supabase validation.

## Status
**CODED / STATICALLY SANITY-CHECKED / NOT YET RUNTIME OR LIVE-BACKEND TESTED.**
