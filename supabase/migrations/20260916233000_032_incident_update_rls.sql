-- Film Festival OS™
-- Migration 032 — Explicit Incident lifecycle RLS
--
-- Replace the old combined incidents policy with explicit
-- SELECT / INSERT / UPDATE policies.

drop policy if exists incidents_select on public.incidents;
drop policy if exists incidents_write on public.incidents;
drop policy if exists incidents_insert on public.incidents;
drop policy if exists incidents_update on public.incidents;

create policy incidents_select
on public.incidents
for select
to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
);

create policy incidents_insert
on public.incidents
for insert
to authenticated
with check (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner']
  )
);

create policy incidents_update
on public.incidents
for update
to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner']
  )
)
with check (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner']
  )
);

grant select, insert, update
on table public.incidents
to authenticated;
