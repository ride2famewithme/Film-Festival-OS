# FFOS™ — Local PostgreSQL rehearsal owner alignment fix
## 30 September 2026

The first Mac private-cluster rehearsal exposed an environment difference, not a migration defect.

### What happened

GitHub CI connects to disposable PostgreSQL as database role `postgres`. Migration 095 deliberately treats `current_user = 'postgres'` as a trusted maintenance/RPC path.

The first Mac runner created its temporary cluster with the macOS account name as the PostgreSQL superuser. After `RESET ROLE`, the test therefore returned to that local role instead of `postgres`, causing the trusted-path setup UPDATE to be correctly rejected by migration 095.

### Fix

The temporary rehearsal cluster now initializes with:

- PostgreSQL superuser `postgres`
- local trust authentication inside the private temporary cluster only
- private Unix socket only; TCP remains disabled
- the same three 095/096 integration suites
- complete temporary-cluster cleanup on exit

This aligns the local rehearsal identity with CI/Supabase maintenance expectations without weakening migration 095 and without touching the user's existing PostgreSQL cluster or live Supabase project.
