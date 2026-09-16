-- Film Festival OS™
-- Migration 035 — Emergency Membership Controls
--
-- Membership status changes now pass through a controlled RPC.
-- Prevents tenant owners from suspending platform admins/other owners
-- and prevents a platform admin from accidentally suspending themselves.

drop policy if exists memberships_manage on public.memberships;
drop policy if exists memberships_owner_update on public.memberships;

revoke update
on table public.memberships
from authenticated;

create or replace function public.set_membership_emergency_status(
  p_membership_id uuid,
  p_status text
)
returns public.memberships
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target public.memberships%rowtype;
  v_result public.memberships%rowtype;
  v_previous text;
begin
  if p_status not in ('active','suspended') then
    raise exception 'Invalid membership status.';
  end if;

  select *
  into v_target
  from public.memberships
  where id = p_membership_id;

  if not found then
    raise exception 'Membership not found.';
  end if;

  v_previous := v_target.status;

  if public.is_platform_admin() then

    if v_target.user_id = auth.uid()
       and v_target.role = 'platform_admin'
       and p_status = 'suspended' then
      raise exception
        'Safety lock: you cannot suspend your own Platform Admin membership.';
    end if;

  elsif public.has_tenant_role(
    v_target.tenant_id,
    array['festival_owner']
  ) then

    if v_target.user_id = auth.uid() then
      raise exception
        'Safety lock: you cannot suspend your own membership.';
    end if;

    if v_target.role in ('platform_admin','festival_owner') then
      raise exception
        'Festival Owners cannot change Platform Admin or Festival Owner emergency access.';
    end if;

  else
    raise exception
      'Permission denied: emergency access control requires authorised administration.';
  end if;

  update public.memberships
  set status = p_status
  where id = p_membership_id
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
      when p_status = 'suspended'
        then 'membership.emergency_suspended'
      else 'membership.emergency_reactivated'
    end,
    'membership',
    v_target.id,
    jsonb_build_object(
      'target_user_id', v_target.user_id,
      'target_role', v_target.role,
      'from', v_previous,
      'to', p_status
    ),
    now()
  );

  return v_result;
end;
$$;

revoke all
on function public.set_membership_emergency_status(uuid,text)
from public;

grant execute
on function public.set_membership_emergency_status(uuid,text)
to authenticated;
