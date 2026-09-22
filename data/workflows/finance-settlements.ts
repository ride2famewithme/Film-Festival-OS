import { can } from '@/data/access';
import { db } from '@/data/db';
import { requireSupabaseClient } from '@/data/supabase-client';
import { getActiveContext, getActiveSeason } from '@/data/session';

async function financeManager() {
  const ctx = await getActiveContext();

  if (!ctx)
    throw new Error('Authentication required');

  if (!can(ctx.role, 'finance.manage'))
    throw new Error('Finance permission required');

  return ctx;
}


/* =========================================================
   ENTRY LEDGER™
   ========================================================= */

export async function listFinanceEntryLedger() {
  const ctx = await financeManager();
  const season = await getActiveSeason();

  let q = db
    .from<any>('submission_entry_ledger')
    .select('*')
    .eq('tenant_id', ctx.tenantId);

  if (season) {
    q = q.eq('season_id', String(season.id));
  }

  const r = await q.order(
    'updated_at',
    { ascending: false }
  );

  if (r.error)
    throw new Error(r.error.message);

  return r.data ?? [];
}


/* =========================================================
   MONTHLY SETTLEMENTS™
   ========================================================= */

export async function listFestivalSettlements() {
  const ctx = await financeManager();

  const r = await db
    .from<any>('festival_settlements')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .order('period_start', { ascending: false });

  if (r.error)
    throw new Error(r.error.message);

  return r.data ?? [];
}


export async function prepareFestivalSettlement(
  periodStart: string,
  currency = 'USD'
) {
  const ctx = await financeManager();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) {
    throw new Error(
      'Settlement period must use YYYY-MM-DD format.'
    );
  }

  const client = requireSupabaseClient();

  const { data, error } = await client.rpc(
    'prepare_monthly_festival_settlement',
    {
      p_tenant_id: ctx.tenantId,
      p_period_start: periodStart,
      p_currency: currency.trim().toUpperCase() || 'USD',
    }
  );

  if (error)
    throw new Error(error.message);

  return data;
}


export async function reconcileFestivalSettlement(
  settlementId: string
) {
  await financeManager();

  const client = requireSupabaseClient();

  const { data, error } = await client.rpc(
    'reconcile_monthly_festival_settlement',
    {
      p_settlement_id: settlementId,
    }
  );

  if (error)
    throw new Error(error.message);

  return data;
}


/* =========================================================
   PAYOUT DESTINATIONS™
   ========================================================= */

export async function listPayoutDestinations() {
  const ctx = await financeManager();

  const r = await db
    .from<any>('festival_payout_destinations')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: true });

  if (r.error)
    throw new Error(r.error.message);

  return r.data ?? [];
}


export async function scheduleFestivalPayout(
  settlementId: string,
  destinationId?: string
) {
  await financeManager();

  const client = requireSupabaseClient();

  const { data, error } = await client.rpc(
    'schedule_festival_settlement_payout',
    {
      p_settlement_id: settlementId,
      p_destination_id: destinationId || null,
    }
  );

  if (error)
    throw new Error(error.message);

  return data;
}


export async function confirmFestivalPayoutPaid(
  settlementId: string,
  providerReference: string
) {
  await financeManager();

  const ref = providerReference.trim();

  if (!ref)
    throw new Error('Provider payment reference is required.');

  const client = requireSupabaseClient();

  const { data, error } = await client.rpc(
    'mark_festival_settlement_paid',
    {
      p_settlement_id: settlementId,
      p_provider_reference: ref,
    }
  );

  if (error)
    throw new Error(error.message);

  return data;
}


/* =========================================================
   REFUNDS / ADJUSTMENTS
   ========================================================= */

export async function listPaymentAdjustments() {
  const ctx = await financeManager();
  const season = await getActiveSeason();

  let q = db
    .from<any>('payment_adjustments')
    .select('*')
    .eq('tenant_id', ctx.tenantId);

  if (season) {
    q = q.eq('season_id', String(season.id));
  }

  const r = await q.order(
    'created_at',
    { ascending: false }
  );

  if (r.error)
    throw new Error(r.error.message);

  return r.data ?? [];
}


/* =========================================================
   CENTRE SNAPSHOT
   ========================================================= */

export async function loadPaymentsSettlementCentre() {
  const [
    ledger,
    settlements,
    destinations,
    adjustments,
    policy,
  ] = await Promise.all([
    listFinanceEntryLedger(),
    listFestivalSettlements(),
    listPayoutDestinations(),
    listPaymentAdjustments(),
    getPaymentPolicy(),
  ]);

  return {
    ledger,
    settlements,
    destinations,
    adjustments,
    policy,
  };
}


/* =========================================================
   FFOS PAYMENT POLICY
   ========================================================= */

export async function getPaymentPolicy() {
  await financeManager();

  const r = await db
    .from<any>('platform_payment_policy')
    .select('*')
    .eq('scope', 'global');

  if (r.error)
    throw new Error(r.error.message);

  return (r.data ?? [])[0] ?? null;
}


/* =========================================================
   CREATE SAFE PAYOUT DESTINATION
   ========================================================= */

export async function createPayoutDestination(values: {
  destination_type:
    | 'paypal'
    | 'bank_transfer'
    | 'connected_provider'
    | 'crypto_wallet';

  display_label: string;
  provider_name?: string;
  account_reference?: string;
  crypto_network?: string;
  payout_currency?: string;
}) {
  const ctx = await financeManager();

  const label = values.display_label.trim();

  if (!label)
    throw new Error('Payout destination label is required.');

  const r = await db
    .from<any>('festival_payout_destinations')
    .insert({
      tenant_id: ctx.tenantId,

      destination_type:
        values.destination_type,

      display_label:
        label,

      provider_name:
        values.provider_name?.trim() || null,

      account_reference:
        values.account_reference?.trim() || null,

      crypto_network:
        values.crypto_network?.trim() || null,

      payout_currency:
        values.payout_currency?.trim().toUpperCase() || 'USD',

      // SAFETY:
      // newly-created destinations cannot be used immediately.
      status: 'inactive',
      verification_status: 'unverified',
      is_primary: false,

      notes:
        'Created in FFOS Payments & Settlements Centre™. Requires controlled verification before activation.',

      created_by: ctx.userId,
      updated_by: ctx.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (r.error)
    throw new Error(r.error.message);

  return (r.data ?? [])[0];
}
