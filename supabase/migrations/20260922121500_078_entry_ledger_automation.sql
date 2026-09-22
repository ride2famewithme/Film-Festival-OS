-- Film Festival OS™
-- Migration 078
-- Automatic Entry Ledger™ + Payment Sync

begin;

-- ---------------------------------------------------------
-- 1. Allow a brand-new submission to begin financially
--    unclassified until its fee/payment is assessed.
-- ---------------------------------------------------------

alter table public.submission_entry_ledger
  drop constraint if exists
  submission_entry_ledger_entry_fee_type_check;

alter table public.submission_entry_ledger
  add constraint submission_entry_ledger_entry_fee_type_check
  check (
    entry_fee_type in (
      'pending',
      'paid',
      'waived',
      'complimentary',
      'external',
      'refunded',
      'legacy'
    )
  );


-- ---------------------------------------------------------
-- 2. EVERY NEW SUBMISSION GETS ONE ENTRY LEDGER RECORD
-- ---------------------------------------------------------

create or replace function
public.ensure_submission_entry_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric(8,6);
begin
  select commission_rate
    into v_rate
  from public.platform_payment_policy
  where scope = 'global'
  limit 1;

  v_rate := coalesce(v_rate, 0.11);

  insert into public.submission_entry_ledger (
    tenant_id,
    season_id,
    submission_id,
    entry_fee_type,
    currency,
    ffos_commission_rate,
    fee_calculation_status,
    settlement_status
  )
  values (
    new.tenant_id,
    new.season_id,
    new.id,
    'pending',
    'USD',
    v_rate,
    'pending',
    'unsettled'
  )
  on conflict (submission_id) do nothing;

  return new;
end;
$$;

drop trigger if exists
  submissions_create_entry_ledger
on public.submissions;

create trigger submissions_create_entry_ledger
after insert
on public.submissions
for each row
execute function public.ensure_submission_entry_ledger();


-- ---------------------------------------------------------
-- 3. PAYMENT CHANGES AUTOMATICALLY UPDATE ENTRY LEDGER
-- ---------------------------------------------------------

create or replace function
public.sync_payment_to_entry_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric(8,6);
  v_zero_admin numeric(12,2);
  v_type text;
  v_gross numeric(12,2);
  v_commission numeric(12,2);
  v_admin_fee numeric(12,2);
  v_refund numeric(12,2);
  v_entitlement numeric(12,2);
  v_calc_status text;
  v_season_id uuid;
begin
  select
    commission_rate,
    zero_fee_entry_admin_fee
  into
    v_rate,
    v_zero_admin
  from public.platform_payment_policy
  where scope = 'global'
  limit 1;

  v_rate := coalesce(v_rate, 0.11);

  select season_id
    into v_season_id
  from public.submissions
  where id = new.submission_id
    and tenant_id = new.tenant_id;

  v_season_id := coalesce(new.season_id, v_season_id);

  if new.payment_status = 'refunded' then
    v_type := 'refunded';

  elsif coalesce(new.amount_due,0) <= 0
     or new.payment_status = 'waived' then
    v_type := 'waived';

  else
    v_type := 'paid';
  end if;


  -- Money is only "collected" once marked paid/refunded.
  if new.payment_status in ('paid','refunded') then
    v_gross := greatest(coalesce(new.amount_due,0),0);
    v_commission :=
      round(v_gross * v_rate, 2);
  else
    v_gross := 0;
    v_commission := 0;
  end if;


  if v_type = 'waived' then
    v_admin_fee :=
      coalesce(v_zero_admin,0);

    if v_zero_admin is null then
      v_calc_status := 'pending';
    else
      v_calc_status := 'calculated';
    end if;

  else
    v_admin_fee := 0;

    if new.payment_status in ('paid','refunded') then
      v_calc_status := 'calculated';
    else
      v_calc_status := 'pending';
    end if;
  end if;


  if new.payment_status = 'refunded' then
    v_refund :=
      greatest(coalesce(new.amount_due,0),0);
  else
    v_refund := 0;
  end if;


  -- Default refund rule:
  -- refund remains accountable and FFOS commission is retained.
  -- Later authorised adjustments may reverse commission where required.
  v_entitlement :=
      v_gross
    - v_refund
    - v_commission
    - v_admin_fee;


  insert into public.submission_entry_ledger (
    tenant_id,
    season_id,
    submission_id,
    submission_payment_id,
    entry_fee_type,
    currency,
    listed_entry_fee,
    gross_collected_amount,
    ffos_commission_rate,
    ffos_commission_amount,
    ffos_entry_admin_fee,
    refund_amount,
    festival_entitlement_amount,
    fee_calculation_status,
    settlement_status,
    updated_at
  )
  values (
    new.tenant_id,
    v_season_id,
    new.submission_id,
    new.id,
    v_type,
    coalesce(new.currency,'USD'),
    greatest(coalesce(new.base_amount,0),0),
    v_gross,
    v_rate,
    v_commission,
    v_admin_fee,
    v_refund,
    v_entitlement,
    v_calc_status,
    'unsettled',
    now()
  )
  on conflict (submission_id)
  do update set
    season_id =
      excluded.season_id,

    submission_payment_id =
      excluded.submission_payment_id,

    entry_fee_type =
      excluded.entry_fee_type,

    currency =
      excluded.currency,

    listed_entry_fee =
      excluded.listed_entry_fee,

    gross_collected_amount =
      excluded.gross_collected_amount,

    ffos_commission_rate =
      excluded.ffos_commission_rate,

    ffos_commission_amount =
      excluded.ffos_commission_amount,

    ffos_entry_admin_fee =
      excluded.ffos_entry_admin_fee,

    refund_amount =
      excluded.refund_amount,

    festival_entitlement_amount =
      excluded.festival_entitlement_amount,

    fee_calculation_status =
      excluded.fee_calculation_status,

    updated_at = now();

  return new;
end;
$$;


drop trigger if exists
  submission_payments_sync_entry_ledger
on public.submission_payments;

create trigger submission_payments_sync_entry_ledger
after insert or update of
  season_id,
  category_id,
  base_amount,
  discount_amount,
  amount_due,
  currency,
  benefit_code,
  payment_status
on public.submission_payments
for each row
execute function public.sync_payment_to_entry_ledger();


comment on function
public.ensure_submission_entry_ledger() is
'FFOS™ hard control: every new registered submission automatically receives one Entry Ledger record.';

comment on function
public.sync_payment_to_entry_ledger() is
'FFOS™ payment-accounting control synchronising assessed, paid, waived and refunded submission payments into the Entry Ledger.';

notify pgrst, 'reload schema';

commit;
