-- Film Festival OS™
-- Migration 089
-- Provider Refund Control™ foundation
--
-- Full provider refunds only in the first controlled release.
-- This table is operational control state, not a financial ledger.
-- Financial history remains in payment_adjustments and
-- financial_ledger_events.

begin;

-- =========================================================
-- 1. SERVER-CONTROLLED PROVIDER REFUND REQUEST
-- =========================================================

create table if not exists public.provider_refund_requests (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  season_id uuid
    references public.festival_seasons(id) on delete restrict,

  submission_id uuid not null
    references public.submissions(id) on delete restrict,

  submission_payment_id uuid not null
    references public.submission_payments(id) on delete restrict,

  checkout_session_id uuid not null
    references public.payment_checkout_sessions(id) on delete restrict,

  provider text not null,

  environment text not null,

  provider_capture_id text not null,

  provider_refund_id text,

  amount numeric(12,2) not null
    check (amount > 0),

  currency text not null,

  reason text not null,

  status text not null default 'requested'
    check (
      status in (
        'requested',
        'submitted',
        'completed',
        'rejected',
        'error'
      )
    ),

  provider_request_id text not null,

  requested_by uuid not null
    references auth.users(id) on delete restrict,

  requested_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  completed_at timestamptz,

  last_error text,

  metadata jsonb not null default '{}'::jsonb,

  check (provider in ('paypal','stripe','other')),

  check (environment in ('sandbox','live')),

  -- First controlled release supports one full provider-refund
  -- lifecycle per capture. Failed API attempts reuse this row.
  unique(provider, environment, provider_capture_id),

  unique(provider_request_id)
);

create unique index if not exists
  provider_refund_requests_refund_id_idx
on public.provider_refund_requests(
  provider,
  environment,
  provider_refund_id
)
where provider_refund_id is not null;

create index if not exists
  provider_refund_requests_tenant_idx
on public.provider_refund_requests(
  tenant_id,
  requested_at desc
);

create index if not exists
  provider_refund_requests_payment_idx
on public.provider_refund_requests(
  submission_payment_id,
  requested_at desc
);

-- =========================================================
-- 2. PROVIDER PROVENANCE ON IMMUTABLE ADJUSTMENTS
-- =========================================================

alter table public.payment_adjustments
  add column if not exists provider text;

alter table public.payment_adjustments
  add column if not exists environment text;

alter table public.payment_adjustments
  add column if not exists provider_refund_request_id uuid
    references public.provider_refund_requests(id)
    on delete restrict;

create unique index if not exists
  payment_adjustments_provider_refund_request_idx
on public.payment_adjustments(
  provider_refund_request_id
)
where provider_refund_request_id is not null;

create unique index if not exists
  payment_adjustments_provider_refund_reference_idx
on public.payment_adjustments(
  submission_payment_id,
  provider,
  environment,
  provider_reference
)
where adjustment_type = 'refund'
  and provider_reference is not null;

-- =========================================================
-- 3. RLS — READABLE BY FINANCE AUTHORITY, SERVER WRITES ONLY
-- =========================================================

alter table public.provider_refund_requests
  enable row level security;

drop policy if exists provider_refund_manager_read
  on public.provider_refund_requests;

create policy provider_refund_manager_read
on public.provider_refund_requests
for select
to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner']
  )
);

revoke all
on public.provider_refund_requests
from anon;

revoke insert, update, delete
on public.provider_refund_requests
from authenticated;

grant select
on public.provider_refund_requests
to authenticated;

comment on table public.provider_refund_requests is
'Server-controlled provider refund lifecycle. First controlled release supports full refunds only. Verified provider webhook remains authoritative for completion.';

comment on column public.provider_refund_requests.provider_capture_id is
'Original provider capture identifier. Never replaced by the refund identifier.';

comment on column public.provider_refund_requests.provider_refund_id is
'Provider refund transaction identifier returned by the processor and confirmed through verified provider processing.';

comment on column public.provider_refund_requests.provider_request_id is
'Deterministic idempotency identifier sent to the payment provider for the refund API request.';

commit;
