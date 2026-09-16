-- Film Festival OS™
-- Migration 027 — Atomic Notification Worker Claim
-- Safely claims ONE queued notification for external delivery.
-- Does NOT send email.

create or replace function public.claim_next_notification()
returns setof public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select n.id
    into v_id
  from public.notifications n
  where n.status = 'queued'
  order by n.queued_at asc
  for update skip locked
  limit 1;

  if v_id is null then
    return;
  end if;

  return query
  update public.notifications n
  set
    status = 'processing',
    processing_at = now(),
    last_attempt_at = now(),
    attempt_count = coalesce(n.attempt_count, 0) + 1,
    last_error = null
  where n.id = v_id
  returning n.*;
end;
$$;

revoke all on function public.claim_next_notification() from public;
revoke all on function public.claim_next_notification() from anon;
revoke all on function public.claim_next_notification() from authenticated;
grant execute on function public.claim_next_notification() to service_role;

comment on function public.claim_next_notification()
is 'Atomically claims the oldest queued notification for a trusted server worker. Not callable by normal app users.';
