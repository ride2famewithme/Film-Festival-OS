import { createClient } from 'npm:@supabase/supabase-js@2';
import { Webhook } from 'npm:svix@1';

function json(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(data),
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
    return json({ error: 'POST required' }, 405);
  }

  try {
    const webhookSecret =
      Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';

    if (!webhookSecret) {
      return json({
        error: 'RESEND_WEBHOOK_SECRET is not configured',
      }, 500);
    }

    const svixId =
      req.headers.get('svix-id');

    const svixTimestamp =
      req.headers.get('svix-timestamp');

    const svixSignature =
      req.headers.get('svix-signature');

    if (
      !svixId ||
      !svixTimestamp ||
      !svixSignature
    ) {
      return json({
        error: 'Missing webhook signature headers',
      }, 400);
    }

    // IMPORTANT:
    // Signature verification requires the original raw body.
    const payload = await req.text();

    let event: any;

    try {
      const wh = new Webhook(webhookSecret);

      event = wh.verify(
        payload,
        {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        },
      );
    } catch {
      return json({
        error: 'Invalid webhook signature',
      }, 400);
    }

    if (event?.type !== 'email.delivered') {
      return json({
        ok: true,
        status: 'IGNORED',
        event_type: event?.type ?? null,
      });
    }

    const providerMessageId =
      String(event?.data?.email_id ?? '').trim();

    if (!providerMessageId) {
      return json({
        error: 'email.delivered event has no email_id',
      }, 400);
    }

    const supabaseUrl =
      Deno.env.get('SUPABASE_URL')!;

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const {
      data: notificationId,
      error,
    } = await admin.rpc(
      'mark_notification_delivered',
      {
        p_provider_message_id: providerMessageId,
      },
    );

    if (error) {
      return json({
        error: 'Unable to mark notification delivered',
        detail: error.message,
      }, 500);
    }

    return json({
      ok: true,
      status: notificationId
        ? 'DELIVERED_RECORDED'
        : 'EMAIL_NOT_FOUND',
      notification_id: notificationId ?? null,
      provider_message_id: providerMessageId,
    });

  } catch (error) {
    return json({
      error:
        error instanceof Error
          ? error.message
          : 'Unexpected webhook error',
    }, 500);
  }
});
