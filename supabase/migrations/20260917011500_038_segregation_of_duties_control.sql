-- Film Festival OS™
-- Block 038 — Segregation of Duties & Conflict Control™
--
-- Prevent incompatible competition roles inside the same tenant.
-- Detect existing role conflicts and existing jury conflict states.
-- Provide an auditable segregation-control review.

-- ============================================================
-- 1. CENTRAL ROLE-COMPATIBILITY RULE
-- ============================================================

create or replace function public.membership_roles_incompatible(
  p_role_a text,
  p_role_b text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    (
      p_role_a in ('platform_admin','festival_owner','festival_staff')
      and p_role_b in ('juror','creator')
    )
    or
    (
      p_role_b in ('platform_admin','festival_owner','festival_staff')
      and p_role_a in ('juror','creator')
    )
    or
    (
      p_role_a = 'juror'
      and p_role_b = 'creator'
    )
    or
    (
      p_role_b = 'juror'
      and p_role_a = 'creator'
    );
$$;

revoke all
on function public.membership_roles_incompatible(text,text)
from public;


-- ============================================================
-- 2. DATABASE ENFORCEMENT
-- ============================================================

create or replace function public.enforce_membership_segregation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflicting_role text;
begin
  -- Suspended/inactive access does not create concurrent authority.
  if new.status not in ('active','invited') then
    return new;
  end if;

  select m.role
  into v_conflicting_role
  from public.memberships m
  where m.user_id = new.user_id
    and m.tenant_id = new.tenant_id
    and m.id <> new.id
    and m.status in ('active','invited')
    and public.membership_roles_incompatible(
      new.role,
      m.role
    )
  limit 1;

  if v_conflicting_role is not null then
    raise exception
      'Segregation of duties blocked: role % is incompatible with existing role % in this tenant.',
      new.role,
      v_conflicting_role;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_membership_segregation
on public.memberships;

create trigger trg_membership_segregation
before insert or update of user_id, tenant_id, role, status
on public.memberships
for each row
execute function public.enforce_membership_segregation();


-- ============================================================
-- 3. LIVE SEGREGATION / CONFLICT FINDINGS
-- ============================================================

create or replace function public.segregation_duty_findings(
  p_tenant_id uuid
)
returns table (
  finding_key text,
  subject_user_id uuid,
  subject_label text,
  finding_type text,
  severity text,
  detail text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not (
    public.is_platform_admin()
    or public.has_tenant_role(
      p_tenant_id,
      array['festival_owner']
    )
  ) then
    raise exception
      'Permission denied: segregation control access required.';
  end if;

  return query

  -- Existing incompatible membership combinations.
  with role_sets as (
    select
      m.user_id,
      array_agg(distinct m.role order by m.role) as roles
    from public.memberships m
    where m.tenant_id = p_tenant_id
      and m.status in ('active','invited')
    group by m.user_id
  )
  select
    ('role:' || rs.user_id::text)::text,
    rs.user_id,
    coalesce(u.email::text, rs.user_id::text),
    'INCOMPATIBLE_ROLES'::text,
    'HIGH'::text,
    (
      'Concurrent tenant roles require segregation review: '
      || array_to_string(rs.roles, ', ')
    )::text
  from role_sets rs
  left join auth.users u
    on u.id = rs.user_id
  where exists (
    select 1
    from unnest(rs.roles) role_a
    cross join unnest(rs.roles) role_b
    where role_a < role_b
      and public.membership_roles_incompatible(
        role_a,
        role_b
      )
  )

  union all

  -- Existing jury conflict / recusal / blocking states.
  select
    ('jury:' || pm.id::text)::text,
    pm.auth_user_id,
    coalesce(
      u.email::text,
      pm.display_label,
      pm.id::text
    ),
    'JURY_CONFLICT'::text,
    case
      when pm.conflict_status = 'blocked'
        then 'CRITICAL'
      when pm.conflict_status = 'recused'
        then 'HIGH'
      else 'MEDIUM'
    end::text,
    (
      'Jury panel conflict status: '
      || upper(pm.conflict_status)
      || ' · panel status: '
      || upper(pm.status)
    )::text
  from public.jury_panel_members pm
  left join auth.users u
    on u.id = pm.auth_user_id
  where pm.tenant_id = p_tenant_id
    and pm.conflict_status <> 'clear'

  order by severity desc, subject_label;
end;
$$;

revoke all
on function public.segregation_duty_findings(uuid)
from public;

grant execute
on function public.segregation_duty_findings(uuid)
to authenticated;


-- ============================================================
-- 4. AUDITABLE CONTROL REVIEW
-- ============================================================

create or replace function public.record_segregation_control_review(
  p_tenant_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not (
    public.is_platform_admin()
    or public.has_tenant_role(
      p_tenant_id,
      array['festival_owner']
    )
  ) then
    raise exception
      'Permission denied: segregation control access required.';
  end if;

  select count(*)
  into v_count
  from public.segregation_duty_findings(p_tenant_id);

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
    'access.segregation_control_reviewed',
    'tenant',
    p_tenant_id,
    jsonb_build_object(
      'finding_count', v_count,
      'control', 'segregation_of_duties'
    ),
    now()
  );

  return v_count;
end;
$$;

revoke all
on function public.record_segregation_control_review(uuid)
from public;

grant execute
on function public.record_segregation_control_review(uuid)
to authenticated;
