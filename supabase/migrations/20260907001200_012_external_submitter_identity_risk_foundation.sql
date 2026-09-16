-- Film Festival OS™
-- Migration 012 — External Submitter Identity & Risk Foundation
-- Reconstructed from verified live database
-- 08 Sep 2026

create table if not exists public.submitter_identities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  identity_type text not null default 'individual'
    check (identity_type in (
      'individual',
      'representative',
      'agency',
      'distributor'
    )),

  display_name text not null,
  organisation_name text,
  email text,
  email_verified_at timestamptz,
  phone_e164 text,
  phone_verified_at timestamptz,

  auth_user_id uuid references auth.users(id) on delete set null,

  verification_status text not null default 'unverified'
    check (verification_status in (
      'unverified',
      'partially_verified',
      'verified',
      'review_required',
      'blocked'
    )),

  status text not null default 'active'
    check (status in (
      'active',
      'inactive',
      'blocked'
    )),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.submission_parties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  submission_id uuid not null
    references public.submissions(id) on delete cascade,

  identity_id uuid not null
    references public.submitter_identities(id) on delete cascade,

  party_role text not null
    check (party_role in (
      'submitter',
      'filmmaker',
      'rights_holder',
      'representative'
    )),

  created_at timestamptz not null default now(),

  unique (submission_id, identity_id, party_role)
);


create table if not exists public.restricted_parties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  display_name text not null,
  email text,
  phone_e164 text,
  organisation_name text,

  relationship_type text not null
    check (relationship_type in (
      'staff',
      'festival_owner',
      'franchise_owner',
      'juror',
      'immediate_family',
      'relative',
      'controlled_entity',
      'affiliated_entity',
      'other_conflict'
    )),

  reason text,

  status text not null default 'active'
    check (status in (
      'active',
      'inactive'
    )),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.identity_verification_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  identity_id uuid not null
    references public.submitter_identities(id) on delete cascade,

  method text not null
    check (method in (
      'email',
      'sms',
      'qr_mobile',
      'manual_admin'
    )),

  result text not null
    check (result in (
      'requested',
      'verified',
      'failed',
      'expired'
    )),

  provider_reference text,

  created_at timestamptz not null default now()
);


create table if not exists public.submission_risk_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  submission_id uuid
    references public.submissions(id) on delete cascade,

  signal_type text not null
    check (signal_type in (
      'shared_ip',
      'shared_device',
      'waiver_pattern',
      'identity_mismatch',
      'restricted_party_match',
      'unusual_volume',
      'manual_review'
    )),

  severity text not null default 'low'
    check (severity in (
      'low',
      'medium',
      'high',
      'critical'
    )),

  source text not null default 'server'
    check (source in (
      'server',
      'system',
      'manual'
    )),

  note text,
  resolved boolean not null default false,

  created_at timestamptz not null default now()
);


alter table public.submissions
  add column if not exists submitter_identity_id uuid
  references public.submitter_identities(id)
  on delete set null;


alter table public.submitter_identities enable row level security;
alter table public.submission_parties enable row level security;
alter table public.restricted_parties enable row level security;
alter table public.identity_verification_events enable row level security;
alter table public.submission_risk_events enable row level security;


drop policy if exists submitter_identities_manager_all
on public.submitter_identities;

create policy submitter_identities_manager_all
on public.submitter_identities
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


drop policy if exists submission_parties_manager_all
on public.submission_parties;

create policy submission_parties_manager_all
on public.submission_parties
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


drop policy if exists restricted_parties_manager_all
on public.restricted_parties;

create policy restricted_parties_manager_all
on public.restricted_parties
for all
using (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner']
  )
)
with check (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner']
  )
);


drop policy if exists identity_verification_events_manager_read
on public.identity_verification_events;

create policy identity_verification_events_manager_read
on public.identity_verification_events
for select
using (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner','festival_staff']
  )
);


drop policy if exists submission_risk_events_manager_read
on public.submission_risk_events;

create policy submission_risk_events_manager_read
on public.submission_risk_events
for select
using (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner','festival_staff']
  )
);


grant select, insert, update
on public.submitter_identities
to authenticated;

grant select, insert, update
on public.submission_parties
to authenticated;

grant select, insert, update
on public.restricted_parties
to authenticated;

grant select
on public.identity_verification_events
to authenticated;

grant select
on public.submission_risk_events
to authenticated;

