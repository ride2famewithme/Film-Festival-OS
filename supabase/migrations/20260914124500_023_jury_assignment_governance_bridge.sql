-- Film Festival OS™
-- Migration 023 — Jury Assignment Governance Bridge
-- 14 Sep 2026

-- ============================================================
-- 1. AUTO-LINK JURY ASSIGNMENT TO GOVERNED PANEL MEMBER
-- ============================================================

create or replace function
public.apply_jury_assignment_governance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pm public.jury_panel_members%rowtype;
begin
  select *
  into pm
  from public.jury_panel_members
  where tenant_id = new.tenant_id
    and auth_user_id = new.juror_user_id
  limit 1;

  if not found then
    raise exception
      'Jury assignment blocked: juror is not registered on this festival jury panel.';
  end if;

  if pm.status not in ('invited','active') then
    raise exception
      'Jury assignment blocked: panel member is not eligible for assignment.';
  end if;

  if pm.conflict_status <> 'clear' then
    raise exception
      'Jury assignment blocked: panel member has a conflict or recusal status.';
  end if;

  new.panel_member_id := pm.id;
  new.weight_percent_snapshot := pm.weight_percent;

  new.confidentiality_status :=
    case pm.identity_visibility
      when 'reveal_after_awards' then 'reveal_after_awards'
      when 'public' then 'released'
      else 'confidential'
    end;

  new.conflict_status := pm.conflict_status;

  return new;
end;
$$;

drop trigger if exists
trg_apply_jury_assignment_governance
on public.jury_assignments;

create trigger
trg_apply_jury_assignment_governance
before insert or update of tenant_id, juror_user_id
on public.jury_assignments
for each row
execute function public.apply_jury_assignment_governance();


-- ============================================================
-- 2. BACKFILL EXISTING ASSIGNMENTS
-- ============================================================

update public.jury_assignments a
set
  panel_member_id = pm.id,
  weight_percent_snapshot =
    coalesce(a.weight_percent_snapshot, pm.weight_percent),
  confidentiality_status =
    case pm.identity_visibility
      when 'reveal_after_awards' then 'reveal_after_awards'
      when 'public' then 'released'
      else 'confidential'
    end,
  conflict_status =
    case
      when a.conflict_status = 'clear'
        then pm.conflict_status
      else a.conflict_status
    end
from public.jury_panel_members pm
where pm.tenant_id = a.tenant_id
  and pm.auth_user_id = a.juror_user_id;


-- ============================================================
-- 3. PANEL RECUSAL / CONFLICT -> ASSIGNMENT SYNC
-- ============================================================

create or replace function
public.sync_jury_panel_governance_to_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflict text;
  v_confidentiality text;
begin
  v_conflict :=
    case
      when new.status = 'recused' then 'recused'
      when new.status = 'removed' then 'blocked'
      else new.conflict_status
    end;

  v_confidentiality :=
    case new.identity_visibility
      when 'reveal_after_awards' then 'reveal_after_awards'
      when 'public' then 'released'
      else 'confidential'
    end;

  update public.jury_assignments
  set
    conflict_status = v_conflict,
    confidentiality_status = v_confidentiality
  where tenant_id = new.tenant_id
    and panel_member_id = new.id;

  return new;
end;
$$;

drop trigger if exists
trg_sync_jury_panel_governance
on public.jury_panel_members;

create trigger
trg_sync_jury_panel_governance
after update of status, conflict_status, identity_visibility
on public.jury_panel_members
for each row
execute function
public.sync_jury_panel_governance_to_assignments();


-- ============================================================
-- 4. BLOCK REVIEWS FROM CONFLICTED / RECUSED ASSIGNMENTS
-- ============================================================

create or replace function
public.prevent_conflicted_jury_review_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflict text;
begin
  select conflict_status
  into v_conflict
  from public.jury_assignments
  where id = new.assignment_id;

  if coalesce(v_conflict,'blocked') <> 'clear' then
    raise exception
      'Jury review blocked: assignment is conflicted, recused or blocked.';
  end if;

  return new;
end;
$$;

drop trigger if exists
trg_prevent_conflicted_jury_review_write
on public.jury_reviews;

create trigger
trg_prevent_conflicted_jury_review_write
before insert or update
on public.jury_reviews
for each row
execute function
public.prevent_conflicted_jury_review_write();


drop trigger if exists
trg_prevent_conflicted_criterion_score_write
on public.jury_review_criterion_scores;

create trigger
trg_prevent_conflicted_criterion_score_write
before insert or update
on public.jury_review_criterion_scores
for each row
execute function
public.prevent_conflicted_jury_review_write();
