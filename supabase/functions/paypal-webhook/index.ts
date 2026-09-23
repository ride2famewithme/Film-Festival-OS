import { createClient } from 'npm:@supabase/supabase-js@2';

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json(
      { error: 'POST required' },
      405,
    );
  }

  try {
    const supabaseUrl =
      Deno.env.get('SUPABASE_URL')!;

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const paypalClientId =
      Deno.env.get('PAYPAL_CLIENT_ID');

    const paypalClientSecret =
      Deno.env.get('PAYPAL_CLIENT_SECRET');

    const webhookId =
      Deno.env.get('PAYPAL_WEBHOOK_ID');

    if (
      !paypalClientId ||
      !paypalClientSecret ||
      !webhookId
    ) {
      return json(
        {
          error:
            'PayPal webhook configuration incomplete',
        },
        503,
      );
    }

    /*
      Capture original body first.
    */
    const rawBody = await req.text();

    let event: any;

    try {
      event = JSON.parse(rawBody);
    } catch {
      return json(
        { error: 'Invalid JSON payload' },
        400,
      );
    }

    /*
      Required PayPal transmission headers.
    */
    const transmissionId =
      req.headers.get(
        'paypal-transmission-id',
      );

    const transmissionTime =
      req.headers.get(
        'paypal-transmission-time',
      );

    const transmissionSig =
      req.headers.get(
        'paypal-transmission-sig',
      );

    const certUrl =
      req.headers.get(
        'paypal-cert-url',
      );

    const authAlgo =
      req.headers.get(
        'paypal-auth-algo',
      );

    if (
      !transmissionId ||
      !transmissionTime ||
      !transmissionSig ||
      !certUrl ||
      !authAlgo
    ) {
      return json(
        {
          error:
            'Missing PayPal webhook signature headers',
        },
        400,
      );
    }

    /*
      Obtain PayPal Sandbox OAuth token.
    */
    const tokenResponse =
      await fetch(
        'https://api-m.sandbox.paypal.com/v1/oauth2/token',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Basic ${btoa(
                `${paypalClientId}:${paypalClientSecret}`,
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
      return json(
        {
          error:
            'Unable to authenticate webhook verification with PayPal Sandbox',
        },
        502,
      );
    }

    /*
      Ask PayPal to verify its own webhook signature.
    */
    const verifyResponse =
      await fetch(
        'https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${tokenData.access_token}`,

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            auth_algo:
              authAlgo,

            cert_url:
              certUrl,

            transmission_id:
              transmissionId,

            transmission_sig:
              transmissionSig,

            transmission_time:
              transmissionTime,

            webhook_id:
              webhookId,

            webhook_event:
              event,
          }),
        },
      );

    const verifyData =
      await verifyResponse.json();

    if (
      !verifyResponse.ok ||
      verifyData?.verification_status !==
        'SUCCESS'
    ) {
      console.error(
        'PAYPAL_WEBHOOK_VERIFICATION_FAILED',
        {
          eventId:
            event?.id ?? null,

          eventType:
            event?.event_type ?? null,

          status:
            verifyData?.verification_status ??
            null,
        },
      );

      return json(
        {
          error:
            'PayPal webhook verification failed',
        },
        400,
      );
    }

    /*
      From this point the event is verified.
    */
    const eventId =
      String(event?.id ?? '');

    const eventType =
      String(event?.event_type ?? '');

    const resource =
      event?.resource ?? {};

    const resourceId =
      String(resource?.id ?? '');

    const relatedCaptureId =
      String(
        resource
          ?.supplementary_data
          ?.related_ids
          ?.capture_id ?? '',
      );

    const captureUpHref =
      String(
        (
          resource?.links ?? []
        ).find(
          (link: any) =>
            String(
              link?.rel ?? '',
            ).toLowerCase() === 'up' &&
            String(
              link?.href ?? '',
            ).includes(
              '/v2/payments/captures/',
            ),
        )?.href ?? '',
      );

    const linkedCaptureId =
      captureUpHref.match(
        /\/v2\/payments\/captures\/([^/?#]+)/,
      )?.[1] ?? '';

    const orderId =
      String(
        resource
          ?.supplementary_data
          ?.related_ids
          ?.order_id ?? '',
      );

    const isRefundEvent =
      eventType ===
      'PAYMENT.CAPTURE.REFUNDED';

    const captureId =
      isRefundEvent
        ? (
            relatedCaptureId ||
            linkedCaptureId
          )
        : resourceId;

    const refundId =
      isRefundEvent
        ? resourceId
        : '';

    if (
      !eventId ||
      !eventType
    ) {
      return json(
        {
          error:
            'Verified PayPal event missing identifiers',
        },
        400,
      );
    }

    /*
      Only these events are operationally handled
      in this first controlled version.
    */
    if (
      eventType !==
        'PAYMENT.CAPTURE.COMPLETED' &&
      eventType !==
        'PAYMENT.CAPTURE.DENIED' &&
      eventType !==
        'PAYMENT.CAPTURE.REFUNDED'
    ) {
      return json({
        ok: true,
        verified: true,
        ignored: true,
        event_type:
          eventType,
      });
    }

    if (
      isRefundEvent
        ? (!refundId || !captureId)
        : !orderId
    ) {
      return json(
        {
          error:
            isRefundEvent
              ? 'Verified PayPal refund is missing refund or capture identifiers'
              : 'Verified PayPal capture has no related order ID',
        },
        400,
      );
    }

    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken:
              false,

            persistSession:
              false,
          },
        },
      );

    /*
      Match PayPal order to FFOS checkout session.
    */
    let checkoutQuery =
      admin
        .from(
          'payment_checkout_sessions',
        )
        .select('*')
        .eq(
          'provider',
          'paypal',
        )
        .eq(
          'environment',
          'sandbox',
        );

    checkoutQuery =
      isRefundEvent
        ? checkoutQuery.eq(
            'provider_capture_id',
            captureId,
          )
        : checkoutQuery.eq(
            'provider_order_id',
            orderId,
          );

    const {
      data: checkoutRows,
      error: checkoutError,
    } =
      await checkoutQuery.limit(1);

    if (
      checkoutError ||
      !checkoutRows?.[0]
    ) {
      console.error(
        'PAYPAL_WEBHOOK_CHECKOUT_NOT_FOUND',
        {
          eventId,
          eventType,
          orderId:
            orderId || null,
          captureId:
            captureId || null,
          refundId:
            refundId || null,
        },
      );

      return json({
        ok: true,
        verified: true,
        matched: false,
        event_id:
          eventId,
      });
    }

    const checkout =
      checkoutRows[0];

    /*
      Idempotency: PayPal may deliver a webhook
      more than once.
    */
    const {
      data: existingEvents,
    } = await admin
      .from(
        'payment_provider_events',
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
        'provider_event_id',
        eventId,
      )
      .limit(1);

    const existingEvent =
      existingEvents?.[0] ?? null;

    if (
      existingEvent?.processed === true
    ) {
      return json({
        ok: true,
        verified: true,
        duplicate: true,
        event_id:
          eventId,
      });
    }

    const amount =
      Number(
        resource?.amount?.value ??
        NaN,
      );

    const currency =
      String(
        resource?.amount
          ?.currency_code ?? '',
      ).toUpperCase();

    let providerEventId =
      existingEvent?.id ?? null;

    if (!providerEventId) {
      const {
        data: inserted,
        error: insertError,
      } = await admin
        .from(
          'payment_provider_events',
        )
        .insert({
          tenant_id:
            checkout.tenant_id,

          checkout_session_id:
            checkout.id,

          submission_payment_id:
            checkout.submission_payment_id,

          provider:
            'paypal',

          environment:
            'sandbox',

          provider_event_id:
            eventId,

          event_type:
            eventType,

          provider_reference:
            isRefundEvent
              ? refundId
              : captureId || orderId,

          verified:
            true,

          processed:
            false,

          amount:
            Number.isFinite(amount)
              ? amount
              : null,

          currency:
            currency || null,

          occurred_at:
            event?.create_time ??
            null,

          metadata: {
            order_id:
              orderId || null,

            capture_id:
              captureId || null,

            refund_id:
              refundId || null,

            provider_status:
              resource?.status ??
              null,
          },
        })
        .select('id');

      if (
        insertError ||
        !inserted?.[0]
      ) {
        return json(
          {
            error:
              insertError?.message ??
              'Unable to record PayPal provider event',
          },
          500,
        );
      }

      providerEventId =
        inserted[0].id;
    }

    /*
      VERIFIED PAYPAL FULL REFUND.

      Signature verification and provider-event recording
      have already succeeded above.

      The service-role-only DB function atomically applies
      the immutable adjustment, payment state, journal
      provenance, checkout state and refund-control state.
    */

    if (isRefundEvent) {
      const {
        data: refundResult,
        error: refundApplyError,
      } = await admin.rpc(
        'apply_verified_provider_full_refund',
        {
          p_provider_event_id:
            providerEventId,
        },
      );

      if (refundApplyError) {
        console.error(
          'PAYPAL_REFUND_APPLY_FAILED',
          {
            eventId,
            captureId,
            refundId,
            error:
              refundApplyError.message,
          },
        );

        /*
          Do NOT mark the provider event processed here.
          A verified webhook retry may safely replay it.
        */

        return json(
          {
            error:
              'Verified PayPal refund could not be applied to FFOS accounting',
          },
          500,
        );
      }

      return json({
        ok: true,
        verified: true,
        event_type:
          eventType,
        refund_result:
          refundResult,
      });
    }

    /*
      Denied capture:
      preserve payment as unpaid.
    */
    if (
      eventType ===
      'PAYMENT.CAPTURE.DENIED'
    ) {
      await admin
        .from(
          'payment_checkout_sessions',
        )
        .update({
          status:
            'denied',

          provider_capture_id:
            captureId || null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          checkout.id,
        );

      await admin
        .from(
          'payment_provider_events',
        )
        .update({
          processed:
            true,

          processing_result:
            'capture_denied',
        })
        .eq(
          'id',
          providerEventId,
        );

      return json({
        ok: true,
        verified: true,
        payment_status:
          'unchanged',
        checkout_status:
          'denied',
      });
    }

    /*
      COMPLETED capture:
      provider amount/currency must exactly
      match FFOS's own checkout amount.
    */
    const expectedAmount =
      Number(
        checkout.amount_due,
      );

    const expectedCurrency =
      String(
        checkout.currency,
      ).toUpperCase();

    const amountMatches =
      Number.isFinite(amount) &&
      Math.abs(
        amount -
        expectedAmount,
      ) < 0.00001;

    const currencyMatches =
      currency ===
      expectedCurrency;

    if (
      !amountMatches ||
      !currencyMatches
    ) {
      await admin
        .from(
          'payment_provider_events',
        )
        .update({
          processed:
            true,

          processing_result:
            'rejected_amount_or_currency_mismatch',
        })
        .eq(
          'id',
          providerEventId,
        );

      return json({
        ok: true,
        verified: true,
        accepted: false,
        reason:
          'amount_or_currency_mismatch',
      });
    }

    /*
      Check current FFOS payment state before
      allowing transition to PAID.
    */
    const {
      data: paymentRows,
      error: paymentReadError,
    } = await admin
      .from(
        'submission_payments',
      )
      .select(
        'id,payment_status',
      )
      .eq(
        'id',
        checkout.submission_payment_id,
      )
      .limit(1);

    if (
      paymentReadError ||
      !paymentRows?.[0]
    ) {
      return json(
        {
          error:
            'FFOS payment record not found',
        },
        500,
      );
    }

    const payment =
      paymentRows[0];

    /*
      PAID is idempotent.
      Other terminal states are never overwritten.
    */
    if (
      payment.payment_status !==
        'paid' &&
      payment.payment_status !==
        'pending'
    ) {
      await admin
        .from(
          'payment_provider_events',
        )
        .update({
          processed:
            true,

          processing_result:
            `ignored_payment_status_${payment.payment_status}`,
        })
        .eq(
          'id',
          providerEventId,
        );

      return json({
        ok: true,
        verified: true,
        accepted: false,
        payment_status:
          payment.payment_status,
      });
    }

    /*
      VERIFIED PAYPAL COMPLETION:
      This is the only point where the provider
      webhook may promote PENDING → PAID.

      Existing FFOS DB triggers then journal the
      financial event and update the Entry Ledger™.
    */
    if (
      payment.payment_status ===
      'pending'
    ) {
      const {
        error: paymentUpdateError,
      } = await admin
        .from(
          'submission_payments',
        )
        .update({
          payment_status:
            'paid',

          provider_reference:
            captureId || orderId,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          payment.id,
        )
        .eq(
          'payment_status',
          'pending',
        );

      if (paymentUpdateError) {
        return json(
          {
            error:
              paymentUpdateError.message,
          },
          500,
        );
      }
    }

    const {
      error: checkoutUpdateError,
    } = await admin
      .from(
        'payment_checkout_sessions',
      )
      .update({
        status:
          'completed',

        provider_capture_id:
          captureId || null,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        checkout.id,
      );

    if (checkoutUpdateError) {
      return json(
        {
          error:
            checkoutUpdateError.message,
        },
        500,
      );
    }

    await admin
      .from(
        'payment_provider_events',
      )
      .update({
        processed:
          true,

        processing_result:
          'payment_marked_paid',
      })
      .eq(
        'id',
        providerEventId,
      );

    return json({
      ok: true,
      verified: true,
      accepted: true,
      checkout_status:
        'completed',
      payment_status:
        'paid',
    });

  } catch (error) {
    console.error(
      'PAYPAL_WEBHOOK_ERROR',
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
