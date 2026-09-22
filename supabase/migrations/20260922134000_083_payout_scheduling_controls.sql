-- Film Festival OS™
-- Migration 083
-- Controlled Payout Scheduling & Confirmation™

begin;

-- =========================================================
-- 1. SETTLEMENT PAYOUT DESTINATION SNAPSHOT
-- =========================================================

alter table public.festival_settlements
  add column if not exists payout_destination_id uuid
    references public.festival_payout_destinations(id)
    on delete set null,

  add column if not exists payout_destination_type text,

  add column if not exists payout_destination_label text,

  add column if not exists payout_account_reference_snapshot text,

  add column if not exists scheduled_at timestamptz,

  add column if not exists scheduled_by uuid
    references auth.users(id) on delete set null;


-- =========================================================
-- 2. SCHEDULE AN ELIGIBLE PAYOUT
-- =========================================================

create or replace function
public.schedule_festival_settlement_payout(
  p_settlement_id uuid,
  p_destination_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.festival_settlements%rowtype;
  v_destination public.festival_payout_destinations%rowtype;
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


  if v_settlement.status <> 'reconciled' then
    raise exception
      'Only a reconciled settlement can be scheduled.';
  end if;


  if not v_settlement.payout_eligible then
    raise exception
      'Settlement is not payout eligible.';
  end if;


  if coalesce(v_settlement.payout_amount,0) <= 0 then
    raise exception
      'No positive payout amount is available.';
  end if;


  -- Use selected destination, otherwise active PRIMARY.
  if p_destination_id is not null then

    select *
      into v_destination
    from public.festival_payout_destinations
    where id = p_destination_id
      and tenant_id = v_settlement.tenant_id;

  else

    select *
      into v_destination
    from public.festival_payout_destinations
    where tenant_id = v_settlement.tenant_id
      and upper(payout_currency) =
          upper(v_settlement.currency)
      and status = 'active'
      and verification_status = 'verified'
      and is_primary = true
    limit 1;

  end if;


  if v_destination.id is null then
    raise exception
      'No eligible payout destination is configured.';
  end if;


  if v_destination.status <> 'active'
     or v_destination.verification_status <> 'verified' then
    raise exception
      'Payout destination must be ACTIVE and VERIFIED.';
  end if;


  if upper(v_destination.payout_currency)
     <> upper(v_settlement.currency) then
    raise exception
      'Payout destination currency does not match settlement currency.';
  end if;


  if nullif(trim(v_destination.account_reference),'') is null then
    raise exception
      'Payout destination account reference is missing.';
  end if;


  update public.festival_settlements
  set
    status = 'scheduled',

    payout_destination_id =
      v_destination.id,

    payout_destination_type =
      v_destination.destination_type,

    payout_destination_label =
      v_destination.display_label,

    payout_account_reference_snapshot =
      v_destination.account_reference,

    scheduled_at = now(),
    scheduled_by = auth.uid(),

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
    'settlement.payout_scheduled',
    'festival_settlement',
    p_settlement_id,
    jsonb_build_object(
      'payoutAmount',
        v_settlement.payout_amount,

      'currency',
        v_settlement.currency,

      'destinationType',
        v_destination.destination_type,

      'destinationLabel',
        v_destination.display_label,

      'payoutDueDate',
        v_settlement.payout_due_date
    )
  );


  return jsonb_build_object(
    'settlementId',
      v_settlement.id,

    'status',
      v_settlement.status,

    'payoutAmount',
      v_settlement.payout_amount,

    'currency',
      v_settlement.currency,

    'destinationType',
      v_destination.destination_type,

    'destinationLabel',
      v_destination.display_label,

    'scheduledAt',
      v_settlement.scheduled_at
  );

end;
$$;


-- =========================================================
-- 3. CONFIRM ACTUAL PAYMENT
-- =========================================================

create or replace function
public.mark_festival_settlement_paid(
  p_settlement_id uuid,
  p_provider_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.festival_settlements%rowtype;
  v_reference text;
begin

  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;


  v_reference :=
    nullif(trim(p_provider_reference),'');

  if v_reference is null then
    raise exception
      'Provider payment reference is required.';
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


  if v_settlement.status <> 'scheduled' then
    raise exception
      'Only a scheduled payout may be marked paid.';
  end if;


  update public.festival_settlements
  set
    status = 'paid',

    payout_provider_reference =
      v_reference,

    paid_at = now(),

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
    'settlement.paid',
    'festival_settlement',
    p_settlement_id,
    jsonb_build_object(
      'payoutAmount',
        v_settlement.payout_amount,

      'currency',
        v_settlement.currency,

      'destinationType',
        v_settlement.payout_destination_type,

      'providerReference',
        v_reference,

      'paidAt',
        v_settlement.paid_at
    )
  );


  return jsonb_build_object(
    'settlementId',
      v_settlement.id,

    'status',
      v_settlement.status,

    'payoutAmount',
      v_settlement.payout_amount,

    'currency',
      v_settlement.currency,

    'providerReference',
      v_reference,

    'paidAt',
      v_settlement.paid_at
  );

end;
$$;


-- =========================================================
-- 4. RPC ACCESS
-- =========================================================

revoke all
on function
public.schedule_festival_settlement_payout(uuid,uuid)
from public,anon;

grant execute
on function
public.schedule_festival_settlement_payout(uuid,uuid)
to authenticated;


revoke all
on function
public.mark_festival_settlement_paid(uuid,text)
from public,anon;

grant execute
on function
public.mark_festival_settlement_paid(uuid,text)
to authenticated;


comment on function
public.schedule_festival_settlement_payout(uuid,uuid) is
'FFOS™ schedules an eligible festival settlement only against an ACTIVE and VERIFIED payout destination.';

comment on function
public.mark_festival_settlement_paid(uuid,text) is
'FFOS™ records completion of an actual festival payout using its provider transaction/reference number.';


notify pgrst, 'reload schema';

commit;
