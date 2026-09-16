# Film Festival OS™ v4.0 FINAL
Near-complete React Native / Expo product shell for the Film Festival OS™ milestone dated 3 September 2026.

The app now exposes the major role workspaces and festival lifecycle rooms while preserving the controlled distinction between UI/product-shell implementation and future production backend/testing/release evidence.

Run later during the test milestone with the normal Expo workflow. Deep troubleshooting and third-party integrations are intentionally deferred until the build is substantially complete.

## Optional Project Management™ module
v4.0 now includes the pre-test shell for Film Festival OS™ Project Management Software™: a franchise-aware portfolio/project management workspace intended for one responsive web/PWA codebase and in-app reuse. See `PWA_ARCHITECTURE_v4.0.md`.


## Backend Block 1 — 3 Sep 2026
Backend foundation added: typed multi-tenant schema, role/permission model, tenant-scoped service boundary and audit-event foundation. Production persistence/security remain untested. See `BACKEND_FOUNDATION_v4.0.md`.

## Backend Block 2 — Authentication & RLS
Set `EXPO_PUBLIC_ADAPTER=supabase` only after configuring a controlled Supabase project and applying/reviewing `supabase/migrations/20260903_001_core_auth_tenant_rls.sql`. See `.env.example` and `BACKEND_BLOCK_2_AUTH_RLS_v4.0.md`. No real credentials are included.
