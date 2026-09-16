-- Film Festival OS™
-- Migration 010 — Waiver & Discount Control Centre v2
-- 07 Sep 2026

alter table public.benefit_codes
  add column if not exists label text,
  add column if not exists starts_at timestamptz,
  add column if not exists deadline_waiver boolean not null default false,
  add column if not exists one_use_per_submitter boolean not null default false,
  add column if not exists visibility text not null default 'private',
  add column if not exists applies_to text not null default 'all',
  add column if not exists reason text,
  add column if not exists issued_by uuid references auth.users(id) on delete set null;

alter table public.benefit_codes
  drop constraint if exists benefit_codes_kind_check;

alter table public.benefit_codes
  add constraint benefit_codes_kind_check
  check (kind in ('percent','fixed','waiver','deadline'));

alter table public.benefit_codes
  drop constraint if exists benefit_codes_visibility_check;

alter table public.benefit_codes
  add constraint benefit_codes_visibility_check
  check (visibility in ('private','public'));

alter table public.benefit_codes
  drop constraint if exists benefit_codes_applies_to_check;

alter table public.benefit_codes
  add constraint benefit_codes_applies_to_check
  check (applies_to in ('all','selected'));

create table if not exists public.benefit_code_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  benefit_code_id uuid not null references public.benefit_codes(id) on delete cascade,
  category_id uuid not null references public.festival_categories(id) on delete cascade,
  unique (benefit_code_id, category_id)
);

alter table public.benefit_code_categories enable row level security;

drop policy if exists benefit_code_categories_manager_all
on public.benefit_code_categories;

create policy benefit_code_categories_manager_all
on public.benefit_code_categories
for all
using (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner','festival_staff']
  )
)
with check (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner','festival_staff']
  )
);

grant select, insert, update on table
  public.benefit_codes
to authenticated;

grant select, insert, update, delete on table
  public.benefit_code_categories
to authenticated;
