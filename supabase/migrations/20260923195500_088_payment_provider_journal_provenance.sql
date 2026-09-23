-- Film Festival OS™
-- Migration 088
-- Payment Provider Journal Provenance
--
-- Preserve verified provider provenance in Financial Journal™
-- payment_collected events.

begin;

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
  v_provider text;
  v_provider_reference text;
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

    v_provider := null;

    v_provider_reference :=
      nullif(
        trim(
          coalesce(
            new.provider_reference,
            ''
          )
        ),
        ''
      );

    if v_provider_reference is not null then
      select e.provider
        into v_provider
      from public.payment_provider_events e
      where e.submission_payment_id = new.id
        and e.verified = true
        and e.provider_reference =
          v_provider_reference
      order by e.received_at desc
      limit 1;
    end if;

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
      provider,
      provider_reference,
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
      v_provider,
      v_provider_reference,
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



comment on function
public.record_submission_payment_financial_event() is
'FFOS™ records payment/refund/waiver financial events and preserves verified payment-provider provenance for collected payments.';

commit;
