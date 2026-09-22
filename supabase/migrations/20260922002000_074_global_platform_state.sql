-- Migration 074 — GLOBAL PLATFORM STATE™
-- GLOBAL MASTER KEY™ server-side authority foundation.
--
-- States:
--   active
--   restricted
--   suspended
--   retired
--
-- No state deletes operational or historical data.
-- Only Platform Admin with AAL2 may change the state.

create table if not exists public.platform_global_state (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global'
    check (scope = 'global'),
  state text not null default 'active'
    check (state in ('active','restricted','suspended','retired')),
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  unique(scope)
);

insert into public.platform_global_state (
  scope,
  state,
  reason
)
values (
  'global',
  'active',
  'Initial Film Festival OS™ platform state.'
)
on conflict (scope) do nothing;

alter table public.platform_global_state enable row level security;

revoke all
on table public.platform_global_state
from anon, authenticated;


-- Public-safe read function.
-- Allows FFOS clients and future public portals to know whether
-- the platform is ACTIVE / RESTRICTED / SUSPENDED / RETIRED.
create or replace function public.get_platform_global_state()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'state', p.state,
    'changed_at', p.changed_at
  )
  from public.platform_global_state p
  where p.scope = 'global'
  limit 1;
$$;

revoke all
on function public.get_platform_global_state()
from public;

grant execute
on function public.get_platform_global_state()
to anon, authenticated;


-- GLOBAL MASTER KEY™ state change.
create or replace function public.set_platform_global_state(
  p_state text,
  p_reason text,
  p_audit_tenant_id uuid
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

  -- The audit tenant must be an active Platform Admin workspace
  -- belonging to the current Global Master actor.
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
    raise exception
      'Invalid GLOBAL PLATFORM STATE.';
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
      'actor_aal', v_actor_aal
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
on function public.set_platform_global_state(text,text,uuid)
from public;

grant execute
on function public.set_platform_global_state(text,text,uuid)
to authenticated;
