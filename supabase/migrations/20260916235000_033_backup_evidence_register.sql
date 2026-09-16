-- Film Festival OS™
-- Migration 033 — Backup Evidence Register

create table if not exists public.backup_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  label text not null,
  evidence_type text not null default 'full_backup',
  status text not null default 'recorded',
  created_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);

create index if not exists backup_evidence_tenant_idx
on public.backup_evidence(tenant_id, recorded_at desc);

alter table public.backup_evidence enable row level security;

drop policy if exists backup_evidence_select on public.backup_evidence;
drop policy if exists backup_evidence_insert on public.backup_evidence;
drop policy if exists backup_evidence_update on public.backup_evidence;

create policy backup_evidence_select
on public.backup_evidence
for select
to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(tenant_id, array['festival_owner'])
);

create policy backup_evidence_insert
on public.backup_evidence
for insert
to authenticated
with check (
  public.is_platform_admin()
  or public.has_tenant_role(tenant_id, array['festival_owner'])
);

create policy backup_evidence_update
on public.backup_evidence
for update
to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(tenant_id, array['festival_owner'])
)
with check (
  public.is_platform_admin()
  or public.has_tenant_role(tenant_id, array['festival_owner'])
);

grant select, insert, update
on table public.backup_evidence
to authenticated;
