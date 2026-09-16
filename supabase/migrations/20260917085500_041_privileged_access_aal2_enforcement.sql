-- Film Festival OS™
-- Migration 041 — BLOCK 041D Privileged Access AAL2 Enforcement
--
-- Enforces MFA assurance at the database/RPC boundary for the
-- auditable privileged-access control-review action.
--
-- Client UI checks remain UX controls only.
-- This function requires the authenticated JWT itself to be AAL2.

create or replace function public.record_privileged_access_control_review(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_platform_admin boolean;
  v_total integer;
  v_active_or_invited integer;
  v_suspended integer;
  v_actor_aal text;
  v_result jsonb;
begin
  v_actor_aal := coalesce(
    auth.jwt() ->> 'aal',
    'unknown'
  );

  if v_actor_aal <> 'aal2' then
    raise exception
      'MFA step-up required: privileged access review requires AAL2.';
  end if;

  v_platform_admin := public.is_platform_admin();

  if not (
    v_platform_admin
    or public.has_tenant_role(
      p_tenant_id,
      array['festival_owner']
    )
  ) then
    raise exception
      'Permission denied: privileged access administration required.';
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where m.status in ('active','invited')
    )::integer,
    count(*) filter (
      where m.status = 'suspended'
    )::integer
  into
    v_total,
    v_active_or_invited,
    v_suspended
  from public.memberships m
  where m.tenant_id = p_tenant_id
    and m.role in (
      'platform_admin',
      'festival_owner'
    )
    and (
      v_platform_admin
      or m.role = 'festival_owner'
    );

  v_result := jsonb_build_object(
    'privileged_memberships',
      v_total,
    'active_or_invited',
      v_active_or_invited,
    'suspended',
      v_suspended,
    'actor_aal',
      v_actor_aal
  );

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
    p_tenant_id,
    auth.uid(),
    'access.privileged_access_reviewed',
    'tenant',
    p_tenant_id,
    jsonb_build_object(
      'control',
        'privileged_access',
      'privileged_memberships',
        v_total,
      'active_or_invited',
        v_active_or_invited,
      'suspended',
        v_suspended,
      'actor_aal',
        v_actor_aal
    ),
    now()
  );

  return v_result;
end;
$$;

revoke all
on function public.record_privileged_access_control_review(uuid)
from public;

grant execute
on function public.record_privileged_access_control_review(uuid)
to authenticated;
