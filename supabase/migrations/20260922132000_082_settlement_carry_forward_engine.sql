-- Film Festival OS™
-- Migration 082
-- Minimum Payout / Carry-Forward Engine™

begin;

-- =========================================================
-- 1. SETTLEMENT PAYOUT CALCULATION FIELDS
-- =========================================================

alter table public.festival_settlements
  add column if not exists prior_carry_forward numeric(12,2)
    not null default 0,

  add column if not exists available_for_payout numeric(12,2)
    not null default 0,

  add column if not exists minimum_payout_threshold numeric(12,2)
    not null default 0,

  add column if not exists threshold_currency text
    not null default 'USD',

  add column if not exists payout_eligible boolean
    not null default false,

  add column if not exists payout_amount numeric(12,2)
    not null default 0,

  add column if not exists carry_forward_out numeric(12,2)
    not null default 0,

  add column if not exists payout_hold_reason text,

  add column if not exists threshold_review_required boolean
    not null default false;


-- =========================================================
-- 2. AUTOMATIC THRESHOLD CALCULATION
--
-- Runs when a DRAFT monthly statement becomes RECONCILED.
-- =========================================================

create or replace function
public.apply_festival_settlement_threshold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_threshold numeric(12,2);
  v_threshold_currency text;
  v_carry_enabled boolean;

  v_prior numeric(12,2) := 0;
  v_available numeric(12,2) := 0;
begin

  -- Only calculate when reconciliation occurs.
  if new.status <> 'reconciled'
     or old.status = 'reconciled' then
    return new;
  end if;


  select
    minimum_payout_threshold,
    upper(minimum_payout_currency),
    carry_forward_below_threshold
  into
    v_threshold,
    v_threshold_currency,
    v_carry_enabled
  from public.platform_payment_policy
  where scope = 'global'
  limit 1;


  v_threshold := coalesce(v_threshold,50);
  v_threshold_currency :=
    coalesce(v_threshold_currency,'USD');

  v_carry_enabled :=
    coalesce(v_carry_enabled,true);


  -- Carry forward from the immediately preceding statement
  -- for the same festival and settlement currency.
  select coalesce(fs.carry_forward_out,0)
  into v_prior
  from public.festival_settlements fs
  where fs.tenant_id = new.tenant_id
    and fs.currency = new.currency
    and fs.period_end < new.period_start
    and fs.status <> 'draft'
  order by fs.period_end desc
  limit 1;

  v_prior := coalesce(v_prior,0);

  v_available :=
    v_prior + coalesce(new.net_festival_payout,0);


  new.prior_carry_forward := v_prior;
  new.available_for_payout := v_available;

  new.minimum_payout_threshold := v_threshold;
  new.threshold_currency := v_threshold_currency;

  new.payout_eligible := false;
  new.payout_amount := 0;
  new.carry_forward_out := 0;
  new.payout_hold_reason := null;
  new.threshold_review_required := false;


  -- -------------------------------------------------------
  -- Currency mismatch:
  -- FFOS does NOT invent an FX conversion.
  -- Hold safely for finance review until FX handling exists.
  -- -------------------------------------------------------

  if upper(new.currency) <> v_threshold_currency then

    new.carry_forward_out := v_available;
    new.threshold_review_required := true;

    new.payout_hold_reason :=
      'Minimum payout threshold is configured in '
      || v_threshold_currency
      || '; FX threshold conversion requires review.';

    new.status := 'held';

    return new;
  end if;


  -- -------------------------------------------------------
  -- Threshold / carry-forward enabled
  -- -------------------------------------------------------

  if v_carry_enabled then

    if v_available >= v_threshold
       and v_available > 0 then

      new.payout_eligible := true;
      new.payout_amount := v_available;
      new.carry_forward_out := 0;

      -- Remains RECONCILED until an actual payout
      -- destination/provider schedules the transfer.

    else

      new.payout_eligible := false;
      new.payout_amount := 0;

      -- Positive small balances AND negative balances
      -- carry into the following accounting month.
      new.carry_forward_out := v_available;

      if v_available < 0 then
        new.payout_hold_reason :=
          'Negative festival balance carried forward.';

      elsif v_available = 0 then
        new.payout_hold_reason :=
          'No festival payout balance available.';

      else
        new.payout_hold_reason :=
          'Below minimum payout threshold.';
      end if;

      new.status := 'held';

    end if;


  -- -------------------------------------------------------
  -- Carry-forward policy disabled
  -- -------------------------------------------------------

  else

    if v_available > 0 then

      new.payout_eligible := true;
      new.payout_amount := v_available;
      new.carry_forward_out := 0;

    else

      new.payout_eligible := false;
      new.payout_amount := 0;
      new.carry_forward_out := v_available;
      new.payout_hold_reason :=
        'No positive payout balance available.';
      new.status := 'held';

    end if;

  end if;


  return new;
end;
$$;


drop trigger if exists
  festival_settlement_threshold_on_reconcile
on public.festival_settlements;


create trigger festival_settlement_threshold_on_reconcile
before update of status
on public.festival_settlements
for each row
when (
  new.status = 'reconciled'
  and old.status is distinct from new.status
)
execute function
public.apply_festival_settlement_threshold();


comment on function
public.apply_festival_settlement_threshold() is
'FFOS™ automatically applies the minimum payout threshold and carries smaller or negative festival balances into the next monthly settlement.';


notify pgrst, 'reload schema';

commit;
