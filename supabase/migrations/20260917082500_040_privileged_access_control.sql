-- Film Festival OS™
-- Migration 040 — BLOCK 041 Privileged Access Control Centre™
--
-- Provides:
-- 1. Controlled privileged-membership register.
-- 2. Authority-aware visibility.
-- 3. Auditable privileged-access control review.
--
-- MFA status for other users is NOT inferred here.
-- Current-session MFA/AAL posture is handled by the authenticated UI.

-- ============================================================
-- 1. PRIVILEGED ACCESS REGISTER
-- ============================================================

create or replace function public.privileged_access_register(
  p_tenant_id uuid
)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  role text,
  membership_status text,
  is_self boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_platform_admin boolean;
begin
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

  return query
  select
    m.id,
    m.user_id,
    u.email::text,
    m.role,
    m.status,
    (m.user_id = auth.uid())
  from public.memberships m
  join auth.users u
    on u.id = m.user_id
  where m.tenant_id = p_tenant_id
    and m.role in (
      'platform_admin',
      'festival_owner'
    )

    -- Festival Owners may inspect Festival Owner privileged
    -- access inside their tenant, but not Platform Admin rows.
    and (
      v_platform_admin
      or m.role = 'festival_owner'
    )

  order by
    case m.role
      when 'platform_admin' then 0
      when 'festival_owner' then 1
      else 2
    end,
    u.email;
end;
$$;

revoke all
on function public.privileged_access_register(uuid)
from public;

grant execute
on function public.privileged_access_register(uuid)
to authenticated;


-- ============================================================
-- 2. AUDITABLE PRIVILEGED ACCESS CONTROL REVIEW
-- ============================================================

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

  -- This is the assurance level of the CURRENT authenticated
  -- reviewer session only. It says nothing about other users.
  v_actor_aal := coalesce(
    auth.jwt() ->> 'aal',
    'unknown'
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
