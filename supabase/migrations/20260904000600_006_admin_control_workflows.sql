-- Film Festival OS™ v4.0 FINAL — Backend Block 7
-- Staff access, moderation/appeals, finance/refunds, support, configuration and health evidence.

create table if not exists public.moderation_cases (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, title text not null, case_type text not null default 'report', status text not null default 'open', priority text not null default 'normal', decision_reason text, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.refund_requests (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, reference text not null, amount numeric(12,2) not null default 0, currency text not null default 'USD', reason text not null, status text not null default 'requested', requested_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.support_cases (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, subject text not null, category text not null default 'general', priority text not null default 'normal', status text not null default 'open', opened_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.platform_settings (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, setting_key text not null, setting_value text not null, status text not null default 'draft', updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now(), unique(tenant_id, setting_key));
create table if not exists public.service_health_checks (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, service_name text not null, status text not null default 'unknown', detail text, checked_by uuid not null references auth.users(id), checked_at timestamptz not null default now());

create index if not exists moderation_cases_tenant_status_idx on public.moderation_cases(tenant_id,status);
create index if not exists refund_requests_tenant_status_idx on public.refund_requests(tenant_id,status);
create index if not exists support_cases_tenant_status_idx on public.support_cases(tenant_id,status);
create index if not exists service_health_tenant_checked_idx on public.service_health_checks(tenant_id,checked_at desc);

alter table public.moderation_cases enable row level security; alter table public.refund_requests enable row level security; alter table public.support_cases enable row level security; alter table public.platform_settings enable row level security; alter table public.service_health_checks enable row level security;

create policy moderation_read on public.moderation_cases for select using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner']));
create policy moderation_manage on public.moderation_cases for all using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner'])) with check (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner']));
create policy refunds_read on public.refund_requests for select using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner']));
create policy refunds_manage on public.refund_requests for all using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner'])) with check (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner']));
create policy support_read on public.support_cases for select using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner','festival_staff']));
create policy support_manage on public.support_cases for all using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner','festival_staff'])) with check (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner','festival_staff']));
create policy settings_admin on public.platform_settings for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy health_admin on public.service_health_checks for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Membership writes are deliberately limited to existing tenant owners/platform admins.
create policy memberships_owner_insert on public.memberships for insert with check (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner']));
create policy memberships_owner_update on public.memberships for update using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner'])) with check (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner']));
