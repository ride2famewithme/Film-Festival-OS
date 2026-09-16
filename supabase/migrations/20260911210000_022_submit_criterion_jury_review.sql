-- Film Festival OS™
-- Migration 022 — Submit Criterion Jury Review
-- Database-authoritative finalization of criterion-based jury scoring.

create or replace function public.submit_criterion_jury_review(
  p_review_id uuid,
  p_recommendation text,
  p_notes text
)
returns public.jury_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.jury_reviews%rowtype;

  v_tenant_id uuid;
  v_assignment_id uuid;
  v_submission_id uuid;
  v_scoring_form_id uuid;

  v_assignment_status text;
  v_conflict_status text;
  v_form_status text;

  v_recommendation_required boolean;
  v_overall_comment_required boolean;

  v_criterion_count integer := 0;
  v_score_count integer := 0;
  v_missing_comments integer := 0;

  v_total_weight numeric := 0;
  v_final_score numeric := 0;
begin

  -- ----------------------------------------------------------
  -- 1. Load and verify the juror's own draft review.
  -- ----------------------------------------------------------

  select
    r.tenant_id,
    r.assignment_id,
    r.submission_id,
    a.scoring_form_id,
    a.status,
    a.conflict_status,
    f.status,
    f.recommendation_required,
    f.overall_comment_required
  into
    v_tenant_id,
    v_assignment_id,
    v_submission_id,
    v_scoring_form_id,
    v_assignment_status,
    v_conflict_status,
    v_form_status,
    v_recommendation_required,
    v_overall_comment_required
  from public.jury_reviews r
  join public.jury_assignments a
    on a.id = r.assignment_id
  join public.jury_scoring_forms f
    on f.id = a.scoring_form_id
  where r.id = p_review_id
    and r.juror_user_id = auth.uid()
    and a.juror_user_id = auth.uid()
    and a.tenant_id = r.tenant_id;

  if not found then
    raise exception
      'Draft jury review or assigned scoring form not found.';
  end if;


  select *
  into v_review
  from public.jury_reviews
  where id = p_review_id;

  if v_review.status <> 'draft' then
    raise exception
      'Only a draft jury review may be submitted.';
  end if;


  if not public.is_tenant_member(v_tenant_id) then
    raise exception
      'Jury review blocked: tenant membership is not active.';
  end if;


  if v_assignment_status <> 'assigned' then
    raise exception
      'Jury review blocked: assignment is not active.';
  end if;


  if coalesce(v_conflict_status, 'clear') <> 'clear' then
    raise exception
      'Jury review blocked: conflict or recusal status is not clear.';
  end if;


  if v_form_status <> 'active' then
    raise exception
      'Jury review blocked: assigned scoring form is not active.';
  end if;


  -- ----------------------------------------------------------
  -- 2. Validate scoring form completeness.
  -- ----------------------------------------------------------

  select
    count(*)::integer,
    coalesce(sum(weight_percent), 0)
  into
    v_criterion_count,
    v_total_weight
  from public.jury_scoring_criteria
  where form_id = v_scoring_form_id
    and tenant_id = v_tenant_id;


  if v_criterion_count < 1 then
    raise exception
      'Cannot submit review: scoring form has no criteria.';
  end if;


  if v_total_weight <> 100 then
    raise exception
      'Cannot submit review: scoring criteria must total exactly 100 percent.';
  end if;


  -- ----------------------------------------------------------
  -- 3. Every criterion must have exactly one saved score.
  -- ----------------------------------------------------------

  select count(*)::integer
  into v_score_count
  from public.jury_review_criterion_scores s
  where s.review_id = p_review_id
    and s.assignment_id = v_assignment_id
    and s.scoring_form_id = v_scoring_form_id
    and s.tenant_id = v_tenant_id
    and s.juror_user_id = auth.uid();


  if v_score_count <> v_criterion_count then
    raise exception
      'Cannot submit review: every scoring criterion must be completed.';
  end if;


  -- ----------------------------------------------------------
  -- 4. Enforce criterion comments where required.
  -- ----------------------------------------------------------

  select count(*)::integer
  into v_missing_comments
  from public.jury_scoring_criteria c
  left join public.jury_review_criterion_scores s
    on s.criterion_id = c.id
   and s.review_id = p_review_id
  where c.form_id = v_scoring_form_id
    and c.tenant_id = v_tenant_id
    and c.comment_required = true
    and nullif(btrim(coalesce(s.criterion_comment, '')), '') is null;


  if v_missing_comments > 0 then
    raise exception
      'Cannot submit review: required criterion comments are missing.';
  end if;


  -- ----------------------------------------------------------
  -- 5. Enforce form-level recommendation / overall comment.
  -- ----------------------------------------------------------

  if v_recommendation_required
     and nullif(btrim(coalesce(p_recommendation, '')), '') is null then
    raise exception
      'Cannot submit review: recommendation is required.';
  end if;


  if v_overall_comment_required
     and nullif(btrim(coalesce(p_notes, '')), '') is null then
    raise exception
      'Cannot submit review: overall comment is required.';
  end if;


  -- ----------------------------------------------------------
  -- 6. Calculate official 0–100 review score in the database.
  -- ----------------------------------------------------------

  select
    round(coalesce(sum(weighted_contribution), 0), 2)
  into
    v_final_score
  from public.jury_review_criterion_scores
  where review_id = p_review_id
    and assignment_id = v_assignment_id
    and scoring_form_id = v_scoring_form_id
    and tenant_id = v_tenant_id
    and juror_user_id = auth.uid();


  if v_final_score < 0 or v_final_score > 100 then
    raise exception
      'Calculated jury review score is outside the permitted 0–100 range.';
  end if;


  -- ----------------------------------------------------------
  -- 7. Submit review.
  -- Existing jury-review triggers refresh weighted results.
  -- ----------------------------------------------------------

  update public.jury_reviews
  set
    score = v_final_score,
    recommendation = nullif(btrim(coalesce(p_recommendation, '')), ''),
    notes = nullif(btrim(coalesce(p_notes, '')), ''),
    status = 'submitted',
    submitted_at = now()
  where id = p_review_id
    and juror_user_id = auth.uid()
  returning *
  into v_review;


  -- ----------------------------------------------------------
  -- 8. Complete the assignment.
  -- Existing assignment trigger refreshes weighted results again.
  -- ----------------------------------------------------------

  update public.jury_assignments
  set status = 'completed'
  where id = v_assignment_id
    and tenant_id = v_tenant_id
    and juror_user_id = auth.uid();


  return v_review;
end;
$$;


grant execute
on function public.submit_criterion_jury_review(uuid,text,text)
to authenticated;
