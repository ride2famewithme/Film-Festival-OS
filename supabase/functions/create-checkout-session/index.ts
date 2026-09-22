import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    },
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(
      'ok',
      { headers: corsHeaders },
    );
  }

  try {
    /* =====================================================
       AUTHENTICATE CALLER
       ===================================================== */

    const authHeader =
      req.headers.get('Authorization');

    if (!authHeader) {
      return json(
        { error: 'Authentication required' },
        401,
      );
    }

    const supabaseUrl =
      Deno.env.get('SUPABASE_URL')!;

    const anonKey =
      Deno.env.get('SUPABASE_ANON_KEY')!;

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
      return json(
        { error: 'Invalid login session' },
        401,
      );
    }

    const body = await req.json();

    const paymentId =
      String(
        body?.submission_payment_id ?? '',
      ).trim();

    if (!paymentId) {
      return json(
        {
          error:
            'submission_payment_id is required',
        },
        400,
      );
    }


    /* =====================================================
       PAYMENT ACCESS
       RLS proves the caller may see this payment.
       Amount/currency NEVER come from the browser.
       ===================================================== */

    const {
      data: paymentRows,
      error: paymentError,
    } = await caller
      .from('submission_payments')
      .select(
        'id,tenant_id,season_id,submission_id,amount_due,currency,payment_status',
      )
      .eq('id', paymentId)
      .limit(1);

    if (
      paymentError ||
      !paymentRows ||
      paymentRows.length === 0
    ) {
      return json(
        {
          error:
            'Payment record not found or access denied',
        },
        404,
      );
    }

    const payment = paymentRows[0];

    if (
      String(payment.payment_status) ===
      'paid'
    ) {
      return json(
        { error: 'Payment is already paid' },
        409,
      );
    }

    const amount =
      Number(payment.amount_due ?? 0);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return json(
        {
          error:
            'This entry has no payable balance',
        },
        409,
      );
    }

    const currency =
      String(
        payment.currency ?? 'USD',
      )
        .trim()
        .toUpperCase();


    /* =====================================================
       SERVER AUTHORITY
       ===================================================== */

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


    /* =====================================================
       GLOBAL FFOS CHECKOUT POLICY
       ===================================================== */

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

    if (policyError) {
      return json(
        {
          error:
            `FFOS payment policy query failed: ${policyError.message}`,
          code:
            String(policyError.code ?? ''),
        },
        503,
      );
    }

    if (
      !policyRows ||
      policyRows.length === 0
    ) {
      return json(
        {
          error:
            'FFOS payment policy row is missing',
        },
        503,
      );
    }

    const policy = policyRows[0];

    if (
      policy.paypal_checkout_enabled !==
      true
    ) {
      return json(
        {
          error:
            'PayPal checkout is currently disabled',
          environment: 'sandbox',
        },
        409,
      );
    }

    if (
      String(policy.checkout_provider) !==
      'paypal'
    ) {
      return json(
        {
          error:
            'PayPal is not the active checkout provider',
        },
        409,
      );
    }

    /*
      HARD SAFETY GATE:
      This first implementation is SANDBOX ONLY.
    */
    if (
      String(
        policy.checkout_environment,
      ) !== 'sandbox'
    ) {
      return json(
        {
          error:
            'This checkout function currently supports sandbox only',
        },
        409,
      );
    }


    /* =====================================================
       REUSE AN OPEN CHECKOUT SESSION
       ===================================================== */

    const {
      data: existingRows,
      error: existingError,
    } = await admin
      .from('payment_checkout_sessions')
      .select('*')
      .eq(
        'submission_payment_id',
        payment.id,
      )
      .eq('provider', 'paypal')
      .eq('environment', 'sandbox')
      .in(
        'status',
        [
          'created',
          'approval_pending',
          'approved',
          'capture_pending',
        ],
      )
      .order(
        'created_at',
        { ascending: false },
      )
      .limit(1);

    if (existingError) {
      return json(
        { error: existingError.message },
        500,
      );
    }

    let checkout =
      existingRows?.[0] ?? null;

    if (
      checkout?.provider_order_id &&
      checkout?.approval_url
    ) {
      return json({
        ok: true,
        reused: true,
        checkout_session_id:
          checkout.id,
        provider: 'paypal',
        environment: 'sandbox',
        order_id:
          checkout.provider_order_id,
        approval_url:
          checkout.approval_url,
        amount:
          Number(
            checkout.amount_due,
          ).toFixed(2),
        currency:
          checkout.currency,
      });
    }


    /* =====================================================
       CREATE INTERNAL CHECKOUT SESSION
       ===================================================== */

    if (!checkout) {
      const idempotencyKey =
        crypto.randomUUID();

      const {
        data: createdRows,
        error: createError,
      } = await admin
        .from(
          'payment_checkout_sessions',
        )
        .insert({
          tenant_id:
            payment.tenant_id,

          season_id:
            payment.season_id,

          submission_id:
            payment.submission_id,

          submission_payment_id:
            payment.id,

          provider: 'paypal',
          environment: 'sandbox',

          status: 'created',

          amount_due:
            amount.toFixed(2),

          currency,

          idempotency_key:
            idempotencyKey,

          created_by:
            user.id,
        })
        .select('*');

      if (
        createError ||
        !createdRows?.[0]
      ) {
        return json(
          {
            error:
              createError?.message ??
              'Unable to create checkout session',
          },
          500,
        );
      }

      checkout =
        createdRows[0];
    }


    /* =====================================================
       PAYPAL SANDBOX CREDENTIALS
       These exist ONLY as Edge Function secrets.
       ===================================================== */

    const clientId =
      Deno.env.get(
        'PAYPAL_CLIENT_ID',
      );

    const clientSecret =
      Deno.env.get(
        'PAYPAL_CLIENT_SECRET',
      );

    if (
      !clientId ||
      !clientSecret
    ) {
      return json(
        {
          error:
            'PayPal Sandbox credentials are not configured',
        },
        503,
      );
    }


    /* =====================================================
       PAYPAL OAUTH TOKEN
       ===================================================== */

    const basicAuth =
      btoa(
        `${clientId}:${clientSecret}`,
      );

    const tokenResponse =
      await fetch(
        'https://api-m.sandbox.paypal.com/v1/oauth2/token',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Basic ${basicAuth}`,

            'Content-Type':
              'application/x-www-form-urlencoded',
          },

          body:
            'grant_type=client_credentials',
        },
      );

    const tokenData =
      await tokenResponse.json();

    if (
      !tokenResponse.ok ||
      !tokenData?.access_token
    ) {
      await admin
        .from(
          'payment_checkout_sessions',
        )
        .update({
          status: 'error',
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', checkout.id);

      const paypalError =
        String(
          tokenData?.error_description ??
          tokenData?.error ??
          '',
        ).trim();

      console.error(
        'PAYPAL_SANDBOX_OAUTH_FAILED',
        {
          status:
            tokenResponse.status,
          paypal_error:
            paypalError || null,
        },
      );

      return json(
        {
          error:
            `PayPal Sandbox OAuth failed (${tokenResponse.status})${paypalError ? `: ${paypalError}` : ''}`,
        },
        502,
      );
    }


    /* =====================================================
       PAYPAL CREATE ORDER
       Amount is calculated by FFOS, never browser input.
       ===================================================== */

    const returnUrl =
      Deno.env.get(
        'FFOS_CHECKOUT_RETURN_URL',
      );

    const cancelUrl =
      Deno.env.get(
        'FFOS_CHECKOUT_CANCEL_URL',
      );

    const applicationContext:
      Record<string, string> = {
        shipping_preference:
          'NO_SHIPPING',

        user_action:
          'PAY_NOW',
      };

    if (returnUrl) {
      applicationContext.return_url =
        returnUrl;
    }

    if (cancelUrl) {
      applicationContext.cancel_url =
        cancelUrl;
    }

    const orderResponse =
      await fetch(
        'https://api-m.sandbox.paypal.com/v2/checkout/orders',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${tokenData.access_token}`,

            'Content-Type':
              'application/json',

            'PayPal-Request-Id':
              String(
                checkout.idempotency_key,
              ),
          },

          body: JSON.stringify({
            intent: 'CAPTURE',

            purchase_units: [
              {
                reference_id:
                  String(payment.id),

                custom_id:
                  String(
                    payment.submission_id,
                  ),

                description:
                  'Film Festival OS™ submission entry fee',

                amount: {
                  currency_code:
                    currency,

                  value:
                    amount.toFixed(2),
                },
              },
            ],

            application_context:
              applicationContext,
          }),
        },
      );

    const orderData =
      await orderResponse.json();

    if (
      !orderResponse.ok ||
      !orderData?.id
    ) {
      await admin
        .from(
          'payment_checkout_sessions',
        )
        .update({
          status: 'error',
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', checkout.id);

      console.error(
        'PAYPAL_ORDER_CREATE_FAILED',
        {
          status:
            orderResponse.status,

          paymentId:
            payment.id,

          checkoutSessionId:
            checkout.id,

          paypal:
            orderData,
        },
      );

      return json(
        {
          error:
            'PayPal Sandbox could not create the order',
        },
        502,
      );
    }


    /* =====================================================
       EXTRACT PAYPAL APPROVAL LINK
       ===================================================== */

    const approvalLink =
      Array.isArray(orderData.links)
        ? orderData.links.find(
            (link: any) =>
              link?.rel ===
              'approve',
          )
        : null;

    const approvalUrl =
      String(
        approvalLink?.href ?? '',
      );

    if (!approvalUrl) {
      return json(
        {
          error:
            'PayPal did not return an approval URL',
        },
        502,
      );
    }


    /* =====================================================
       SAVE PROVIDER ORDER
       ===================================================== */

    const {
      error: updateError,
    } = await admin
      .from(
        'payment_checkout_sessions',
      )
      .update({
        provider_order_id:
          String(orderData.id),

        approval_url:
          approvalUrl,

        status:
          'approval_pending',

        updated_at:
          new Date().toISOString(),
      })
      .eq('id', checkout.id);

    if (updateError) {
      return json(
        {
          error:
            updateError.message,
        },
        500,
      );
    }


    /* =====================================================
       SAFE RESPONSE TO APP
       No provider credentials returned.
       ===================================================== */

    return json({
      ok: true,

      reused: false,

      checkout_session_id:
        checkout.id,

      provider:
        'paypal',

      environment:
        'sandbox',

      order_id:
        String(orderData.id),

      approval_url:
        approvalUrl,

      amount:
        amount.toFixed(2),

      currency,
    });

  } catch (error) {
    console.error(
      'CREATE_CHECKOUT_SESSION_ERROR',
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
