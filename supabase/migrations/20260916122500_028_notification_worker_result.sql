-- Film Festival OS™
-- Migration 028 — Notification Worker Result
-- Records provider success/failure.
-- Does NOT send email.

create or replace function public.mark_notification_sent(
  p_notification_id uuid,
  p_provider text,
  p_provider_message_id text
)
returns setof public.notifications
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.notifications n
  set
    status = 'sent',
    sent_at = now(),
    processing_at = null,
    failed_at = null,
    last_error = null,
    provider = p_provider,
    provider_message_id = p_provider_message_id
  where n.id = p_notification_id
    and n.status = 'processing'
  returning n.*;
end;
$$;

create or replace function public.mark_notification_failed(
  p_notification_id uuid,
  p_error text
)
returns setof public.notifications
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.notifications n
  set
    status = 'failed',
    failed_at = now(),
    processing_at = null,
    last_error = left(coalesce(p_error,'Unknown delivery error'), 4000)
  where n.id = p_notification_id
    and n.status = 'processing'
  returning n.*;
end;
$$;

revoke all on function public.mark_notification_sent(uuid,text,text) from public;
revoke all on function public.mark_notification_sent(uuid,text,text) from anon;
revoke all on function public.mark_notification_sent(uuid,text,text) from authenticated;
grant execute on function public.mark_notification_sent(uuid,text,text) to service_role;

revoke all on function public.mark_notification_failed(uuid,text) from public;
revoke all on function public.mark_notification_failed(uuid,text) from anon;
revoke all on function public.mark_notification_failed(uuid,text) from authenticated;
grant execute on function public.mark_notification_failed(uuid,text) to service_role;
