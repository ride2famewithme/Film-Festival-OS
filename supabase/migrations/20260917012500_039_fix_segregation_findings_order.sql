-- Film Festival OS™
-- Migration 039
-- Fix UNION result ordering in segregation_duty_findings()

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

  with role_sets as (
    select
      m.user_id,
      array_agg(distinct m.role order by m.role) as roles
    from public.memberships m
    where m.tenant_id = p_tenant_id
      and m.status in ('active','invited')
    group by m.user_id
  ),

  findings as (

    select
      ('role:' || rs.user_id::text)::text
        as finding_key,

      rs.user_id::uuid
        as subject_user_id,

      coalesce(
        u.email::text,
        rs.user_id::text
      )::text
        as subject_label,

      'INCOMPATIBLE_ROLES'::text
        as finding_type,

      'HIGH'::text
        as severity,

      (
        'Concurrent tenant roles require segregation review: '
        || array_to_string(rs.roles, ', ')
      )::text
        as detail

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

    select
      ('jury:' || pm.id::text)::text,
      pm.auth_user_id::uuid,

      coalesce(
        u.email::text,
        pm.display_label,
        pm.id::text
      )::text,

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
  )

  select
    f.finding_key,
    f.subject_user_id,
    f.subject_label,
    f.finding_type,
    f.severity,
    f.detail
  from findings f

  order by
    case f.severity
      when 'CRITICAL' then 4
      when 'HIGH' then 3
      when 'MEDIUM' then 2
      else 1
    end desc,
    f.subject_label;
end;
$$;

revoke all
on function public.segregation_duty_findings(uuid)
from public;

grant execute
on function public.segregation_duty_findings(uuid)
to authenticated;
