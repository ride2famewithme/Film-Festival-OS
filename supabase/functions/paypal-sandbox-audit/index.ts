import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function reply(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (req.method !== 'GET') {
    return reply({ error: 'GET required' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return reply(
        { error: 'FFOS login required' },
        401,
      );
    }

    const supabaseUrl =
      Deno.env.get('SUPABASE_URL') ?? '';

    const anonKey =
      Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (
      !anonKey ||
      new URL(supabaseUrl).hostname !==
        'htvmmciewewcdavgsdxe.supabase.co'
    ) {
      return reply(
        { error: 'FFOS project configuration mismatch' },
        503,
      );
    }

    const caller = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await caller.auth.getUser();

    if (userError || !user) {
      return reply(
        { error: 'Invalid FFOS session' },
        401,
      );
    }

    const {
      data: isPlatformAdmin,
      error: roleError,
    } = await caller.rpc('is_platform_admin');

    if (roleError) {
      return reply(
        { error: 'Unable to verify Platform Admin role' },
        500,
      );
    }

    if (isPlatformAdmin !== true) {
      return reply(
        { error: 'Platform Admin required' },
        403,
      );
    }

    const clientId =
      Deno.env.get('PAYPAL_CLIENT_ID')?.trim() ?? '';

    const clientSecret =
      Deno.env.get('PAYPAL_CLIENT_SECRET') ?? '';

    const webhookId =
      Deno.env.get('PAYPAL_WEBHOOK_ID')?.trim() ?? '';

    if (!clientId || !clientSecret || !webhookId) {
      return reply(
        { error: 'PayPal Sandbox configuration incomplete' },
        503,
      );
    }

    // Authentication only: no PayPal business operation.
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
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!tokenResponse.ok) {
      return reply({
        error: 'PayPal Sandbox authentication failed',
        paypal_http_status: tokenResponse.status,
      }, 502);
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData?.access_token) {
      return reply(
        { error: 'PayPal Sandbox access token unavailable' },
        502,
      );
    }

    const api =
      'https://api-m.sandbox.paypal.com';

    const getOptions = {
      method: 'GET',
      headers: {
        Authorization:
          `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    };

    // Both operations below are read-only.
    const [listResponse, detailResponse] =
      await Promise.all([
        fetch(
          `${api}/v1/notifications/webhooks`,
          getOptions,
        ),
        fetch(
          `${api}/v1/notifications/webhooks/${
            encodeURIComponent(webhookId)
          }`,
          getOptions,
        ),
      ]);

    const listData: any =
      listResponse.ok
        ? await listResponse.json()
        : null;

    const detailData: any =
      detailResponse.ok
        ? await detailResponse.json()
        : null;

    const appWebhookIds: string[] | null =
      Array.isArray(listData?.webhooks)
        ? listData.webhooks
            .map((item: any) =>
              String(item?.id ?? '')
            )
            .filter(Boolean)
        : null;

    const detailsMatchId =
      detailResponse.ok &&
      String(detailData?.id ?? '') === webhookId;

    const expectedUrl =
      `${supabaseUrl.replace(/\/+$/, '')}` +
      '/functions/v1/paypal-webhook';

    const urlMatches: boolean | null =
      detailsMatchId
        ? String(detailData?.url ?? '')
            .replace(/\/+$/, '') === expectedUrl
        : null;

    const eventNames: string[] | null =
      detailsMatchId &&
      Array.isArray(detailData?.event_types)
        ? detailData.event_types
            .filter((event: any) =>
              String(event?.status ?? '')
                .toUpperCase() !== 'DISABLED'
            )
            .map((event: any) =>
              String(event?.name ?? '')
            )
        : null;

    const subscribed = (name: string) =>
      eventNames === null
        ? null
        : eventNames.includes('*') ||
          eventNames.includes(name);

    const inApplicationList =
      appWebhookIds === null
        ? null
        : appWebhookIds.includes(webhookId);

    const captureSubscribed =
      subscribed('PAYMENT.CAPTURE.COMPLETED');

    const refundSubscribed =
      subscribed('PAYMENT.CAPTURE.REFUNDED');

    const configurationMatches =
      inApplicationList === true &&
      detailsMatchId &&
      urlMatches === true &&
      captureSubscribed === true &&
      refundSubscribed === true;

    return reply({
      ok: true,
      diagnostic_only: true,
      environment: 'sandbox',
      configured_client_id_last_six:
        clientId.slice(-6),
      configured_webhook_id: webhookId,
      application_list_http_status:
        listResponse.status,
      webhook_details_http_status:
        detailResponse.status,
      application_webhook_ids:
        appWebhookIds,
      configured_webhook_in_application:
        inApplicationList,
      webhook_url_matches_ffos:
        urlMatches,
      event_types:
        eventNames,
      capture_completed_subscribed:
        captureSubscribed,
      capture_refunded_subscribed:
        refundSubscribed,
      configuration_matches:
        configurationMatches,
      signed_refund_delivery_tested:
        false,
      refund_executed:
        false,
    });

  } catch {
    return reply(
      {
        error: 'Sandbox diagnostic failed',
        refund_executed: false,
      },
      502,
    );
  }
});
