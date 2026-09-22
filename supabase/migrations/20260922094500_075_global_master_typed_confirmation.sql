-- Migration 075 — GLOBAL MASTER KEY™ typed confirmation
-- Adds a deliberate server-side confirmation for dangerous platform states.

drop function if exists public.set_platform_global_state(text,text,uuid);

create or replace function public.set_platform_global_state(
  p_state text,
  p_reason text,
  p_audit_tenant_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_aal text;
  v_row public.platform_global_state%rowtype;
  v_previous_state text;
  v_confirmation text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  v_actor_aal := coalesce(
    auth.jwt() ->> 'aal',
    'unknown'
  );

  if v_actor_aal <> 'aal2' then
    raise exception
      'MFA step-up required: GLOBAL MASTER KEY requires AAL2.';
  end if;

  if not public.is_platform_admin() then
    raise exception
      'Permission denied: GLOBAL MASTER authority required.';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = p_audit_tenant_id
      and m.role = 'platform_admin'
      and m.status = 'active'
  ) then
    raise exception
      'Active Platform Admin workspace required for GLOBAL MASTER audit.';
  end if;

  if p_state not in (
    'active',
    'restricted',
    'suspended',
    'retired'
  ) then
    raise exception 'Invalid GLOBAL PLATFORM STATE.';
  end if;

  if p_state <> 'active'
     and nullif(trim(p_reason), '') is null then
    raise exception
      'A Global Master reason / audit note is required.';
  end if;

  v_confirmation := upper(trim(coalesce(p_confirmation, '')));

  if p_state = 'suspended'
     and v_confirmation <> 'SUSPEND FFOS' then
    raise exception
      'Typed confirmation required: SUSPEND FFOS';
  end if;

  if p_state = 'retired'
     and v_confirmation <> 'RETIRE FFOS' then
    raise exception
      'Typed confirmation required: RETIRE FFOS';
  end if;

  select *
  into v_row
  from public.platform_global_state
  where scope = 'global'
  for update;

  if v_row.id is null then
    raise exception 'GLOBAL PLATFORM STATE record is missing.';
  end if;

  v_previous_state := v_row.state;

  update public.platform_global_state
  set
    state = p_state,
    reason = nullif(trim(p_reason), ''),
    changed_by = auth.uid(),
    changed_at = now()
  where id = v_row.id
  returning *
  into v_row;

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
    p_audit_tenant_id,
    auth.uid(),
    'platform.global_state_changed',
    'platform_global_state',
    v_row.id,
    jsonb_build_object(
      'previous_state', v_previous_state,
      'new_state', v_row.state,
      'reason', v_row.reason,
      'actor_aal', v_actor_aal,
      'typed_confirmation_required',
        p_state in ('suspended','retired')
    ),
    now()
  );

  return jsonb_build_object(
    'id', v_row.id,
    'state', v_row.state,
    'previous_state', v_previous_state,
    'reason', v_row.reason,
    'changed_at', v_row.changed_at,
    'actor_aal', v_actor_aal
  );
end;
$$;

revoke all
on function public.set_platform_global_state(text,text,uuid,text)
from public;

grant execute
on function public.set_platform_global_state(text,text,uuid,text)
to authenticated;
