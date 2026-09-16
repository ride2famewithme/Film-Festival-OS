-- Film Festival OS™
-- Migration 037
-- Access Review Duplicate / Early Re-Review Protection™
--
-- Normal review:
--   blocked while an existing review remains current.
--
-- Explicit early re-review:
--   permitted only when the caller deliberately requests it.
--
-- All review actions remain auditable.

create or replace function public.record_access_review(
  p_membership_id uuid,
  p_outcome text,
  p_note text,
  p_allow_early boolean
)
returns public.access_reviews
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target public.memberships%rowtype;
  v_latest public.access_reviews%rowtype;
  v_result public.access_reviews%rowtype;
  v_is_early boolean := false;
begin
  if p_outcome not in ('retained','action_required') then
    raise exception 'Invalid access review outcome.';
  end if;

  select *
  into v_target
  from public.memberships
  where id = p_membership_id;

  if not found then
    raise exception 'Membership not found.';
  end if;

  if v_target.user_id = auth.uid() then
    raise exception
      'Safety lock: users cannot approve their own access review.';
  end if;

  if public.is_platform_admin() then
    null;

  elsif public.has_tenant_role(
    v_target.tenant_id,
    array['festival_owner']
  ) then

    if v_target.role in ('platform_admin','festival_owner') then
      raise exception
        'Festival Owners cannot review Platform Admin or Festival Owner access.';
    end if;

  else
    raise exception
      'Permission denied: access review administration required.';
  end if;

  select *
  into v_latest
  from public.access_reviews
  where tenant_id = v_target.tenant_id
    and membership_id = v_target.id
  order by reviewed_at desc
  limit 1;

  if found and v_latest.next_review_due > now() then
    if not p_allow_early then
      raise exception
        'Access review is already current until %. Use REVIEW AGAIN for an explicit early re-review.',
        v_latest.next_review_due;
    end if;

    v_is_early := true;
  end if;

  insert into public.access_reviews (
    tenant_id,
    membership_id,
    reviewer_user_id,
    outcome,
    note,
    reviewed_at,
    next_review_due
  )
  values (
    v_target.tenant_id,
    v_target.id,
    auth.uid(),
    p_outcome,
    nullif(trim(coalesce(p_note,'')), ''),
    now(),
    now() + interval '90 days'
  )
  returning *
  into v_result;

  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    detail,
    created_at
  )
  values (
    v_target.tenant_id,
    auth.uid(),
    case
      when v_is_early
        then 'membership.access_rereviewed_early'
      else 'membership.access_reviewed'
    end,
    'membership',
    v_target.id,
    jsonb_build_object(
      'target_user_id', v_target.user_id,
      'target_role', v_target.role,
      'membership_status', v_target.status,
      'outcome', p_outcome,
      'early_re_review', v_is_early,
      'previous_review_id', v_latest.id,
      'previous_outcome', v_latest.outcome,
      'previous_next_review_due', v_latest.next_review_due,
      'next_review_due', v_result.next_review_due
    ),
    now()
  );

  return v_result;
end;
$$;

revoke all
on function public.record_access_review(uuid,text,text,boolean)
from public;

grant execute
on function public.record_access_review(uuid,text,text,boolean)
to authenticated;


-- Keep the original 3-argument RPC available for compatibility.
-- It always uses normal duplicate protection.

create or replace function public.record_access_review(
  p_membership_id uuid,
  p_outcome text,
  p_note text default null
)
returns public.access_reviews
language sql
security invoker
set search_path = public
as $$
  select public.record_access_review(
    p_membership_id,
    p_outcome,
    p_note,
    false
  );
$$;

revoke all
on function public.record_access_review(uuid,text,text)
from public;

grant execute
on function public.record_access_review(uuid,text,text)
to authenticated;
