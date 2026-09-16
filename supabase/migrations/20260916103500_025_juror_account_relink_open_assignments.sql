-- Film Festival OS™
-- Migration 025 — Juror Account Relink / Open Assignment Sync
-- 16 Sep 2026
--
-- When a confidential jury panel seat is corrected/relinked to another
-- eligible juror account, transfer only OPEN assignments that have not
-- started a review. Historical/completed jury records are never rewritten.

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
  v_old_user_id uuid;
begin
  select *
  into v_panel
  from public.jury_panel_members
  where id = p_panel_member_id
  for update;

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

  v_old_user_id := v_panel.auth_user_id;

  -- Never transfer an assignment after a review/draft has started.
  if v_old_user_id is distinct from p_user_id
     and exists (
       select 1
       from public.jury_assignments a
       join public.jury_reviews r
         on r.assignment_id = a.id
       where a.tenant_id = v_panel.tenant_id
         and a.panel_member_id = p_panel_member_id
         and a.status = 'assigned'
     ) then
    raise exception
      'Juror account cannot be changed because an open assignment already has review activity.';
  end if;

  -- Prevent collision with an assignment already belonging to new juror.
  if v_old_user_id is distinct from p_user_id
     and exists (
       select 1
       from public.jury_assignments a
       join public.jury_assignments other_a
         on other_a.submission_id = a.submission_id
        and other_a.juror_user_id = p_user_id
        and other_a.id <> a.id
       where a.tenant_id = v_panel.tenant_id
         and a.panel_member_id = p_panel_member_id
         and a.status = 'assigned'
     ) then
    raise exception
      'Juror account cannot be changed because the new account already has an assignment for this submission.';
  end if;

  update public.jury_panel_members
  set
    auth_user_id = p_user_id,
    updated_at = now()
  where id = p_panel_member_id
  returning *
  into v_result;

  -- Transfer ONLY open/unreviewed assignments.
  -- Migration 023 governance trigger re-validates the new juror and
  -- refreshes panel_member_id, weight snapshot and confidentiality state.
  if v_old_user_id is distinct from p_user_id then
    update public.jury_assignments
    set juror_user_id = p_user_id
    where tenant_id = v_panel.tenant_id
      and panel_member_id = p_panel_member_id
      and status = 'assigned';
  end if;

  return v_result;
end;
$$;

revoke all
on function public.link_jury_panel_member_account(uuid,uuid)
from public;

grant execute
on function public.link_jury_panel_member_account(uuid,uuid)
to authenticated;
