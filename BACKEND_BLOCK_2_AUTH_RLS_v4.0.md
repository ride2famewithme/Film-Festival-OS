# Film Festival OS™ — Backend Block 2: Authentication + Database RLS
Version: v4.0 FINAL working build — 3 September 2026

## Implemented in this source package
- Supabase production adapter path added beside the existing mock adapter.
- Email/password auth wired through the shared `db.auth` contract.
- Persisted active-tenant selection support added.
- PostgreSQL migration supplied for core tables, foreign keys, indexes and Row Level Security (RLS).
- Database policies separate platform admin, festival owner/staff, creator ownership, and restricted governance registers.
- Audit-event insert policy requires the authenticated actor ID.
- `.env.example` documents the deployment variables without embedding credentials.

## Security boundary
Client permission checks are convenience/UX checks only. In Supabase mode, RLS is intended to be the authoritative data-access boundary. The migration must be reviewed and applied to a controlled non-production project before release.

## Explicitly not claimed yet
This package has not been connected to a live Supabase project, penetration tested, production deployed, or certified. MFA, password-recovery flows, invitation flows, access-code redemption, rate limiting, secure evidence storage and complete workflow migration remain later blocks.
