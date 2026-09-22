-- Film Festival OS™
-- Migration 079
-- Financial Transaction Journal™
--
-- Immutable dated money-movement history used for monthly settlement.
-- Entry Ledger = current position.
-- Financial Journal = what happened, when it happened.

begin;

create table if not exists public.financial_ledger_events (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  season_id uuid
    references public.festival_seasons(id) on delete restrict,

  submission_id uuid
    references public.submissions(id) on delete restrict,

  submission_payment_id uuid
    references public.submission_payments(id) on delete restrict,

  entry_ledger_id uuid
    references public.submission_entry_ledger(id) on delete restrict,

  adjustment_id uuid
    references public.payment_adjustments(id) on delete restrict,

  event_type text not null
    check (
      event_type in (
        'payment_collected',
        'refund',
        'waiver_admin_fee',
        'chargeback',
        'processor_fee',
        'commission_reversal',
        'manual_credit',
        'manual_debit'
      )
    ),

  currency text not null default 'USD',

  -- Positive accounting movements.
  gross_delta numeric(12,2) not null default 0,
  refund_delta numeric(12,2) not null default 0,
  chargeback_delta numeric(12,2) not null default 0,
  processor_fee_delta numeric(12,2) not null default 0,

  ffos_commission_delta numeric(12,2) not null default 0,
  ffos_admin_fee_delta numeric(12,2) not null default 0,

  -- Signed amount affecting what the festival is owed.
  festival_entitlement_delta numeric(12,2) not null default 0,

  provider text,
  provider_reference text,

  -- Prevents the same processor/status event being recorded twice.
  idempotency_key text unique,

  occurred_at timestamptz not null default now(),

  created_by uuid
    references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb
);


create index if not exists financial_events_tenant_date_idx
  on public.financial_ledger_events(
    tenant_id,
    occurred_at,
    currency
  );

create index if not exists financial_events_submission_idx
  on public.financial_ledger_events(
    submission_id,
    occurred_at
  );


-- =========================================================
-- AUTOMATIC PAYMENT / REFUND EVENT RECORDING
-- =========================================================

create or replace function
public.record_submission_payment_financial_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger public.submission_entry_ledger%rowtype;
  v_admin_fee numeric(12,2);
  v_gross numeric(12,2);
  v_commission numeric(12,2);
begin

  -- Only act when payment status actually becomes a
  -- financially meaningful state.
  if new.payment_status not in ('paid','refunded','waived') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.payment_status is not distinct from new.payment_status then
    return new;
  end if;


  select *
    into v_ledger
  from public.submission_entry_ledger
  where submission_id = new.submission_id
    and tenant_id = new.tenant_id
  limit 1;

  if not found then
    raise exception
      'FFOS Entry Ledger record missing for submission %. Settlement event cannot be recorded.',
      new.submission_id;
  end if;


  -- -------------------------------------------------------
  -- PAID
  -- -------------------------------------------------------

  if new.payment_status = 'paid' then

    v_gross :=
      greatest(coalesce(new.amount_due,0),0);

    v_commission :=
      round(
        v_gross *
        coalesce(v_ledger.ffos_commission_rate,0.11),
        2
      );

    insert into public.financial_ledger_events (
      tenant_id,
      season_id,
      submission_id,
      submission_payment_id,
      entry_ledger_id,
      event_type,
      currency,
      gross_delta,
      ffos_commission_delta,
      festival_entitlement_delta,
      idempotency_key,
      occurred_at,
      metadata
    )
    values (
      new.tenant_id,
      coalesce(new.season_id,v_ledger.season_id),
      new.submission_id,
      new.id,
      v_ledger.id,
      'payment_collected',
      coalesce(new.currency,'USD'),
      v_gross,
      v_commission,
      v_gross - v_commission,
      'payment:' || new.id::text || ':paid',
      now(),
      jsonb_build_object(
        'payment_status',new.payment_status,
        'commission_rate',
          coalesce(v_ledger.ffos_commission_rate,0.11)
      )
    )
    on conflict (idempotency_key) do nothing;

  end if;


  -- -------------------------------------------------------
  -- REFUNDED
  --
  -- Default commercial rule:
  -- full filmmaker refund;
  -- previously earned FFOS commission remains retained.
  -- A later authorised commission_reversal event may change it.
  -- -------------------------------------------------------

  if new.payment_status = 'refunded' then

    v_gross :=
      greatest(coalesce(new.amount_due,0),0);

    insert into public.financial_ledger_events (
      tenant_id,
      season_id,
      submission_id,
      submission_payment_id,
      entry_ledger_id,
      event_type,
      currency,
      refund_delta,
      festival_entitlement_delta,
      idempotency_key,
      occurred_at,
      metadata
    )
    values (
      new.tenant_id,
      coalesce(new.season_id,v_ledger.season_id),
      new.submission_id,
      new.id,
      v_ledger.id,
      'refund',
      coalesce(new.currency,'USD'),
      v_gross,
      -v_gross,
      'payment:' || new.id::text || ':refunded',
      now(),
      jsonb_build_object(
        'commission_retained',true
      )
    )
    on conflict (idempotency_key) do nothing;

  end if;


  -- -------------------------------------------------------
  -- WAIVED / ZERO FEE
  --
  -- Only journal the FFOS entry-admin charge after
  -- Global Master has actually configured that amount.
  -- -------------------------------------------------------

  if new.payment_status = 'waived' then

    select zero_fee_entry_admin_fee
      into v_admin_fee
    from public.platform_payment_policy
    where scope = 'global'
    limit 1;

    if v_admin_fee is not null then

      insert into public.financial_ledger_events (
        tenant_id,
        season_id,
        submission_id,
        submission_payment_id,
        entry_ledger_id,
        event_type,
        currency,
        ffos_admin_fee_delta,
        festival_entitlement_delta,
        idempotency_key,
        occurred_at,
        metadata
      )
      values (
        new.tenant_id,
        coalesce(new.season_id,v_ledger.season_id),
        new.submission_id,
        new.id,
        v_ledger.id,
        'waiver_admin_fee',
        coalesce(new.currency,'USD'),
        v_admin_fee,
        -v_admin_fee,
        'payment:' || new.id::text || ':waived',
        now(),
        jsonb_build_object(
          'zero_fee_entry_admin_fee',v_admin_fee
        )
      )
      on conflict (idempotency_key) do nothing;

    end if;

  end if;


  return new;
end;
$$;


-- Alphabetically after the existing Entry Ledger sync trigger,
-- so the journal reads the freshly synchronised ledger values.

drop trigger if exists
  zz_submission_payments_financial_event
on public.submission_payments;

create trigger zz_submission_payments_financial_event
after insert or update of payment_status
on public.submission_payments
for each row
execute function public.record_submission_payment_financial_event();


-- =========================================================
-- IMMUTABILITY / ACCESS
-- =========================================================

alter table public.financial_ledger_events
  enable row level security;

create policy financial_events_read
on public.financial_ledger_events
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
  or public.is_platform_admin()
);

create policy financial_events_manager_insert
on public.financial_ledger_events
for insert
to authenticated
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

grant select, insert
on public.financial_ledger_events
to authenticated;

revoke update, delete
on public.financial_ledger_events
from authenticated;


comment on table public.financial_ledger_events is
'Film Festival OS™ immutable Financial Transaction Journal. Monthly festival settlements are calculated from dated financial events rather than mutable payment snapshots.';

notify pgrst, 'reload schema';

commit;
