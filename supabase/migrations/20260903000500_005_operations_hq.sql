-- Film Festival OS™ v4.0 FINAL — Backend Block 6
-- Communications templates, controlled export queue and operational/HQ support.

create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  template_key text not null,
  subject text not null,
  body text not null,
  status text not null default 'active',
  updated_at timestamptz not null default now(),
  unique (tenant_id, template_key)
);

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  report_type text not null,
  format text not null,
  status text not null default 'queued',
  requested_at timestamptz not null default now(),
  generated_at timestamptz,
  expires_at timestamptz,
  file_path text
);

create index if not exists communication_templates_tenant_idx on public.communication_templates(tenant_id);
create index if not exists export_jobs_tenant_requested_idx on public.export_jobs(tenant_id, requested_at desc);

alter table public.communication_templates enable row level security;
alter table public.export_jobs enable row level security;

create policy communication_templates_tenant_read on public.communication_templates
for select using (public.has_tenant_role(tenant_id, array['platform_admin','festival_owner','festival_staff']));
create policy communication_templates_tenant_manage on public.communication_templates
for all using (public.has_tenant_role(tenant_id, array['platform_admin','festival_owner','festival_staff']))
with check (public.has_tenant_role(tenant_id, array['platform_admin','festival_owner','festival_staff']));

create policy export_jobs_tenant_read on public.export_jobs
for select using (public.has_tenant_role(tenant_id, array['platform_admin','festival_owner','festival_staff']));
create policy export_jobs_tenant_insert on public.export_jobs
for insert with check (
  requested_by = auth.uid()
  and public.has_tenant_role(tenant_id, array['platform_admin','festival_owner','festival_staff'])
);
create policy export_jobs_tenant_update on public.export_jobs
for update using (public.has_tenant_role(tenant_id, array['platform_admin','festival_owner']))
with check (public.has_tenant_role(tenant_id, array['platform_admin','festival_owner']));
