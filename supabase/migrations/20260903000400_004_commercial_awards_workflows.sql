-- Film Festival OS v4.0 — Backend Block 5: categories, benefits, eligibility/payment state, awards
create table if not exists public.festival_categories (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 name text not null, status text not null default 'open', currency text not null default 'USD', regular_fee numeric not null default 0 check(regular_fee>=0),
 runtime_max_minutes integer, completion_year_min integer, rules_version text, updated_at timestamptz not null default now());
create unique index if not exists festival_categories_tenant_name_idx on public.festival_categories(tenant_id,lower(name));

create table if not exists public.benefit_codes (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 code text not null, kind text not null check(kind in ('percent','fixed','waiver')), value numeric not null default 0 check(value>=0), status text not null default 'active',
 usage_limit integer, uses_count integer not null default 0, expires_at timestamptz, category_id uuid references public.festival_categories(id) on delete set null, updated_at timestamptz not null default now());
create unique index if not exists benefit_codes_tenant_code_idx on public.benefit_codes(tenant_id,upper(code));

create table if not exists public.submission_payments (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 submission_id uuid not null references public.submissions(id) on delete cascade, category_id uuid references public.festival_categories(id) on delete set null,
 base_amount numeric not null default 0, discount_amount numeric not null default 0, amount_due numeric not null default 0, currency text not null default 'USD', benefit_code text,
 eligibility_status text not null default 'pending', payment_status text not null default 'pending', provider_reference text, updated_at timestamptz not null default now());
create unique index if not exists submission_payments_submission_idx on public.submission_payments(submission_id);

create table if not exists public.awards (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 submission_id uuid not null references public.submissions(id) on delete cascade, award_name text not null, result_status text not null,
 publication_status text not null default 'draft', decided_at timestamptz, published_at timestamptz, updated_at timestamptz not null default now());

alter table public.festival_categories enable row level security;
alter table public.benefit_codes enable row level security;
alter table public.submission_payments enable row level security;
alter table public.awards enable row level security;

create policy festival_categories_member_read on public.festival_categories for select using (public.is_tenant_member(tenant_id));
create policy festival_categories_manager_all on public.festival_categories for all using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner','festival_staff'])) with check (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner','festival_staff']));
create policy benefit_codes_manager_all on public.benefit_codes for all using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner','festival_staff'])) with check (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner','festival_staff']));
create policy submission_payments_manager_all on public.submission_payments for all using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner','festival_staff'])) with check (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner','festival_staff']));
create policy submission_payments_creator_read on public.submission_payments for select using (exists(select 1 from public.submissions s where s.id=submission_id and s.owner_id=auth.uid() and s.tenant_id=tenant_id));
create policy awards_member_read on public.awards for select using (public.is_tenant_member(tenant_id));
create policy awards_manager_all on public.awards for all using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner'])) with check (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner']));
