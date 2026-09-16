import { createClient } from 'npm:@supabase/supabase-js@2';

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
    const expectedSecret =
      Deno.env.get('NOTIFICATION_WORKER_SECRET') ?? '';

    const suppliedSecret =
      req.headers.get('x-worker-secret') ?? '';

    if (
      !expectedSecret ||
      !suppliedSecret ||
      suppliedSecret !== expectedSecret
    ) {
      return json({ error: 'Unauthorized worker request' }, 401);
    }

    const deliveryEnabled =
      Deno.env.get('NOTIFICATION_DELIVERY_ENABLED') === 'true';

    /*
     * MASTER SAFETY GATE
     *
     * While disabled:
     * - no notification is claimed
     * - no database status is changed
     * - no external email is sent
     */
    if (!deliveryEnabled) {
      return json({
        ok: true,
        delivery_enabled: false,
        status: 'DISABLED',
        message:
          'Notification worker is installed but external delivery is disabled.',
      });
    }

    const supabaseUrl =
      Deno.env.get('SUPABASE_URL')!;

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const resendApiKey =
      Deno.env.get('RESEND_API_KEY') ?? '';

    const resendFrom =
      Deno.env.get('RESEND_FROM') ??
      'Film Festival OS <notifications@notify.filmfestivalos.com>';

    if (!resendApiKey) {
      return json({
        error: 'RESEND_API_KEY is not configured',
      }, 500);
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

    const {
      data: claimed,
      error: claimError,
    } = await admin.rpc('claim_next_notification');

    if (claimError) {
      return json({
        error: 'Unable to claim notification',
        detail: claimError.message,
      }, 500);
    }

    const notification =
      Array.isArray(claimed)
        ? claimed[0]
        : null;

    if (!notification) {
      return json({
        ok: true,
        delivery_enabled: true,
        status: 'NO_WORK',
        message: 'No queued notifications available.',
      });
    }

    const resendResponse = await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',

          // Prevent duplicate delivery during a retry.
          'Idempotency-Key':
            `ffos-notification/${notification.id}`,
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [notification.recipient_email],
          subject: notification.subject,
          text: notification.body,
        }),
      },
    );

    const responseText =
      await resendResponse.text();

    let resendData: any = null;

    try {
      resendData =
        responseText
          ? JSON.parse(responseText)
          : null;
    } catch {
      resendData = {
        raw: responseText,
      };
    }

    if (!resendResponse.ok) {
      const errorText =
        `Resend HTTP ${resendResponse.status}: ` +
        responseText.slice(0, 3500);

      const {
        error: markFailedError,
      } = await admin.rpc(
        'mark_notification_failed',
        {
          p_notification_id: notification.id,
          p_error: errorText,
        },
      );

      return json({
        ok: false,
        status: 'RESEND_FAILED',
        notification_id: notification.id,
        resend_status: resendResponse.status,
        resend: resendData,
        mark_failed_error:
          markFailedError?.message ?? null,
      }, 502);
    }

    const providerMessageId =
      String(resendData?.id ?? '').trim();

    if (!providerMessageId) {
      await admin.rpc(
        'mark_notification_failed',
        {
          p_notification_id: notification.id,
          p_error:
            'Resend accepted request but returned no message ID',
        },
      );

      return json({
        ok: false,
        status: 'RESEND_NO_MESSAGE_ID',
        notification_id: notification.id,
      }, 502);
    }

    const {
      error: sentError,
    } = await admin.rpc(
      'mark_notification_sent',
      {
        p_notification_id: notification.id,
        p_provider: 'resend',
        p_provider_message_id: providerMessageId,
      },
    );

    if (sentError) {
      return json({
        ok: false,
        status: 'EMAIL_SENT_DATABASE_UPDATE_FAILED',
        notification_id: notification.id,
        provider_message_id: providerMessageId,
        detail: sentError.message,
      }, 500);
    }

    return json({
      ok: true,
      status: 'SENT',
      notification_id: notification.id,
      provider: 'resend',
      provider_message_id: providerMessageId,
      recipient: notification.recipient_email,
    });

  } catch (error) {
    return json({
      error:
        error instanceof Error
          ? error.message
          : 'Unexpected worker error',
    }, 500);
  }
});
