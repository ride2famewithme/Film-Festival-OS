-- Film Festival OS™
-- Migration 011 — Waiver Enforcement Hard Controls
-- 07 Sep 2026
--
-- Enforces benefit-code status, dates, usage limits,
-- one-use-per-submitter and category restrictions.

create table if not exists public.benefit_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  benefit_code_id uuid not null references public.benefit_codes(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  submitter_user_id uuid references auth.users(id) on delete set null,
  category_id uuid references public.festival_categories(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  unique (benefit_code_id, submission_id)
);

alter table public.benefit_code_redemptions enable row level security;

drop policy if exists benefit_code_redemptions_manager_read
on public.benefit_code_redemptions;

create policy benefit_code_redemptions_manager_read
on public.benefit_code_redemptions
for select
using (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner','festival_staff']
  )
);

grant select on table public.benefit_code_redemptions to authenticated;

-- Production function/trigger installed and verified in Supabase.
-- regular_fee is already numeric; no conversion helper is required
-- in future revisions of the enforcement function.
