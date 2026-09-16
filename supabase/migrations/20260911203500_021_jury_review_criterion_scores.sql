-- Film Festival OS™
-- Migration 021 — Jury Review Criterion Scores
-- Criterion-level judging foundation beneath existing jury_reviews.score.

create table if not exists public.jury_review_criterion_scores (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  review_id uuid not null
    references public.jury_reviews(id) on delete cascade,

  assignment_id uuid not null
    references public.jury_assignments(id) on delete cascade,

  scoring_form_id uuid not null
    references public.jury_scoring_forms(id) on delete restrict,

  criterion_id uuid not null
    references public.jury_scoring_criteria(id) on delete restrict,

  juror_user_id uuid not null
    references auth.users(id),

  raw_score numeric not null,

  score_min_snapshot numeric not null,
  score_max_snapshot numeric not null,

  weight_percent_snapshot numeric not null
    check (
      weight_percent_snapshot > 0
      and weight_percent_snapshot <= 100
    ),

  normalized_score numeric(6,2)
    check (
      normalized_score >= 0
      and normalized_score <= 100
    ),

  weighted_contribution numeric(8,4)
    check (
      weighted_contribution >= 0
      and weighted_contribution <= 100
    ),

  criterion_comment text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (score_max_snapshot > score_min_snapshot),

  check (
    raw_score >= score_min_snapshot
    and raw_score <= score_max_snapshot
  ),

  unique (review_id, criterion_id)
);


create index if not exists
jury_review_criterion_scores_review_idx
on public.jury_review_criterion_scores(review_id);


create index if not exists
jury_review_criterion_scores_assignment_idx
on public.jury_review_criterion_scores(assignment_id);


create index if not exists
jury_review_criterion_scores_form_idx
on public.jury_review_criterion_scores(scoring_form_id);



-- ============================================================
-- HARD CONTROL
-- Criterion scores may only change while the parent review
-- remains DRAFT. Identity/snapshot fields are derived from
-- authoritative database records, not trusted from the client.
-- ============================================================

create or replace function
public.enforce_jury_review_criterion_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review_status text;
  v_tenant_id uuid;
  v_assignment_id uuid;
  v_juror_user_id uuid;
  v_scoring_form_id uuid;

  v_criterion_form_id uuid;
  v_criterion_tenant_id uuid;
  v_score_min numeric;
  v_score_max numeric;
  v_weight_percent numeric;
begin

  -- DELETE: only permitted while parent review is still draft.
  if tg_op = 'DELETE' then

    select status
    into v_review_status
    from public.jury_reviews
    where id = old.review_id;

    if not found then
      raise exception 'Parent jury review does not exist.';
    end if;

    if v_review_status <> 'draft' then
      raise exception
        'Criterion scores cannot be deleted after the jury review is submitted.';
    end if;

    return old;
  end if;


  -- INSERT / UPDATE: load authoritative parent review identity.
  select
    tenant_id,
    assignment_id,
    juror_user_id,
    status
  into
    v_tenant_id,
    v_assignment_id,
    v_juror_user_id,
    v_review_status
  from public.jury_reviews
  where id = new.review_id;

  if not found then
    raise exception 'Parent jury review does not exist.';
  end if;

  if v_review_status <> 'draft' then
    raise exception
      'Criterion scores cannot be changed after the jury review is submitted.';
  end if;


  -- Criterion identity itself cannot be swapped during UPDATE.
  if tg_op = 'UPDATE' then
    if new.review_id is distinct from old.review_id
       or new.criterion_id is distinct from old.criterion_id then
      raise exception
        'Review and criterion identity cannot be changed.';
    end if;
  end if;


  -- Assignment determines the official scoring form.
  select scoring_form_id
  into v_scoring_form_id
  from public.jury_assignments
  where id = v_assignment_id
    and tenant_id = v_tenant_id
    and juror_user_id = v_juror_user_id;

  if not found then
    raise exception 'Matching jury assignment does not exist.';
  end if;

  if v_scoring_form_id is null then
    raise exception
      'Jury assignment has no scoring form.';
  end if;


  -- Criterion must belong to that exact scoring form.
  select
    form_id,
    tenant_id,
    score_min,
    score_max,
    weight_percent
  into
    v_criterion_form_id,
    v_criterion_tenant_id,
    v_score_min,
    v_score_max,
    v_weight_percent
  from public.jury_scoring_criteria
  where id = new.criterion_id;

  if not found then
    raise exception 'Scoring criterion does not exist.';
  end if;

  if v_criterion_form_id <> v_scoring_form_id then
    raise exception
      'Criterion does not belong to the assigned scoring form.';
  end if;

  if v_criterion_tenant_id <> v_tenant_id then
    raise exception
      'Criterion tenant does not match jury review tenant.';
  end if;


  -- Juror cannot manipulate identity or snapshot values.
  new.tenant_id := v_tenant_id;
  new.assignment_id := v_assignment_id;
  new.scoring_form_id := v_scoring_form_id;
  new.juror_user_id := v_juror_user_id;

  new.score_min_snapshot := v_score_min;
  new.score_max_snapshot := v_score_max;
  new.weight_percent_snapshot := v_weight_percent;


  if new.raw_score < v_score_min
     or new.raw_score > v_score_max then
    raise exception
      'Criterion score is outside the permitted scoring range.';
  end if;


  -- Normalize every criterion to 0–100.
  new.normalized_score :=
    round(
      (
        (new.raw_score - v_score_min)
        /
        (v_score_max - v_score_min)
      ) * 100,
      2
    );

  -- Contribution to the final review score.
  new.weighted_contribution :=
    round(
      new.normalized_score
      * v_weight_percent
      / 100,
      4
    );

  new.updated_at := now();

  return new;
end;
$$;


drop trigger if exists
trg_enforce_jury_review_criterion_score
on public.jury_review_criterion_scores;

create trigger
trg_enforce_jury_review_criterion_score
before insert or update or delete
on public.jury_review_criterion_scores
for each row
execute function
public.enforce_jury_review_criterion_score();


alter table public.jury_review_criterion_scores
enable row level security;


drop policy if exists
jury_review_criterion_scores_juror_all
on public.jury_review_criterion_scores;

create policy
jury_review_criterion_scores_juror_all
on public.jury_review_criterion_scores
for all
using (
  juror_user_id = auth.uid()
  and public.is_tenant_member(tenant_id)
)
with check (
  juror_user_id = auth.uid()
  and public.is_tenant_member(tenant_id)
);


drop policy if exists
jury_review_criterion_scores_manager_read
on public.jury_review_criterion_scores;

create policy
jury_review_criterion_scores_manager_read
on public.jury_review_criterion_scores
for select
using (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner']
  )
);


grant select, insert, update, delete
on table public.jury_review_criterion_scores
to authenticated;
