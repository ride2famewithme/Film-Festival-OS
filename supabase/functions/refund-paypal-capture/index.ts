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

function paypalFailureSummary(
  payload: any,
  httpStatus: number,
) {
  const issue =
    String(
      payload?.details?.[0]?.issue ??
      payload?.name ??
      'PAYPAL_REFUND_FAILED',
    );

  return `PayPal refund failed (${httpStatus}): ${issue}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(
      'ok',
      { headers: corsHeaders },
    );
  }

  if (req.method !== 'POST') {
    return json(
      { error: 'POST required' },
      405,
    );
  }

  try {
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
      Deno.env.get(
        'SUPABASE_SERVICE_ROLE_KEY',
      )!;

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

    const reason =
      String(
        body?.reason ?? '',
      ).trim();

    const dryRun =
      body?.dry_run === true;

    const confirmFullRefund =
      body?.confirm_full_refund === true;

    const confirmedPaymentId =
      String(
        body?.confirm_submission_payment_id ?? '',
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

    if (!reason) {
      return json(
        { error: 'Refund reason is required' },
        400,
      );
    }

    if (reason.length > 500) {
      return json(
        {
          error:
            'Refund reason must be 500 characters or fewer',
        },
        400,
      );
    }

    /*
      REAL REFUND SAFETY INTERLOCK.

      Dry-run requests never require confirmation.

      Any request capable of contacting PayPal must carry:
      1. explicit confirm_full_refund=true
      2. the exact payment ID repeated as confirmation
    */

    if (
      !dryRun &&
      (
        confirmFullRefund !== true ||
        confirmedPaymentId !== paymentId
      )
    ) {
      return json(
        {
          error:
            'Explicit full refund confirmation is required',
        },
        400,
      );
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
      Read the payment with service authority,
      then separately prove the caller has
      refund-authority for its tenant.
    */

    const {
      data: paymentRows,
      error: paymentError,
    } = await admin
      .from('submission_payments')
      .select(
        'id,tenant_id,season_id,submission_id,payment_status,amount_due,currency',
      )
      .eq('id', paymentId)
      .limit(1);

    if (
      paymentError ||
      !paymentRows?.[0]
    ) {
      return json(
        { error: 'Payment not found' },
        404,
      );
    }

    const payment =
      paymentRows[0];

    const {
      data: platformAdmin,
      error: platformAdminError,
    } = await caller.rpc(
      'is_platform_admin',
    );

    if (platformAdminError) {
      return json(
        {
          error:
            'Unable to verify refund authority',
        },
        500,
      );
    }

    let festivalOwner = false;

    if (platformAdmin !== true) {
      const {
        data: ownerRole,
        error: ownerRoleError,
      } = await caller.rpc(
        'has_tenant_role',
        {
          target_tenant:
            payment.tenant_id,
          allowed_roles: [
            'festival_owner',
          ],
        },
      );

      if (ownerRoleError) {
        return json(
          {
            error:
              'Unable to verify refund authority',
          },
          500,
        );
      }

      festivalOwner =
        ownerRole === true;
    }

    if (
      platformAdmin !== true &&
      festivalOwner !== true
    ) {
      return json(
        {
          error:
            'Refund authority required',
        },
        403,
      );
    }

    /*
      First release:
      only a completed PAID payment may enter
      the provider refund workflow.
    */

    if (
      payment.payment_status !== 'paid'
    ) {
      return json(
        {
          error:
            'Only a paid payment can be refunded',
        },
        409,
      );
    }

    const expectedAmount =
      Number(payment.amount_due);

    const expectedCurrency =
      String(
        payment.currency ?? '',
      ).toUpperCase();

    if (
      !Number.isFinite(expectedAmount) ||
      expectedAmount <= 0 ||
      !expectedCurrency
    ) {
      return json(
        {
          error:
            'FFOS payment amount or currency is invalid',
        },
        409,
      );
    }

    /*
      Find the provider-controlled PayPal
      Sandbox checkout carrying the original
      capture ID.
    */

    const {
      data: checkoutRows,
      error: checkoutError,
    } = await admin
      .from('payment_checkout_sessions')
      .select('*')
      .eq(
        'submission_payment_id',
        payment.id,
      )
      .eq('provider', 'paypal')
      .eq('environment', 'sandbox')
      .order(
        'created_at',
        { ascending: false },
      );

    if (checkoutError) {
      return json(
        { error: checkoutError.message },
        500,
      );
    }

    const checkout =
      (checkoutRows ?? []).find(
        (row: any) =>
          (
            row.status === 'completed' ||
            row.status === 'refunded'
          ) &&
          !!String(
            row.provider_capture_id ?? '',
          ).trim(),
      );

    if (!checkout) {
      return json(
        {
          error:
            'Completed PayPal Sandbox capture not found',
        },
        409,
      );
    }

    const captureId =
      String(
        checkout.provider_capture_id,
      ).trim();

    if (
      Number(checkout.amount_due) !==
        expectedAmount ||
      String(
        checkout.currency ?? '',
      ).toUpperCase() !==
        expectedCurrency
    ) {
      return json(
        {
          error:
            'Checkout amount or currency does not match the FFOS payment',
        },
        409,
      );
    }

    /*
      One controlled full-refund lifecycle
      per capture.
    */

    const {
      data: existingRows,
      error: existingError,
    } = await admin
      .from('provider_refund_requests')
      .select('*')
      .eq('provider', 'paypal')
      .eq('environment', 'sandbox')
      .eq(
        'provider_capture_id',
        captureId,
      )
      .limit(1);

    if (existingError) {
      return json(
        { error: existingError.message },
        500,
      );
    }

    let refundRequest =
      existingRows?.[0] ?? null;

    /*
      SAFE AUTHENTICATED QA MODE.

      Everything above this point is read-only:
      authentication, finance authority, payment state,
      provider checkout, capture, amount/currency and
      existing refund-control state have been verified.

      No refund record is created and PayPal is not called.
    */

    if (dryRun) {
      return json({
        ok: true,
        dry_run: true,
        authorised: true,
        refund_eligible: true,

        submission_payment_id:
          payment.id,

        checkout_session_id:
          checkout.id,

        provider:
          'paypal',

        environment:
          'sandbox',

        amount:
          expectedAmount,

        currency:
          expectedCurrency,

        existing_refund_status:
          refundRequest?.status ??
          null,

        no_database_write:
          true,

        no_provider_call:
          true,
      });
    }

    if (
      refundRequest?.status ===
        'completed'
    ) {
      return json({
        ok: true,
        already_completed: true,
        refund_request_id:
          refundRequest.id,
        provider_refund_id:
          refundRequest.provider_refund_id,
      });
    }

    if (
      refundRequest?.status ===
        'submitted' &&
      refundRequest
        ?.provider_refund_id
    ) {
      return json({
        ok: true,
        already_submitted: true,
        refund_request_id:
          refundRequest.id,
        provider_refund_id:
          refundRequest.provider_refund_id,
        waiting_for_verified_webhook:
          true,
      });
    }

    if (
      refundRequest?.status ===
        'rejected'
    ) {
      return json(
        {
          error:
            'This provider refund was rejected and requires review before retrying',
          refund_request_id:
            refundRequest.id,
        },
        409,
      );
    }

    if (
      checkout.status === 'refunded' &&
      !refundRequest
    ) {
      return json(
        {
          error:
            'Provider checkout is already refunded but FFOS refund control history is incomplete',
        },
        409,
      );
    }

    /*
      Keep the idempotency value deterministic
      for this checkout/capture.
    */

    const providerRequestId =
      `${String(checkout.id)
        .replace(/-/g, '')}R`;

    if (!refundRequest) {
      const {
        data: insertedRows,
        error: insertError,
      } = await admin
        .from(
          'provider_refund_requests',
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
          checkout_session_id:
            checkout.id,

          provider:
            'paypal',

          environment:
            'sandbox',

          provider_capture_id:
            captureId,

          amount:
            expectedAmount,

          currency:
            expectedCurrency,

          reason,

          status:
            'requested',

          provider_request_id:
            providerRequestId,

          requested_by:
            user.id,

          metadata: {
            provider_order_id:
              checkout.provider_order_id ??
              null,
          },
        })
        .select('*');

      if (
        insertError ||
        !insertedRows?.[0]
      ) {
        /*
          A concurrent identical request may
          have won the unique constraint.
          Re-read before treating it as failure.
        */

        const {
          data: racedRows,
        } = await admin
          .from(
            'provider_refund_requests',
          )
          .select('*')
          .eq(
            'provider',
            'paypal',
          )
          .eq(
            'environment',
            'sandbox',
          )
          .eq(
            'provider_capture_id',
            captureId,
          )
          .limit(1);

        if (!racedRows?.[0]) {
          return json(
            {
              error:
                insertError?.message ??
                'Unable to create refund control record',
            },
            500,
          );
        }

        refundRequest =
          racedRows[0];
      } else {
        refundRequest =
          insertedRows[0];
      }
    }

    if (
      refundRequest.status ===
        'completed'
    ) {
      return json({
        ok: true,
        already_completed: true,
        refund_request_id:
          refundRequest.id,
        provider_refund_id:
          refundRequest.provider_refund_id,
      });
    }

    if (
      refundRequest.status ===
        'submitted' &&
      refundRequest
        .provider_refund_id
    ) {
      return json({
        ok: true,
        already_submitted: true,
        refund_request_id:
          refundRequest.id,
        provider_refund_id:
          refundRequest.provider_refund_id,
        waiting_for_verified_webhook:
          true,
      });
    }

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
      await admin
        .from(
          'provider_refund_requests',
        )
        .update({
          status: 'error',
          last_error:
            'PayPal Sandbox credentials are not configured',
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', refundRequest.id);

      return json(
        {
          error:
            'PayPal Sandbox credentials are not configured',
        },
        503,
      );
    }

    /*
      PayPal Sandbox OAuth token.
    */

    const tokenResponse =
      await fetch(
        'https://api-m.sandbox.paypal.com/v1/oauth2/token',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Basic ${btoa(
                `${clientId}:${clientSecret}`,
              )}`,

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
          'provider_refund_requests',
        )
        .update({
          status: 'error',
          last_error:
            'Unable to authenticate with PayPal Sandbox',
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', refundRequest.id);

      return json(
        {
          error:
            'Unable to authenticate with PayPal Sandbox',
        },
        502,
      );
    }

    /*
      FULL REFUND ONLY.

      Empty JSON body means full refund.
      FFOS does not change payment_status here.
      Verified webhook remains authoritative.
    */

    const refundResponse =
      await fetch(
        `https://api-m.sandbox.paypal.com/v2/payments/captures/${encodeURIComponent(
          captureId,
        )}/refund`,
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${tokenData.access_token}`,

            'Content-Type':
              'application/json',

            'PayPal-Request-Id':
              refundRequest.provider_request_id,

            Prefer:
              'return=representation',
          },

          body: '{}',
        },
      );

    let refundData: any = null;

    try {
      refundData =
        await refundResponse.json();
    } catch {
      refundData = null;
    }

    if (!refundResponse.ok) {
      const failure =
        paypalFailureSummary(
          refundData,
          refundResponse.status,
        );

      const terminalReject =
        refundResponse.status === 400 ||
        refundResponse.status === 403 ||
        refundResponse.status === 404 ||
        refundResponse.status === 422;

      await admin
        .from(
          'provider_refund_requests',
        )
        .update({
          status:
            terminalReject
              ? 'rejected'
              : 'error',

          last_error:
            failure,

          updated_at:
            new Date().toISOString(),

          metadata: {
            ...(
              refundRequest.metadata ??
              {}
            ),

            paypal_http_status:
              refundResponse.status,

            paypal_issue:
              refundData
                ?.details?.[0]
                ?.issue ??
              refundData?.name ??
              null,

            paypal_debug_id:
              refundData
                ?.debug_id ??
              null,
          },
        })
        .eq('id', refundRequest.id);

      return json(
        {
          error:
            'PayPal Sandbox refund request failed',

          refund_request_id:
            refundRequest.id,
        },
        terminalReject
          ? 409
          : 502,
      );
    }

    const refundId =
      String(
        refundData?.id ?? '',
      ).trim();

    const refundStatus =
      String(
        refundData?.status ?? '',
      ).toUpperCase();

    const refundAmount =
      Number(
        refundData
          ?.amount?.value ??
        NaN,
      );

    const refundCurrency =
      String(
        refundData
          ?.amount
          ?.currency_code ?? '',
      ).toUpperCase();

    const amountMatches =
      Number.isFinite(refundAmount) &&
      Math.abs(
        refundAmount -
        expectedAmount,
      ) < 0.00001;

    const currencyMatches =
      refundCurrency ===
      expectedCurrency;

    if (
      !refundId ||
      !amountMatches ||
      !currencyMatches
    ) {
      await admin
        .from(
          'provider_refund_requests',
        )
        .update({
          status: 'error',

          provider_refund_id:
            refundId || null,

          last_error:
            'PayPal refund response did not match the FFOS payment',

          updated_at:
            new Date().toISOString(),

          metadata: {
            ...(
              refundRequest.metadata ??
              {}
            ),

            paypal_refund_status:
              refundStatus || null,
          },
        })
        .eq('id', refundRequest.id);

      return json(
        {
          error:
            'PayPal refund response did not match the FFOS payment',
        },
        502,
      );
    }

    if (
      refundStatus === 'FAILED' ||
      refundStatus === 'CANCELLED'
    ) {
      await admin
        .from(
          'provider_refund_requests',
        )
        .update({
          status: 'rejected',

          provider_refund_id:
            refundId,

          last_error:
            `PayPal refund returned ${refundStatus}`,

          updated_at:
            new Date().toISOString(),

          metadata: {
            ...(
              refundRequest.metadata ??
              {}
            ),

            paypal_refund_status:
              refundStatus,
          },
        })
        .eq('id', refundRequest.id);

      return json(
        {
          error:
            `PayPal refund returned ${refundStatus}`,

          refund_request_id:
            refundRequest.id,
        },
        409,
      );
    }

    if (
      refundStatus !== 'COMPLETED' &&
      refundStatus !== 'PENDING'
    ) {
      await admin
        .from(
          'provider_refund_requests',
        )
        .update({
          status: 'error',

          provider_refund_id:
            refundId,

          last_error:
            `Unexpected PayPal refund status: ${refundStatus}`,

          updated_at:
            new Date().toISOString(),

          metadata: {
            ...(
              refundRequest.metadata ??
              {}
            ),

            paypal_refund_status:
              refundStatus,
          },
        })
        .eq('id', refundRequest.id);

      return json(
        {
          error:
            'Unexpected PayPal refund status',
        },
        502,
      );
    }

    const {
      error: requestUpdateError,
    } = await admin
      .from(
        'provider_refund_requests',
      )
      .update({
        status: 'submitted',

        provider_refund_id:
          refundId,

        last_error: null,

        updated_at:
          new Date().toISOString(),

        metadata: {
          ...(
            refundRequest.metadata ??
            {}
          ),

          paypal_refund_status:
            refundStatus,

          paypal_create_time:
            refundData
              ?.create_time ??
            null,
        },
      })
      .eq('id', refundRequest.id)
      .neq('status', 'completed');

    if (requestUpdateError) {
      return json(
        {
          error:
            requestUpdateError.message,
        },
        500,
      );
    }

    /*
      The verified webhook may have completed
      the refund while the PayPal API response
      was still being processed.

      Never downgrade COMPLETED back to SUBMITTED.
    */

    const {
      data: finalRows,
      error: finalReadError,
    } = await admin
      .from(
        'provider_refund_requests',
      )
      .select(
        'id,status,provider_refund_id',
      )
      .eq('id', refundRequest.id)
      .limit(1);

    if (
      finalReadError ||
      !finalRows?.[0]
    ) {
      return json(
        {
          error:
            finalReadError?.message ??
            'Unable to confirm refund control state',
        },
        500,
      );
    }

    const finalRequest =
      finalRows[0];

    if (
      finalRequest.status ===
        'completed'
    ) {
      return json({
        ok: true,

        already_completed:
          true,

        refund_request_id:
          finalRequest.id,

        provider_refund_id:
          finalRequest
            .provider_refund_id ??
          refundId,

        ffos_payment_status:
          'refunded',

        waiting_for_verified_webhook:
          false,
      });
    }

    return json({
      ok: true,

      refund_request_id:
        refundRequest.id,

      provider_refund_id:
        refundId,

      provider_status:
        refundStatus,

      ffos_payment_status:
        'paid',

      waiting_for_verified_webhook:
        true,
    });
  } catch (error) {
    console.error(
      'REFUND_PAYPAL_CAPTURE_ERROR',
      error,
    );

    return json(
      {
        error:
          'Unexpected PayPal refund error',
      },
      500,
    );
  }
});
