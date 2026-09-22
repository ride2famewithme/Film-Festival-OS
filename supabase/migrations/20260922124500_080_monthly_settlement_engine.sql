-- Film Festival OS™
-- Migration 080
-- Monthly Settlement Engine™

begin;

-- =========================================================
-- 1. EXACT FINANCIAL EVENTS INCLUDED IN EACH SETTLEMENT
--
-- Important:
-- A submission may be paid in September and refunded in
-- October. Therefore settlements attach to EVENTS, not merely
-- to one submission record.
-- =========================================================

create table if not exists public.festival_settlement_events (
  settlement_id uuid not null
    references public.festival_settlements(id) on delete cascade,

  event_id uuid not null
    references public.financial_ledger_events(id) on delete restrict,

  included_at timestamptz not null default now(),

  primary key (settlement_id, event_id),

  unique (event_id)
);

create index if not exists
festival_settlement_events_settlement_idx
on public.festival_settlement_events(settlement_id);


-- =========================================================
-- 2. PREPARE / REFRESH MONTHLY SETTLEMENT
-- =========================================================

create or replace function
public.prepare_monthly_festival_settlement(
  p_tenant_id uuid,
  p_period_start date,
  p_currency text default 'USD'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date;
  v_end date;
  v_next_month date;
  v_due date;

  v_currency text;
  v_day integer;

  v_settlement_id uuid;
  v_status text;

  v_event_count integer := 0;

  v_gross numeric(12,2) := 0;
  v_refunds numeric(12,2) := 0;
  v_chargebacks numeric(12,2) := 0;
  v_processor numeric(12,2) := 0;
  v_commission numeric(12,2) := 0;
  v_admin numeric(12,2) := 0;
  v_net numeric(12,2) := 0;
begin

  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_role(
      p_tenant_id,
      array[
        'platform_admin',
        'festival_owner',
        'festival_staff'
      ]
    )
  ) then
    raise exception
      'Authorised festival finance access required.';
  end if;


  v_start :=
    date_trunc('month',p_period_start)::date;

  v_next_month :=
    (v_start + interval '1 month')::date;

  v_end :=
    v_next_month - 1;

  v_currency :=
    upper(trim(coalesce(p_currency,'USD')));


  select settlement_day
    into v_day
  from public.platform_payment_policy
  where scope = 'global'
  limit 1;

  v_day := coalesce(v_day,10);

  v_due :=
    make_date(
      extract(year from v_next_month)::integer,
      extract(month from v_next_month)::integer,
      v_day
    );


  select id,status
    into v_settlement_id,v_status
  from public.festival_settlements
  where tenant_id = p_tenant_id
    and period_start = v_start
    and period_end = v_end
    and currency = v_currency
  limit 1;


  if v_settlement_id is null then

    insert into public.festival_settlements (
      tenant_id,
      period_start,
      period_end,
      payout_due_date,
      currency,
      status,
      created_by,
      created_at,
      updated_at
    )
    values (
      p_tenant_id,
      v_start,
      v_end,
      v_due,
      v_currency,
      'draft',
      auth.uid(),
      now(),
      now()
    )
    returning id
      into v_settlement_id;

    v_status := 'draft';

  elsif v_status <> 'draft' then

    raise exception
      'Settlement is already %. Reconciled or paid settlements cannot be rebuilt.',
      v_status;

  else

    update public.festival_settlements
    set
      payout_due_date = v_due,
      updated_at = now()
    where id = v_settlement_id;

  end if;


  -- A DRAFT may be refreshed repeatedly before reconciliation.

  delete from public.festival_settlement_events
  where settlement_id = v_settlement_id;


  insert into public.festival_settlement_events (
    settlement_id,
    event_id
  )
  select
    v_settlement_id,
    e.id
  from public.financial_ledger_events e
  where e.tenant_id = p_tenant_id
    and e.currency = v_currency
    and e.occurred_at >= v_start::timestamptz
    and e.occurred_at < v_next_month::timestamptz
  on conflict (event_id) do nothing;


  select
    count(*),

    coalesce(sum(e.gross_delta),0),
    coalesce(sum(e.refund_delta),0),
    coalesce(sum(e.chargeback_delta),0),
    coalesce(sum(e.processor_fee_delta),0),

    coalesce(sum(e.ffos_commission_delta),0),
    coalesce(sum(e.ffos_admin_fee_delta),0),

    coalesce(sum(e.festival_entitlement_delta),0)

  into
    v_event_count,
    v_gross,
    v_refunds,
    v_chargebacks,
    v_processor,
    v_commission,
    v_admin,
    v_net

  from public.financial_ledger_events e
  join public.festival_settlement_events se
    on se.event_id = e.id
  where se.settlement_id = v_settlement_id;


  update public.festival_settlements
  set
    gross_collected = v_gross,
    refunds_amount = v_refunds,
    chargebacks_amount = v_chargebacks,
    processor_fees_amount = v_processor,

    ffos_commission_amount = v_commission,
    ffos_entry_admin_fees = v_admin,

    net_festival_payout = v_net,

    updated_at = now()

  where id = v_settlement_id;


  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    detail
  )
  values (
    p_tenant_id,
    auth.uid(),
    'settlement.prepared',
    'festival_settlement',
    v_settlement_id,
    jsonb_build_object(
      'periodStart',v_start,
      'periodEnd',v_end,
      'currency',v_currency,
      'eventCount',v_event_count,
      'grossCollected',v_gross,
      'ffosCommission',v_commission,
      'ffosAdminFees',v_admin,
      'netFestivalPayout',v_net,
      'payoutDueDate',v_due
    )
  );


  return jsonb_build_object(
    'settlementId',v_settlement_id,
    'status','draft',

    'periodStart',v_start,
    'periodEnd',v_end,
    'currency',v_currency,

    'eventCount',v_event_count,

    'grossCollected',v_gross,
    'refunds',v_refunds,
    'chargebacks',v_chargebacks,
    'processorFees',v_processor,

    'ffosCommission',v_commission,
    'ffosEntryAdminFees',v_admin,

    'netFestivalPayout',v_net,

    'payoutDueDate',v_due
  );

end;
$$;


-- =========================================================
-- 3. RECONCILE / FREEZE SETTLEMENT
--
-- Reconciliation cannot happen before the accounting month
-- has actually ended.
-- =========================================================

create or replace function
public.reconcile_monthly_festival_settlement(
  p_settlement_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.festival_settlements%rowtype;
begin

  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;


  select *
    into v_settlement
  from public.festival_settlements
  where id = p_settlement_id;

  if not found then
    raise exception 'Settlement not found.';
  end if;


  if not (
    public.is_platform_admin()
    or public.has_tenant_role(
      v_settlement.tenant_id,
      array[
        'platform_admin',
        'festival_owner',
        'festival_staff'
      ]
    )
  ) then
    raise exception
      'Authorised festival finance access required.';
  end if;


  if v_settlement.status <> 'draft' then
    raise exception
      'Only a draft settlement can be reconciled.';
  end if;


  if current_date <= v_settlement.period_end then
    raise exception
      'The accounting period has not ended yet.';
  end if;


  -- Refresh one final time immediately before freezing.

  perform public.prepare_monthly_festival_settlement(
    v_settlement.tenant_id,
    v_settlement.period_start,
    v_settlement.currency
  );


  update public.festival_settlements
  set
    status = 'reconciled',
    updated_at = now()
  where id = p_settlement_id
  returning *
    into v_settlement;


  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    detail
  )
  values (
    v_settlement.tenant_id,
    auth.uid(),
    'settlement.reconciled',
    'festival_settlement',
    p_settlement_id,
    jsonb_build_object(
      'periodStart',v_settlement.period_start,
      'periodEnd',v_settlement.period_end,
      'currency',v_settlement.currency,
      'netFestivalPayout',
        v_settlement.net_festival_payout,
      'payoutDueDate',
        v_settlement.payout_due_date
    )
  );


  return jsonb_build_object(
    'settlementId',v_settlement.id,
    'status',v_settlement.status,

    'grossCollected',
      v_settlement.gross_collected,

    'refunds',
      v_settlement.refunds_amount,

    'chargebacks',
      v_settlement.chargebacks_amount,

    'processorFees',
      v_settlement.processor_fees_amount,

    'ffosCommission',
      v_settlement.ffos_commission_amount,

    'ffosEntryAdminFees',
      v_settlement.ffos_entry_admin_fees,

    'netFestivalPayout',
      v_settlement.net_festival_payout,

    'payoutDueDate',
      v_settlement.payout_due_date
  );

end;
$$;


-- =========================================================
-- 4. ACCESS
-- =========================================================

alter table public.festival_settlement_events
  enable row level security;


create policy festival_settlement_events_read
on public.festival_settlement_events
for select
to authenticated
using (
  exists (
    select 1
    from public.festival_settlements fs
    where fs.id = settlement_id
      and (
        public.is_tenant_member(fs.tenant_id)
        or public.is_platform_admin()
      )
  )
);


grant select
on public.festival_settlement_events
to authenticated;


revoke all
on function
public.prepare_monthly_festival_settlement(uuid,date,text)
from public,anon;

grant execute
on function
public.prepare_monthly_festival_settlement(uuid,date,text)
to authenticated;


revoke all
on function
public.reconcile_monthly_festival_settlement(uuid)
from public,anon;

grant execute
on function
public.reconcile_monthly_festival_settlement(uuid)
to authenticated;


comment on function
public.prepare_monthly_festival_settlement(uuid,date,text) is
'FFOS™ prepares or refreshes a draft monthly festival settlement from immutable dated financial events.';

comment on function
public.reconcile_monthly_festival_settlement(uuid) is
'FFOS™ refreshes and freezes a completed accounting month as a reconciled festival settlement.';


notify pgrst, 'reload schema';

commit;
