-- Film Festival OS™
-- Migration 015 — Jury Scoring & Weighted Results
-- Reconstructed from verified live implementation
-- 07–08 Sep 2026

-- ============================================================
-- 1. DUPLICATE PROTECTION
-- ============================================================

create unique index if not exists
jury_assignments_submission_juror_uidx
on public.jury_assignments(submission_id, juror_user_id);

create unique index if not exists
jury_reviews_assignment_uidx
on public.jury_reviews(assignment_id);


-- ============================================================
-- 2. WEIGHTED RESULT REGISTER
-- ============================================================

create table if not exists public.jury_submission_results (
  submission_id uuid primary key
    references public.submissions(id) on delete cascade,

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  weighted_score numeric(6,2),

  participating_weight_percent numeric(6,2)
    not null default 0,

  review_count integer
    not null default 0,

  calculation_status text
    not null default 'provisional'
    check (calculation_status in ('provisional','locked')),

  calculated_at timestamptz
    not null default now(),

  locked_at timestamptz,

  locked_by uuid
    references auth.users(id) on delete set null
);


alter table public.jury_submission_results
enable row level security;


drop policy if exists jury_results_manager_all
on public.jury_submission_results;

create policy jury_results_manager_all
on public.jury_submission_results
for all
using (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner']
  )
)
with check (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner']
  )
);


drop policy if exists jury_results_member_read
on public.jury_submission_results;

create policy jury_results_member_read
on public.jury_submission_results
for select
using (
  public.has_tenant_role(
    tenant_id,
    array[
      'platform_admin',
      'festival_owner',
      'festival_staff',
      'juror'
    ]
  )
);


grant select, insert, update
on table public.jury_submission_results
to authenticated;


-- ============================================================
-- 3. CALCULATE / REFRESH WEIGHTED RESULT
-- ============================================================

create or replace function
public.refresh_jury_submission_result(
  p_submission_id uuid
)
returns public.jury_submission_results
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;

  v_weighted_score numeric(6,2);

  v_participating_weight numeric(6,2);

  v_review_count integer;

  v_result public.jury_submission_results%rowtype;
begin

  select tenant_id
  into v_tenant_id
  from public.submissions
  where id = p_submission_id;

  if v_tenant_id is null then
    raise exception 'Submission not found.';
  end if;


  select *
  into v_result
  from public.jury_submission_results
  where submission_id = p_submission_id;

  if found
     and v_result.calculation_status = 'locked' then
    return v_result;
  end if;


  select
    round(
      (
        sum(
          coalesce(
            nullif(to_jsonb(r)->>'score','')::numeric,
            0
          )
          *
          coalesce(
            nullif(
              to_jsonb(a)->>'weight_percent_snapshot',
              ''
            )::numeric,
            nullif(
              to_jsonb(a)->>'weight_percent',
              ''
            )::numeric,
            0
          )
        )
        /
        nullif(
          sum(
            coalesce(
              nullif(
                to_jsonb(a)->>'weight_percent_snapshot',
                ''
              )::numeric,
              nullif(
                to_jsonb(a)->>'weight_percent',
                ''
              )::numeric,
              0
            )
          ),
          0
        )
      ),
      2
    ),

    round(
      sum(
        coalesce(
          nullif(
            to_jsonb(a)->>'weight_percent_snapshot',
            ''
          )::numeric,
          nullif(
            to_jsonb(a)->>'weight_percent',
            ''
          )::numeric,
          0
        )
      ),
      2
    ),

    count(*)::integer

  into
    v_weighted_score,
    v_participating_weight,
    v_review_count

  from public.jury_reviews r

  join public.jury_assignments a
    on a.id = r.assignment_id

  where a.submission_id = p_submission_id

    and coalesce(
          to_jsonb(a)->>'conflict_status',
          'clear'
        ) = 'clear'

    and coalesce(
          to_jsonb(a)->>'status',
          'assigned'
        ) in ('assigned','completed')

    and coalesce(
          to_jsonb(r)->>'status',
          to_jsonb(r)->>'review_status',
          ''
        ) in ('submitted','reviewed');


  v_participating_weight :=
    coalesce(v_participating_weight,0);

  v_review_count :=
    coalesce(v_review_count,0);


  insert into public.jury_submission_results (
    submission_id,
    tenant_id,
    weighted_score,
    participating_weight_percent,
    review_count,
    calculation_status,
    calculated_at
  )
  values (
    p_submission_id,
    v_tenant_id,
    v_weighted_score,
    v_participating_weight,
    v_review_count,
    'provisional',
    now()
  )

  on conflict (submission_id)
  do update set

    tenant_id =
      excluded.tenant_id,

    weighted_score =
      excluded.weighted_score,

    participating_weight_percent =
      excluded.participating_weight_percent,

    review_count =
      excluded.review_count,

    calculated_at =
      now()

  where
    public.jury_submission_results.calculation_status
      <> 'locked';


  select *
  into v_result
  from public.jury_submission_results
  where submission_id = p_submission_id;

  return v_result;

end;
$$;


-- ============================================================
-- 4. REVIEW CHANGES AUTOMATICALLY REFRESH RESULTS
-- ============================================================

create or replace function
public.refresh_result_from_jury_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment_id uuid;

  v_submission_id uuid;
begin

  v_assignment_id :=
    coalesce(new.assignment_id, old.assignment_id);

  select submission_id
  into v_submission_id
  from public.jury_assignments
  where id = v_assignment_id;

  if v_submission_id is not null then
    perform
      public.refresh_jury_submission_result(
        v_submission_id
      );
  end if;

  return coalesce(new, old);

end;
$$;


drop trigger if exists
trg_refresh_jury_result_from_review
on public.jury_reviews;

create trigger
trg_refresh_jury_result_from_review
after insert or update or delete
on public.jury_reviews
for each row
execute function
public.refresh_result_from_jury_review();


-- ============================================================
-- 5. ASSIGNMENT CHANGES REFRESH RESULTS
-- ============================================================

create or replace function
public.refresh_result_from_jury_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  perform
    public.refresh_jury_submission_result(
      coalesce(new.submission_id,old.submission_id)
    );

  return coalesce(new,old);

end;
$$;


drop trigger if exists
trg_refresh_jury_result_from_assignment
on public.jury_assignments;

create trigger
trg_refresh_jury_result_from_assignment
after update of
  status,
  conflict_status,
  weight_percent_snapshot
on public.jury_assignments
for each row
execute function
public.refresh_result_from_jury_assignment();


-- ============================================================
-- 6. LOCKED RESULTS CANNOT BE ALTERED BY REVIEW CHANGES
-- ============================================================

create or replace function
public.prevent_locked_jury_review_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment_id uuid;

  v_submission_id uuid;
begin

  v_assignment_id :=
    coalesce(new.assignment_id,old.assignment_id);

  select submission_id
  into v_submission_id
  from public.jury_assignments
  where id = v_assignment_id;


  if exists (
    select 1
    from public.jury_submission_results
    where submission_id = v_submission_id
      and calculation_status = 'locked'
  ) then

    raise exception
      'Jury review blocked: final jury result is locked.';

  end if;

  return coalesce(new,old);

end;
$$;


drop trigger if exists
trg_prevent_locked_jury_review_change
on public.jury_reviews;

create trigger
trg_prevent_locked_jury_review_change
before insert or update or delete
on public.jury_reviews
for each row
execute function
public.prevent_locked_jury_review_change();


-- ============================================================
-- 7. LOCK FINAL JURY RESULT
-- ============================================================

create or replace function
public.lock_jury_submission_result(
  p_submission_id uuid
)
returns public.jury_submission_results
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;

  v_result public.jury_submission_results%rowtype;
begin

  select tenant_id
  into v_tenant_id
  from public.submissions
  where id = p_submission_id;

  if v_tenant_id is null then
    raise exception 'Submission not found.';
  end if;


  if not public.has_tenant_role(
    v_tenant_id,
    array['platform_admin','festival_owner']
  ) then

    raise exception
      'Permission denied: only Festival Owner or Platform Admin may lock jury results.';

  end if;


  if exists (
    select 1
    from public.jury_assignments a
    where a.submission_id = p_submission_id

      and coalesce(
            to_jsonb(a)->>'conflict_status',
            'clear'
          ) = 'clear'

      and coalesce(
            to_jsonb(a)->>'status',
            'assigned'
          ) <> 'completed'
  ) then

    raise exception
      'Cannot lock result: clear jury assignments remain incomplete.';

  end if;


  perform
    public.refresh_jury_submission_result(
      p_submission_id
    );


  select *
  into v_result
  from public.jury_submission_results
  where submission_id = p_submission_id;


  if v_result.review_count < 1 then
    raise exception
      'Cannot lock result: no submitted jury reviews.';
  end if;


  update public.jury_submission_results
  set
    calculation_status = 'locked',
    locked_at = now(),
    locked_by = auth.uid(),
    calculated_at = now()
  where submission_id = p_submission_id;


  select *
  into v_result
  from public.jury_submission_results
  where submission_id = p_submission_id;


  return v_result;

end;
$$;


grant execute
on function
public.refresh_jury_submission_result(uuid)
to authenticated;

grant execute
on function
public.lock_jury_submission_result(uuid)
to authenticated;

