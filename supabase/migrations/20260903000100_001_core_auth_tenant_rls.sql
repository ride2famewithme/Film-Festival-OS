-- Film Festival OS™ v4.0 — Core Auth, Multi-Tenant Data and Row Level Security
-- Apply through controlled Supabase migration tooling. Review in a non-production project first.

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('hq','territory','operator','festival')),
  territory text,
  status text not null default 'active',
  parent_tenant_id uuid references public.tenants(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null check (role in ('platform_admin','festival_owner','festival_staff','juror','creator','sponsor_partner')),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique(user_id, tenant_id, role)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_id uuid not null references auth.users(id), name text not null, status text not null, priority text, due_date timestamptz
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, owner_id uuid not null references auth.users(id),
  title text not null, status text not null, priority text, due_date timestamptz
);
create table if not exists public.risks (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  category text not null, description text not null, rating text not null, owner_id uuid references auth.users(id), status text not null
);
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  severity text not null, summary text not null, status text not null, owner_id uuid references auth.users(id), occurred_at timestamptz not null
);
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null, service_type text not null, criticality text not null, status text not null
);
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id), action text not null, entity_type text not null,
  entity_id uuid, detail jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create index if not exists memberships_user_idx on public.memberships(user_id, status);
create index if not exists memberships_tenant_idx on public.memberships(tenant_id, status);
create index if not exists projects_tenant_idx on public.projects(tenant_id);
create index if not exists tasks_tenant_idx on public.tasks(tenant_id);
create index if not exists risks_tenant_idx on public.risks(tenant_id);
create index if not exists incidents_tenant_idx on public.incidents(tenant_id);
create index if not exists suppliers_tenant_idx on public.suppliers(tenant_id);
create index if not exists audit_events_tenant_idx on public.audit_events(tenant_id, created_at desc);

create or replace function public.has_tenant_role(target_tenant uuid, allowed_roles text[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.tenant_id = target_tenant and m.status = 'active'
      and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'active' and m.role = 'platform_admin'
  );
$$;

revoke all on function public.has_tenant_role(uuid,text[]) from public;
revoke all on function public.is_platform_admin() from public;
grant execute on function public.has_tenant_role(uuid,text[]) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.risks enable row level security;
alter table public.incidents enable row level security;
alter table public.suppliers enable row level security;
alter table public.audit_events enable row level security;

-- Tenants: own memberships can see their tenant; platform admins may administer the hierarchy.
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants for select to authenticated using (public.has_tenant_role(id) or public.is_platform_admin());
drop policy if exists tenants_admin_write on public.tenants;
create policy tenants_admin_write on public.tenants for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Memberships: people can read their own active memberships; admins/owners can manage membership inside authorised tenants.
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships for select to authenticated using (user_id = auth.uid() or public.is_platform_admin() or public.has_tenant_role(tenant_id, array['festival_owner']));
drop policy if exists memberships_manage on public.memberships;
create policy memberships_manage on public.memberships for all to authenticated using (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['festival_owner'])) with check (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['festival_owner']));

-- Projects/tasks: tenant operators can manage; creators may manage only rows they own.
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated using (public.is_platform_admin() or public.has_tenant_role(tenant_id) or owner_id = auth.uid());
drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects for all to authenticated using (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['festival_owner','festival_staff']) or owner_id = auth.uid()) with check (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['festival_owner','festival_staff']) or owner_id = auth.uid());

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated using (public.is_platform_admin() or public.has_tenant_role(tenant_id) or owner_id = auth.uid());
drop policy if exists tasks_write on public.tasks;
create policy tasks_write on public.tasks for all to authenticated using (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['festival_owner','festival_staff']) or owner_id = auth.uid()) with check (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['festival_owner','festival_staff']) or owner_id = auth.uid());

-- Risk/incident/supplier registers: no juror/creator/sponsor write access by default.
DO $$ declare t text; begin
  foreach t in array array['risks','incidents','suppliers'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (public.is_platform_admin() or public.has_tenant_role(tenant_id, array[''festival_owner'',''festival_staff'']))', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_write on public.%I for all to authenticated using (public.is_platform_admin() or public.has_tenant_role(tenant_id, array[''festival_owner''])) with check (public.is_platform_admin() or public.has_tenant_role(tenant_id, array[''festival_owner'']))', t, t);
  end loop;
end $$;

-- Audit: authenticated actors may append an event only as themselves inside a tenant they belong to; only admins/owners read.
drop policy if exists audit_select on public.audit_events;
create policy audit_select on public.audit_events for select to authenticated using (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['festival_owner']));
drop policy if exists audit_insert on public.audit_events;
create policy audit_insert on public.audit_events for insert to authenticated with check (actor_user_id = auth.uid() and (public.is_platform_admin() or public.has_tenant_role(tenant_id)));

-- No anonymous table access is granted by this migration.
