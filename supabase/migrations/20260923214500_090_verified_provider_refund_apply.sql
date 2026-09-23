-- Film Festival OS™
-- Migration 090
-- Verified Provider Full Refund Application
--
-- Called only after a payment-provider webhook has been
-- cryptographically verified and recorded in payment_provider_events.
--
-- First controlled release:
-- PayPal Sandbox + FULL refund only.

begin;

create or replace function
public.apply_verified_provider_full_refund(
  p_provider_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.payment_provider_events%rowtype;
  v_checkout public.payment_checkout_sessions%rowtype;
  v_payment public.submission_payments%rowtype;
  v_request public.provider_refund_requests%rowtype;
  v_adjustment public.payment_adjustments%rowtype;
  v_ledger public.submission_entry_ledger%rowtype;

  v_amount numeric(12,2);
  v_currency text;
  v_refund_id text;
  v_capture_id text;
  v_reason text;
  v_origin text;
  v_journal_rows integer := 0;
begin
  -- -------------------------------------------------------
  -- 1. VERIFIED PROVIDER EVENT
  -- -------------------------------------------------------

  select *
  into v_event
  from public.payment_provider_events
  where id = p_provider_event_id
  for update;

  if not found then
    raise exception
      'Provider event not found';
  end if;

  if v_event.provider <> 'paypal'
     or v_event.environment <> 'sandbox'
     or v_event.event_type <> 'PAYMENT.CAPTURE.REFUNDED'
     or v_event.verified is not true then
    raise exception
      'Provider event is not an authorised PayPal Sandbox refund event';
  end if;

  if v_event.processed is true then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'processing_result', v_event.processing_result
    );
  end if;

  v_refund_id :=
    nullif(trim(coalesce(v_event.provider_reference,'')),'');

  v_capture_id :=
    nullif(
      trim(
        coalesce(
          v_event.metadata ->> 'capture_id',
          ''
        )
      ),
      ''
    );

  if v_refund_id is null
     or v_capture_id is null then
    raise exception
      'Verified refund event is missing provider identifiers';
  end if;

  -- -------------------------------------------------------
  -- 2. MATCH CHECKOUT + PAYMENT
  -- -------------------------------------------------------

  select *
  into v_checkout
  from public.payment_checkout_sessions
  where id = v_event.checkout_session_id
    and provider = 'paypal'
    and environment = 'sandbox'
    and provider_capture_id = v_capture_id
  for update;

  if not found then
    raise exception
      'PayPal Sandbox checkout for refund event not found';
  end if;

  select *
  into v_payment
  from public.submission_payments
  where id = v_event.submission_payment_id
    and id = v_checkout.submission_payment_id
  for update;

  if not found then
    raise exception
      'Submission payment for refund event not found';
  end if;

  if v_payment.payment_status not in (
    'paid',
    'refunded'
  ) then
    update public.payment_provider_events
    set
      processed = true,
      processing_result =
        'ignored_payment_status_' ||
        v_payment.payment_status
    where id = v_event.id;

    return jsonb_build_object(
      'ok', true,
      'accepted', false,
      'payment_status', v_payment.payment_status
    );
  end if;

  -- -------------------------------------------------------
  -- 3. FULL REFUND AMOUNT / CURRENCY CONTROL
  -- -------------------------------------------------------

  v_amount :=
    coalesce(v_event.amount,0);

  v_currency :=
    upper(
      trim(
        coalesce(v_event.currency,'')
      )
    );

  if abs(
       v_amount -
       coalesce(v_payment.amount_due,0)
     ) > 0.00001
     or abs(
       v_amount -
       coalesce(v_checkout.amount_due,0)
     ) > 0.00001
     or v_currency <>
       upper(coalesce(v_payment.currency,''))
     or v_currency <>
       upper(coalesce(v_checkout.currency,'')) then

    update public.payment_provider_events
    set
      processed = true,
      processing_result =
        'rejected_full_refund_amount_or_currency_mismatch'
    where id = v_event.id;

    return jsonb_build_object(
      'ok', true,
      'accepted', false,
      'reason',
        'full_refund_amount_or_currency_mismatch'
    );
  end if;

  -- -------------------------------------------------------
  -- 4. OPTIONAL FFOS REFUND REQUEST
  --
  -- A verified provider refund may also originate outside
  -- FFOS (for example directly in the provider console).
  -- Accounting must still follow the real money movement.
  -- -------------------------------------------------------

  select *
  into v_request
  from public.provider_refund_requests
  where provider = 'paypal'
    and environment = 'sandbox'
    and provider_capture_id = v_capture_id
  limit 1
  for update;

  if found then
    if v_request.provider_refund_id is not null
       and v_request.provider_refund_id <> v_refund_id then
      raise exception
        'Provider refund ID conflicts with FFOS refund request';
    end if;

    v_reason :=
      v_request.reason;

    v_origin :=
      'ffos_requested';
  else
    v_reason :=
      'Verified PayPal provider full refund';

    v_origin :=
      'provider_external';
  end if;

  -- -------------------------------------------------------
  -- 5. ENTRY LEDGER LINK
  -- -------------------------------------------------------

  select *
  into v_ledger
  from public.submission_entry_ledger
  where submission_payment_id = v_payment.id
  limit 1
  for update;

  if not found then
    raise exception
      'Entry Ledger record for refunded payment not found';
  end if;

  -- -------------------------------------------------------
  -- 6. IMMUTABLE REFUND ADJUSTMENT
  -- -------------------------------------------------------

  select *
  into v_adjustment
  from public.payment_adjustments
  where submission_payment_id = v_payment.id
    and adjustment_type = 'refund'
    and provider = 'paypal'
    and environment = 'sandbox'
    and provider_reference = v_refund_id
  limit 1;

  if not found then
    insert into public.payment_adjustments (
      tenant_id,
      season_id,
      submission_id,
      submission_payment_id,
      entry_ledger_id,
      settlement_id,
      adjustment_type,
      amount,
      currency,
      ffos_commission_retained,
      reason,
      provider,
      environment,
      provider_reference,
      provider_refund_request_id,
      created_by
    )
    values (
      v_payment.tenant_id,
      coalesce(
        v_payment.season_id,
        v_ledger.season_id
      ),
      v_payment.submission_id,
      v_payment.id,
      v_ledger.id,
      v_ledger.settlement_id,
      'refund',
      v_amount,
      v_currency,
      true,
      v_reason,
      'paypal',
      'sandbox',
      v_refund_id,
      case
        when v_request.id is not null
          then v_request.id
        else null
      end,
      case
        when v_request.id is not null
          then v_request.requested_by
        else null
      end
    )
    returning *
    into v_adjustment;
  end if;

  -- -------------------------------------------------------
  -- 7. PAYMENT STATE
  --
  -- Existing FFOS trigger creates the financial refund
  -- journal event and updates the Entry Ledger.
  -- -------------------------------------------------------

  if v_payment.payment_status = 'paid' then
    update public.submission_payments
    set
      payment_status = 'refunded',
      updated_at = now()
    where id = v_payment.id
      and payment_status = 'paid';
  end if;

  -- -------------------------------------------------------
  -- 8. ADD PROVIDER / ADJUSTMENT PROVENANCE TO JOURNAL
  --
  -- Done in the same DB transaction as the status change.
  -- -------------------------------------------------------

  update public.financial_ledger_events
  set
    adjustment_id = v_adjustment.id,
    provider = 'paypal',
    provider_reference = v_refund_id,
    metadata =
      coalesce(metadata,'{}'::jsonb) ||
      jsonb_build_object(
        'commission_retained', true,
        'refund_origin', v_origin,
        'provider_capture_id', v_capture_id,
        'provider_refund_id', v_refund_id,
        'provider_refund_request_id',
          case
            when v_request.id is not null
              then v_request.id
            else null
          end
      )
  where idempotency_key =
    'payment:' ||
    v_payment.id::text ||
    ':refunded';

  get diagnostics
    v_journal_rows = row_count;

  if v_journal_rows <> 1 then
    raise exception
      'Expected exactly one refund journal event, found %',
      v_journal_rows;
  end if;

  -- -------------------------------------------------------
  -- 9. PROVIDER CONTROL STATE
  -- -------------------------------------------------------

  update public.payment_checkout_sessions
  set
    status = 'refunded',
    updated_at = now()
  where id = v_checkout.id;

  if v_request.id is not null then
    update public.provider_refund_requests
    set
      status = 'completed',
      provider_refund_id = v_refund_id,
      completed_at =
        coalesce(completed_at,now()),
      updated_at = now(),
      last_error = null,
      metadata =
        coalesce(metadata,'{}'::jsonb) ||
        jsonb_build_object(
          'verified_webhook_event_id',
            v_event.provider_event_id
        )
    where id = v_request.id;
  end if;

  update public.payment_provider_events
  set
    processed = true,
    processing_result =
      case
        when v_origin = 'ffos_requested'
          then 'payment_marked_refunded'
        else 'external_provider_refund_recorded'
      end
  where id = v_event.id;

  return jsonb_build_object(
    'ok', true,
    'accepted', true,
    'payment_status', 'refunded',
    'checkout_status', 'refunded',
    'provider_refund_id', v_refund_id,
    'adjustment_id', v_adjustment.id,
    'refund_origin', v_origin
  );
end;
$$;

revoke all
on function
public.apply_verified_provider_full_refund(uuid)
from public;

revoke all
on function
public.apply_verified_provider_full_refund(uuid)
from anon;

revoke all
on function
public.apply_verified_provider_full_refund(uuid)
from authenticated;

grant execute
on function
public.apply_verified_provider_full_refund(uuid)
to service_role;

comment on function
public.apply_verified_provider_full_refund(uuid) is
'Atomically applies a cryptographically verified full provider refund to FFOS accounting. Service-role only. First controlled release: PayPal Sandbox.';

commit;
