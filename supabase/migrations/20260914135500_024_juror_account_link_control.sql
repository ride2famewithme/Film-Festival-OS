-- Film Festival OS™
-- Migration 024 — Juror Account Link Control
-- Securely links real tenant juror memberships to confidential panel seats.

-- ============================================================
-- 1. LIST REAL JUROR MEMBERSHIPS FOR THIS TENANT
-- ============================================================

create or replace function
public.jury_member_candidates(p_tenant_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  membership_status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.has_tenant_role(
    p_tenant_id,
    array['platform_admin','festival_owner']
  ) then
    raise exception
      'Permission denied: jury management access required.';
  end if;

  return query
  select
    m.id,
    m.user_id,
    u.email::text,
    m.status
  from public.memberships m
  join auth.users u
    on u.id = m.user_id
  where m.tenant_id = p_tenant_id
    and m.role = 'juror'
    and m.status in ('invited','active')
  order by u.email;
end;
$$;

revoke all
on function public.jury_member_candidates(uuid)
from public;

grant execute
on function public.jury_member_candidates(uuid)
to authenticated;


-- ============================================================
-- 2. LINK JUROR ACCOUNT TO CONFIDENTIAL PANEL SEAT
-- ============================================================

create or replace function
public.link_jury_panel_member_account(
  p_panel_member_id uuid,
  p_user_id uuid
)
returns public.jury_panel_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_panel public.jury_panel_members%rowtype;
  v_result public.jury_panel_members%rowtype;
begin
  select *
  into v_panel
  from public.jury_panel_members
  where id = p_panel_member_id;

  if not found then
    raise exception 'Jury panel member not found.';
  end if;

  if not public.has_tenant_role(
    v_panel.tenant_id,
    array['platform_admin','festival_owner']
  ) then
    raise exception
      'Permission denied: jury management access required.';
  end if;

  if v_panel.status not in ('invited','active') then
    raise exception
      'This jury panel seat cannot be linked in its current status.';
  end if;

  if v_panel.conflict_status <> 'clear' then
    raise exception
      'Conflicted, recused or blocked panel seats cannot be linked.';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.tenant_id = v_panel.tenant_id
      and m.user_id = p_user_id
      and m.role = 'juror'
      and m.status in ('invited','active')
  ) then
    raise exception
      'Selected account does not have an eligible juror membership.';
  end if;

  if exists (
    select 1
    from public.jury_panel_members pm
    where pm.tenant_id = v_panel.tenant_id
      and pm.auth_user_id = p_user_id
      and pm.id <> p_panel_member_id
  ) then
    raise exception
      'This juror account is already linked to another panel seat.';
  end if;

  update public.jury_panel_members
  set
    auth_user_id = p_user_id,
    updated_at = now()
  where id = p_panel_member_id
  returning *
  into v_result;

  return v_result;
end;
$$;

revoke all
on function public.link_jury_panel_member_account(uuid,uuid)
from public;

grant execute
on function public.link_jury_panel_member_account(uuid,uuid)
to authenticated;
