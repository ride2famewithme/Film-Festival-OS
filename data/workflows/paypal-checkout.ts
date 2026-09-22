import { requireSupabaseClient } from '@/data/supabase-client';

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
