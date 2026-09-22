-- Film Festival OS™ v4.0
-- Migration 061 — Franchise Operator & Territory Foundation
-- Builds on the existing tenants.parent_tenant_id hierarchy.
--
-- IMPORTANT:
-- This records operational / commercial territory relationships.
-- It does not itself grant legal franchise rights or exclusivity.

create table if not exists public.franchise_profiles (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null unique
    references public.tenants(id)
    on delete cascade,

  franchise_level text not null
    check (
      franchise_level in (
        'global_master',
        'continent_master',
        'country_master',
        'region_master',
        'capital_city',
        'city_operator',
        'festival_operator',
        'global_pool'
      )
    ),

  territory_name text not null,

  continent_name text,
  country_name text,
  country_code text,
  region_name text,
  city_name text,

  status text not null default 'onboarding'
    check (
      status in (
        'prospect',
        'onboarding',
        'active',
        'suspended',
        'expired',
        'terminated'
      )
    ),

  exclusive_territory boolean not null default false,

  population_reference integer
    check (
      population_reference is null
      or population_reference >= 0
    ),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists franchise_profiles_tenant_idx
  on public.franchise_profiles(tenant_id);

create index if not exists franchise_profiles_level_idx
  on public.franchise_profiles(franchise_level);

create index if not exists franchise_profiles_country_idx
  on public.franchise_profiles(country_code);

create index if not exists franchise_profiles_status_idx
  on public.franchise_profiles(status);


create table if not exists public.franchise_onboarding_steps (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  step_key text not null,

  label text not null,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'in_progress',
        'complete',
        'not_required'
      )
    ),

  completed_at timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, step_key)
);


create index if not exists franchise_onboarding_tenant_idx
  on public.franchise_onboarding_steps(tenant_id);


alter table public.franchise_profiles
  enable row level security;

alter table public.franchise_onboarding_steps
  enable row level security;


drop policy if exists franchise_profiles_select
  on public.franchise_profiles;

create policy franchise_profiles_select
  on public.franchise_profiles
  for select
  to authenticated
  using (
    public.is_platform_admin()
    or public.has_tenant_role(tenant_id)
  );


drop policy if exists franchise_profiles_admin_write
  on public.franchise_profiles;

create policy franchise_profiles_admin_write
  on public.franchise_profiles
  for all
  to authenticated
  using (
    public.is_platform_admin()
  )
  with check (
    public.is_platform_admin()
  );


drop policy if exists franchise_onboarding_select
  on public.franchise_onboarding_steps;

create policy franchise_onboarding_select
  on public.franchise_onboarding_steps
  for select
  to authenticated
  using (
    public.is_platform_admin()
    or public.has_tenant_role(tenant_id)
  );


drop policy if exists franchise_onboarding_admin_write
  on public.franchise_onboarding_steps;

create policy franchise_onboarding_admin_write
  on public.franchise_onboarding_steps
  for all
  to authenticated
  using (
    public.is_platform_admin()
  )
  with check (
    public.is_platform_admin()
  );


grant select, insert, update, delete
  on public.franchise_profiles
  to authenticated;

grant select, insert, update, delete
  on public.franchise_onboarding_steps
  to authenticated;


comment on table public.franchise_profiles is
'Film Festival OS™ franchise / operator territory metadata layered over the existing tenant hierarchy.';

comment on column public.franchise_profiles.exclusive_territory is
'Operational flag only. Legal exclusivity must be supported by the applicable executed agreement.';

comment on column public.franchise_profiles.population_reference is
'Optional planning/reference population for territory categorisation. Not a legal entitlement.';
