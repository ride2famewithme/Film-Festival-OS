-- Film Festival OS™
-- Migration 029 — Resend Delivery Confirmation
--
-- Keeps status='sent' so existing duplicate-prevention logic
-- continues to recognise the notification as already sent.
-- delivered_at records confirmed mailbox-server delivery.

create or replace function public.mark_notification_delivered(
  p_provider_message_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.notifications
  set
    delivered_at = coalesce(delivered_at, now()),
    last_error = null
  where provider = 'resend'
    and provider_message_id = p_provider_message_id
    and status = 'sent'
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.mark_notification_delivered(text) from public;
revoke all on function public.mark_notification_delivered(text) from anon;
revoke all on function public.mark_notification_delivered(text) from authenticated;

grant execute
on function public.mark_notification_delivered(text)
to service_role;
