-- Film Festival OS™ v4.0 — Real Workflow Block 3
-- Festival profile + seasons and RLS policies for real workflow screens.

create table if not exists public.festival_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  festival_name text not null,
  country text,
  status text not null default 'draft' check (status in ('draft','published')),
  updated_at timestamptz not null default now()
);

create table if not exists public.festival_seasons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  label text not null,
  status text not null default 'draft' check (status in ('draft','open','closed')),
  opens_at timestamptz,
  notification_at timestamptz,
  event_start_at timestamptz,
  event_end_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists festival_profiles_tenant_idx on public.festival_profiles(tenant_id);
create index if not exists festival_seasons_tenant_idx on public.festival_seasons(tenant_id, status);

alter table public.festival_profiles enable row level security;
alter table public.festival_seasons enable row level security;

drop policy if exists festival_profiles_select on public.festival_profiles;
create policy festival_profiles_select on public.festival_profiles for select to authenticated
using (public.is_platform_admin() or public.has_tenant_role(tenant_id));

drop policy if exists festival_profiles_write on public.festival_profiles;
create policy festival_profiles_write on public.festival_profiles for all to authenticated
using (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['festival_owner','festival_staff']))
with check (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['festival_owner','festival_staff']));

drop policy if exists festival_seasons_select on public.festival_seasons;
create policy festival_seasons_select on public.festival_seasons for select to authenticated
using (public.is_platform_admin() or public.has_tenant_role(tenant_id));

drop policy if exists festival_seasons_write on public.festival_seasons;
create policy festival_seasons_write on public.festival_seasons for all to authenticated
using (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['festival_owner','festival_staff']))
with check (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['festival_owner','festival_staff']));
