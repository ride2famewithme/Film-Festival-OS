import { requireSupabaseClient } from '@/data/supabase-client';

export type PayPalSandboxCheckoutSession = {
  id: string;
  submission_payment_id: string;
  status: string;
  approval_url: string | null;
  provider_order_id: string | null;
  provider_capture_id: string | null;
  amount_due: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

export async function listPayPalSandboxCheckouts(
  submissionPaymentIds: string[],
): Promise<PayPalSandboxCheckoutSession[]> {
  const ids = Array.from(
    new Set(
      submissionPaymentIds
        .map((id) => String(id).trim())
        .filter(Boolean),
    ),
  );

  if (ids.length === 0) return [];

  const client = requireSupabaseClient();

  const { data, error } = await client
    .from('payment_checkout_sessions')
    .select(
      'id,submission_payment_id,status,approval_url,provider_order_id,provider_capture_id,amount_due,currency,created_at,updated_at',
    )
    .in('submission_payment_id', ids)
    .eq('provider', 'paypal')
    .eq('environment', 'sandbox')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const latest = new Map<string, PayPalSandboxCheckoutSession>();

  for (const row of (data ?? []) as PayPalSandboxCheckoutSession[]) {
    const paymentId = String(row.submission_payment_id);
    if (!latest.has(paymentId)) latest.set(paymentId, row);
  }

  return Array.from(latest.values());
}

export async function createPayPalSandboxCheckout(
  submissionPaymentId: string,
) {
  const client = requireSupabaseClient();

  const { data, error } =
    await client.functions.invoke(
      'create-checkout-session',
      {
        body: {
          submission_payment_id:
            submissionPaymentId,
        },
      },
    );

  if (error)
    throw new Error(error.message);

  if (data?.error)
    throw new Error(String(data.error));

  if (!data?.checkout_session_id)
    throw new Error(
      'PayPal checkout session was not created.',
    );

  if (!data?.approval_url)
    throw new Error(
      'PayPal approval URL was not returned.',
    );

  return data;
}

export async function capturePayPalSandboxOrder(
  checkoutSessionId: string,
) {
  const client = requireSupabaseClient();

  const { data, error } =
    await client.functions.invoke(
      'capture-paypal-order',
      {
        body: {
          checkout_session_id:
            checkoutSessionId,
        },
      },
    );

  if (error)
    throw new Error(error.message);

  if (data?.error)
    throw new Error(String(data.error));

  return data;
}
