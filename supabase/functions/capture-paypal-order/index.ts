import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return json({ error: 'Authentication required' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const caller = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
        auth: {
          persistSession: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await caller.auth.getUser();

    if (userError || !user) {
      return json({ error: 'Invalid login session' }, 401);
    }

    const body = await req.json();

    const checkoutSessionId =
      String(body?.checkout_session_id ?? '').trim();

    if (!checkoutSessionId) {
      return json(
        { error: 'checkout_session_id is required' },
        400,
      );
    }

    /*
      RLS confirms that the logged-in user is allowed
      to access this checkout session.
    */
    const {
      data: rows,
      error: checkoutError,
    } = await caller
      .from('payment_checkout_sessions')
      .select('*')
      .eq('id', checkoutSessionId)
      .limit(1);

    if (
      checkoutError ||
      !rows ||
      rows.length === 0
    ) {
      return json(
        {
          error:
            'Checkout session not found or access denied',
        },
        404,
      );
    }

    const checkout = rows[0];

    if (
      checkout.provider !== 'paypal' ||
      checkout.environment !== 'sandbox'
    ) {
      return json(
        {
          error:
            'Only PayPal Sandbox checkout is supported',
        },
        409,
      );
    }

    if (!checkout.provider_order_id) {
      return json(
        { error: 'PayPal order has not been created' },
        409,
      );
    }

    if (checkout.status === 'completed') {
      return json({
        ok: true,
        already_completed: true,
        checkout_session_id: checkout.id,
      });
    }

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    /*
      Keep the global safety switch in force.
    */
    const {
      data: policyRows,
      error: policyError,
    } = await admin
      .from('platform_payment_policy')
      .select(
        'checkout_provider,checkout_environment,paypal_checkout_enabled',
      )
      .eq('scope', 'global')
      .limit(1);

    if (
      policyError ||
      !policyRows?.[0]
    ) {
      return json(
        { error: 'FFOS payment policy unavailable' },
        503,
      );
    }

    const policy = policyRows[0];

    if (policy.paypal_checkout_enabled !== true) {
      return json(
        { error: 'PayPal checkout is disabled' },
        409,
      );
    }

    if (
      policy.checkout_provider !== 'paypal' ||
      policy.checkout_environment !== 'sandbox'
    ) {
      return json(
        {
          error:
            'FFOS checkout is not configured for PayPal Sandbox',
        },
        409,
      );
    }

    const clientId =
      Deno.env.get('PAYPAL_CLIENT_ID');

    const clientSecret =
      Deno.env.get('PAYPAL_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return json(
        {
          error:
            'PayPal Sandbox credentials are not configured',
        },
        503,
      );
    }

    /*
      Get PayPal OAuth token.
    */
    const tokenResponse = await fetch(
      'https://api-m.sandbox.paypal.com/v1/oauth2/token',
      {
        method: 'POST',
        headers: {
          Authorization:
            `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Content-Type':
            'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      },
    );

    const tokenData = await tokenResponse.json();

    if (
      !tokenResponse.ok ||
      !tokenData?.access_token
    ) {
      return json(
        {
          error:
            'Unable to authenticate with PayPal Sandbox',
        },
        502,
      );
    }

    /*
      Capture the payer-approved order.
    */
    const captureRequestId =
      `${String(checkout.id)
        .replace(/-/g, '')
        .slice(0, 31)}C`;

    const captureResponse = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${encodeURIComponent(
        checkout.provider_order_id,
      )}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization:
            `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id':
            captureRequestId,
        },
        body: '{}',
      },
    );

    const captureData =
      await captureResponse.json();

    if (!captureResponse.ok) {
      console.error(
        'PAYPAL_CAPTURE_FAILED',
        {
          status: captureResponse.status,
          checkoutSessionId: checkout.id,
          orderId: checkout.provider_order_id,
          paypal: captureData,
        },
      );

      return json(
        {
          error:
            'PayPal Sandbox capture failed',
        },
        502,
      );
    }

    const capture =
      captureData?.purchase_units
        ?.flatMap(
          (unit: any) =>
            unit?.payments?.captures ?? [],
        )
        ?.[0];

    const captureId =
      String(capture?.id ?? '');

    const captureStatus =
      String(capture?.status ?? '');

    const captureAmount =
      Number(capture?.amount?.value ?? NaN);

    const captureCurrency =
      String(
        capture?.amount?.currency_code ?? '',
      ).toUpperCase();

    /*
      Never accept a provider amount/currency mismatch.
    */
    if (
      !captureId ||
      !Number.isFinite(captureAmount) ||
      captureAmount !== Number(checkout.amount_due) ||
      captureCurrency !==
        String(checkout.currency).toUpperCase()
    ) {
      return json(
        {
          error:
            'PayPal capture did not match the FFOS payment record',
        },
        502,
      );
    }

    /*
      IMPORTANT:
      Even when PayPal returns COMPLETED here,
      FFOS payment_status remains unchanged.

      The verified PayPal webhook will be the
      authority that moves the FFOS payment to PAID.
    */
    const sessionStatus =
      captureStatus === 'COMPLETED' ||
      captureStatus === 'PENDING'
        ? 'capture_pending'
        : captureStatus === 'DECLINED'
          ? 'denied'
          : 'error';

    const { error: updateError } =
      await admin
        .from('payment_checkout_sessions')
        .update({
          provider_capture_id:
            captureId,

          status:
            sessionStatus,

          updated_at:
            new Date().toISOString(),
        })
        .eq('id', checkout.id)
        .neq('status', 'completed');

    if (updateError) {
      return json(
        { error: updateError.message },
        500,
      );
    }

    return json({
      ok: true,
      checkout_session_id:
        checkout.id,
      order_id:
        checkout.provider_order_id,
      capture_id:
        captureId,
      capture_status:
        captureStatus,
      ffos_status:
        sessionStatus,
      waiting_for_verified_webhook:
        true,
    });

  } catch (error) {
    console.error(
      'CAPTURE_PAYPAL_ORDER_ERROR',
      error,
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected server error',
      },
      500,
    );
  }
});
