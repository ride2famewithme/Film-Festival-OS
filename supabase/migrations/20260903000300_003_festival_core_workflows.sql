-- Film Festival OS v4.0 — Backend Block 4: festival core workflows
create table if not exists public.submissions (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 owner_id uuid not null references auth.users(id), title text not null, filmmaker_name text not null, email text, country text, category text,
 status text not null default 'received', submitted_at timestamptz not null default now());
create table if not exists public.jury_assignments (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 submission_id uuid not null references public.submissions(id) on delete cascade, juror_user_id uuid not null references auth.users(id),
 status text not null default 'assigned', assigned_at timestamptz not null default now());
create table if not exists public.jury_reviews (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 assignment_id uuid not null references public.jury_assignments(id) on delete cascade, submission_id uuid not null references public.submissions(id) on delete cascade,
 juror_user_id uuid not null references auth.users(id), score numeric check(score between 0 and 100), recommendation text, notes text,
 status text not null default 'draft', submitted_at timestamptz);
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 submission_id uuid references public.submissions(id) on delete set null, recipient_email text not null, template_key text not null,
 subject text not null, body text not null, status text not null default 'queued', queued_at timestamptz not null default now(), sent_at timestamptz);

alter table public.submissions enable row level security;
alter table public.jury_assignments enable row level security;
alter table public.jury_reviews enable row level security;
alter table public.notifications enable row level security;

-- Reuse membership helper functions created by migration 001.
create policy submissions_member_read on public.submissions for select using (public.is_tenant_member(tenant_id));
create policy submissions_creator_insert on public.submissions for insert with check (owner_id=auth.uid() and public.is_tenant_member(tenant_id));
create policy submissions_manager_update on public.submissions for update using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner','festival_staff']));
create policy jury_assignments_manager_all on public.jury_assignments for all using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner'])) with check (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner']));
create policy jury_assignments_juror_read on public.jury_assignments for select using (juror_user_id=auth.uid() and public.is_tenant_member(tenant_id));
create policy jury_assignments_juror_update on public.jury_assignments for update using (juror_user_id=auth.uid() and public.is_tenant_member(tenant_id));
create policy jury_reviews_juror_all on public.jury_reviews for all using (juror_user_id=auth.uid() and public.is_tenant_member(tenant_id)) with check (juror_user_id=auth.uid() and public.is_tenant_member(tenant_id));
create policy jury_reviews_manager_read on public.jury_reviews for select using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner']));
create policy notifications_manager_all on public.notifications for all using (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner','festival_staff'])) with check (public.has_tenant_role(tenant_id,array['platform_admin','festival_owner','festival_staff']));
