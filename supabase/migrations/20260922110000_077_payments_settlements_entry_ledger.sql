-- Film Festival OS™
-- Migration 077
-- Payments, Settlements & Entry Ledger™ Foundation

begin;

-- =========================================================
-- 1. GLOBAL FFOS COMMERCIAL POLICY
-- =========================================================

create table if not exists public.platform_payment_policy (
  scope text primary key default 'global'
    check (scope = 'global'),

  commission_rate numeric(8,6) not null default 0.11
    check (commission_rate >= 0 and commission_rate <= 1),

  -- Amount to be decided by Global Master later.
  -- Used when an entry is free / complimentary / 100% waived.
  zero_fee_entry_admin_fee numeric(12,2)
    check (
      zero_fee_entry_admin_fee is null
      or zero_fee_entry_admin_fee >= 0
    ),

  settlement_day integer not null default 10
    check (settlement_day between 1 and 28),

  policy_version text not null default '2026.1',
  status text not null default 'active'
    check (status in ('active','paused','retired')),

  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_payment_policy (
  scope,
  commission_rate,
  zero_fee_entry_admin_fee,
  settlement_day,
  policy_version,
  status
)
values (
  'global',
  0.11,
  null,
  10,
  '2026.1',
  'active'
)
on conflict (scope) do nothing;


-- =========================================================
-- 2. MONTHLY FESTIVAL SETTLEMENTS
-- =========================================================

create table if not exists public.festival_settlements (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  season_id uuid
    references public.festival_seasons(id) on delete restrict,

  period_start date not null,
  period_end date not null,
  payout_due_date date not null,

  currency text not null default 'USD',

  gross_collected numeric(12,2) not null default 0,
  refunds_amount numeric(12,2) not null default 0,
  chargebacks_amount numeric(12,2) not null default 0,
  processor_fees_amount numeric(12,2) not null default 0,

  ffos_commission_amount numeric(12,2) not null default 0,
  ffos_entry_admin_fees numeric(12,2) not null default 0,

  net_festival_payout numeric(12,2) not null default 0,

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'reconciled',
        'scheduled',
        'paid',
        'held',
        'cancelled'
      )
    ),

  payout_provider_reference text,

  created_by uuid
    references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,

  check (period_end >= period_start),

  unique (
    tenant_id,
    period_start,
    period_end,
    currency
  )
);


-- =========================================================
-- 3. ENTRY LEDGER
--
-- ONE financially accountable ledger record per submission.
-- =========================================================

create table if not exists public.submission_entry_ledger (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  season_id uuid
    references public.festival_seasons(id) on delete restrict,

  submission_id uuid not null unique
    references public.submissions(id) on delete restrict,

  submission_payment_id uuid
    references public.submission_payments(id) on delete set null,

  settlement_id uuid
    references public.festival_settlements(id) on delete set null,

  entry_fee_type text not null default 'paid'
    check (
      entry_fee_type in (
        'paid',
        'waived',
        'complimentary',
        'external',
        'refunded',
        'legacy'
      )
    ),

  currency text not null default 'USD',

  listed_entry_fee numeric(12,2) not null default 0,
  gross_collected_amount numeric(12,2) not null default 0,

  ffos_commission_rate numeric(8,6)
    check (
      ffos_commission_rate is null
      or (
        ffos_commission_rate >= 0
        and ffos_commission_rate <= 1
      )
    ),

  ffos_commission_amount numeric(12,2) not null default 0,

  -- Jurisdictional tax portion of FFOS commission.
  -- Australian GST calculation will be added in workflow.
  ffos_commission_tax_amount numeric(12,2) not null default 0,

  ffos_entry_admin_fee numeric(12,2) not null default 0,

  processor_fee_amount numeric(12,2) not null default 0,

  refund_amount numeric(12,2) not null default 0,
  chargeback_amount numeric(12,2) not null default 0,

  festival_entitlement_amount numeric(12,2) not null default 0,

  fee_calculation_status text not null default 'pending'
    check (
      fee_calculation_status in (
        'pending',
        'calculated',
        'legacy_unpriced',
        'adjusted',
        'final'
      )
    ),

  settlement_status text not null default 'unsettled'
    check (
      settlement_status in (
        'unsettled',
        'scheduled',
        'settled',
        'held',
        'adjusted'
      )
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =========================================================
-- 4. REFUNDS / WAIVERS / CHARGEBACK / ADJUSTMENT HISTORY
-- =========================================================

create table if not exists public.payment_adjustments (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  season_id uuid
    references public.festival_seasons(id) on delete restrict,

  submission_id uuid not null
    references public.submissions(id) on delete restrict,

  submission_payment_id uuid
    references public.submission_payments(id) on delete set null,

  entry_ledger_id uuid
    references public.submission_entry_ledger(id) on delete restrict,

  settlement_id uuid
    references public.festival_settlements(id) on delete set null,

  adjustment_type text not null
    check (
      adjustment_type in (
        'refund',
        'waiver_after_payment',
        'chargeback',
        'commission_reversal',
        'admin_fee',
        'manual_credit',
        'manual_debit'
      )
    ),

  amount numeric(12,2) not null
    check (amount >= 0),

  currency text not null default 'USD',

  ffos_commission_retained boolean not null default false,

  reason text not null,
  provider_reference text,

  created_by uuid
    references auth.users(id) on delete set null,

  created_at timestamptz not null default now()
);


-- =========================================================
-- 5. PRESERVE EXISTING HISTORY WITHOUT INVENTING FEES
-- =========================================================

insert into public.submission_entry_ledger (
  tenant_id,
  season_id,
  submission_id,
  submission_payment_id,
  entry_fee_type,
  currency,
  ffos_commission_rate,
  fee_calculation_status,
  settlement_status
)
select
  s.tenant_id,
  s.season_id,
  s.id,
  sp.id,
  'legacy',
  coalesce(sp.currency, 'USD'),
  null,
  'legacy_unpriced',
  'unsettled'
from public.submissions s
left join public.submission_payments sp
  on sp.submission_id = s.id
 and sp.tenant_id = s.tenant_id
on conflict (submission_id) do nothing;


-- =========================================================
-- 6. INDEXES
-- =========================================================

create index if not exists entry_ledger_tenant_season_idx
  on public.submission_entry_ledger(
    tenant_id,
    season_id,
    created_at desc
  );

create index if not exists entry_ledger_settlement_idx
  on public.submission_entry_ledger(
    settlement_id,
    settlement_status
  );

create index if not exists payment_adjustments_submission_idx
  on public.payment_adjustments(
    tenant_id,
    submission_id,
    created_at desc
  );

create index if not exists festival_settlements_period_idx
  on public.festival_settlements(
    tenant_id,
    period_start,
    period_end
  );


-- =========================================================
-- 7. RLS
-- =========================================================

alter table public.platform_payment_policy
  enable row level security;

alter table public.festival_settlements
  enable row level security;

alter table public.submission_entry_ledger
  enable row level security;

alter table public.payment_adjustments
  enable row level security;


create policy platform_payment_policy_read
on public.platform_payment_policy
for select
to authenticated
using (true);

create policy platform_payment_policy_admin
on public.platform_payment_policy
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());


create policy festival_settlements_read
on public.festival_settlements
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy festival_settlements_platform_admin
on public.festival_settlements
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());


create policy entry_ledger_manager
on public.submission_entry_ledger
for all
to authenticated
using (
  public.has_tenant_role(
    tenant_id,
    array[
      'platform_admin',
      'festival_owner',
      'festival_staff'
    ]
  )
)
with check (
  public.has_tenant_role(
    tenant_id,
    array[
      'platform_admin',
      'festival_owner',
      'festival_staff'
    ]
  )
);


create policy payment_adjustments_manager
on public.payment_adjustments
for all
to authenticated
using (
  public.has_tenant_role(
    tenant_id,
    array[
      'platform_admin',
      'festival_owner',
      'festival_staff'
    ]
  )
)
with check (
  public.has_tenant_role(
    tenant_id,
    array[
      'platform_admin',
      'festival_owner',
      'festival_staff'
    ]
  )
);


grant select
on public.platform_payment_policy
to authenticated;

grant select, insert, update, delete
on public.festival_settlements,
   public.submission_entry_ledger,
   public.payment_adjustments
to authenticated;


comment on table public.submission_entry_ledger is
'Film Festival OS™ Entry Ledger — one financially accountable record for every registered festival submission, including paid, free, waived and complimentary entries.';

comment on table public.festival_settlements is
'Film Festival OS™ monthly festival settlement record. Standard payout target is the 10th day of the following month.';

comment on table public.payment_adjustments is
'Immutable commercial adjustment history for refunds, retrospective waivers, chargebacks and other financial adjustments.';

notify pgrst, 'reload schema';

commit;
