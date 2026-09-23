# Film Festival OS™ — External Dependency Register

**Date:** 23 Sep 2026  
**Release branch:** `ci/ffos-release-candidate-22sep2026`  
**Purpose:** Prevent repeated cross-service troubleshooting and keep the FFOS release moving.

## Operating rule

External services are treated as bounded integrations, not open-ended debugging work.

For each provider:
1. Record the exact checkpoint.
2. Record the next single test.
3. Park non-blocking provider work after the timebox.
4. Do not reopen previously proven steps unless new evidence requires it.
5. Never store secrets, passwords, recovery keys, API secrets, or private credentials in Git.

## PayPal Sandbox

**Status:** PARTIAL E2E PASS — provider checkout reached.

Confirmed:
- FFOS payment record visible.
- Supabase policy row repaired.
- service_role runtime grants repaired.
- Sandbox Client ID + Client Secret replaced in Supabase.
- PayPal Sandbox OAuth succeeds after corrected secret.
- PayPal Sandbox checkout page opens for USD 15.00.
- Sandbox buyer/seller identities recorded separately in `FFOS_PAYPAL_SANDBOX_RUNBOOK_23SEP2026.md`.

Remaining:
- Sandbox buyer approval.
- Capture request.
- Verified PayPal webhook receipt.
- FFOS payment transition to PAID.
- Receipt/ledger verification.

**Next single test:** complete buyer approval for the existing USD 15.00 Sandbox checkout, then verify capture + webhook.  
**Release treatment:** do not block unrelated FFOS release work while this is pending.

## Supabase

**Status:** CORE BACKEND ACTIVE / PAYPAL SUPPORTING CHANGES APPLIED.

Confirmed:
- Project linked: `htvmmciewewcdavgsdxe`.
- Migrations through 087 applied.
- Edge Functions deployed for checkout/capture/webhook.
- Supabase remains the active FFOS backend.

Remaining release work:
- final migration alignment check
- schema/config backup excluding secrets
- final release evidence

## GitHub

**Status:** RELEASE CI ACTIVE.

Confirmed:
- Release branch: `ci/ffos-release-candidate-22sep2026`.
- CI release gate is operational.
- Multiple consecutive green runs after routing, platform-gate, PayPal diagnostics and DB fixes.

Remaining:
- final green release commit
- release tag / rollback reference
- final artifact/checksum record

## Hostinger

**Status:** PRODUCTION HOSTING / SEPARATE SYSTEMS.

Use only for:
- 2iops.com hosted PHP projects
- future FFOS production deployment when explicitly scheduled

Do not mix Hostinger troubleshooting into FFOS local/Supabase debugging unless a production-hosting defect requires it.

## Local Expo / Metro

**Status:** CI_STAGE is the release-candidate local source.

Rules:
- one Metro process
- one port: 8081
- QR terminal = Metro only
- Control terminal = Bash / Git / Supabase CLI
- never start a second Expo server while 8081 is already active

## Release principle

FFOS core completion takes priority over optional or production-provider polish.

A provider issue blocks the release only if it prevents a required release acceptance criterion. Otherwise it is recorded, parked, and resumed in a dedicated provider window.
