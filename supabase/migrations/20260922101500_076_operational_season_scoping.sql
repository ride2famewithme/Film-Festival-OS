-- Migration 076 — Operational Season Scoping
-- Film Festival OS™
--
-- Adds season ownership to the operational competition chain:
-- Submission -> Payment -> Jury Assignment -> Jury Review
-- -> Award -> Laurel / Digital Award
--
-- Existing records are preserved and backfilled.
-- Columns remain nullable temporarily while app workflows are upgraded.

begin;

-- ---------------------------------------------------------
-- 1. ADD SEASON REFERENCES
-- ---------------------------------------------------------

alter table public.submissions
  add column if not exists season_id uuid
  references public.festival_seasons(id) on delete restrict;

alter table public.submission_payments
  add column if not exists season_id uuid
  references public.festival_seasons(id) on delete restrict;

alter table public.jury_assignments
  add column if not exists season_id uuid
  references public.festival_seasons(id) on delete restrict;

alter table public.jury_reviews
  add column if not exists season_id uuid
  references public.festival_seasons(id) on delete restrict;

alter table public.awards
  add column if not exists season_id uuid
  references public.festival_seasons(id) on delete restrict;

alter table public.laurel_outputs
  add column if not exists season_id uuid
  references public.festival_seasons(id) on delete restrict;


-- ---------------------------------------------------------
-- 2. BACKFILL SUBMISSIONS
--
-- Prefer the season of the submission's payment/category.
-- If unavailable, use the tenant's earliest known season.
-- This protects legacy records created before season scoping.
-- ---------------------------------------------------------

update public.submissions s
set season_id = coalesce(
  (
    select fc.season_id
    from public.submission_payments sp
    join public.festival_categories fc
      on fc.id = sp.category_id
     and fc.tenant_id = sp.tenant_id
    where sp.submission_id = s.id
      and sp.tenant_id = s.tenant_id
      and fc.season_id is not null
    order by sp.updated_at desc
    limit 1
  ),
  (
    select fs.id
    from public.festival_seasons fs
    where fs.tenant_id = s.tenant_id
    order by fs.updated_at asc, fs.label asc
    limit 1
  )
)
where s.season_id is null;


-- ---------------------------------------------------------
-- 3. PROPAGATE SUBMISSION SEASON THROUGH OPERATIONS
-- ---------------------------------------------------------

update public.submission_payments sp
set season_id = s.season_id
from public.submissions s
where sp.submission_id = s.id
  and sp.tenant_id = s.tenant_id
  and sp.season_id is null
  and s.season_id is not null;

update public.jury_assignments ja
set season_id = s.season_id
from public.submissions s
where ja.submission_id = s.id
  and ja.tenant_id = s.tenant_id
  and ja.season_id is null
  and s.season_id is not null;

-- Historical jury reviews are intentionally NOT backfilled here.
-- Locked jury results must remain immutable.
-- Their season remains derivable through submission_id.
-- New reviews will receive season_id from application workflows.

update public.awards a
set season_id = s.season_id
from public.submissions s
where a.submission_id = s.id
  and a.tenant_id = s.tenant_id
  and a.season_id is null
  and s.season_id is not null;

update public.laurel_outputs l
set season_id = coalesce(a.season_id, s.season_id)
from public.awards a
join public.submissions s
  on s.id = a.submission_id
 and s.tenant_id = a.tenant_id
where l.award_id = a.id
  and l.tenant_id = a.tenant_id
  and l.submission_id = s.id
  and l.season_id is null;


-- ---------------------------------------------------------
-- 4. SEASON-AWARE INDEXES
-- ---------------------------------------------------------

create index if not exists submissions_tenant_season_idx
  on public.submissions(tenant_id, season_id, submitted_at desc);

create index if not exists submission_payments_tenant_season_idx
  on public.submission_payments(tenant_id, season_id, updated_at desc);

create index if not exists jury_assignments_tenant_season_idx
  on public.jury_assignments(tenant_id, season_id, assigned_at desc);

create index if not exists jury_reviews_tenant_season_idx
  on public.jury_reviews(tenant_id, season_id);

create index if not exists awards_tenant_season_idx
  on public.awards(tenant_id, season_id, updated_at desc);

create index if not exists laurel_outputs_tenant_season_idx
  on public.laurel_outputs(tenant_id, season_id, generated_at desc);


comment on column public.submissions.season_id is
  'Festival season owning this submission.';

comment on column public.jury_assignments.season_id is
  'Festival season inherited from the assigned submission.';

comment on column public.jury_reviews.season_id is
  'Festival season inherited from the reviewed submission.';

comment on column public.awards.season_id is
  'Festival season owning this award decision.';

comment on column public.laurel_outputs.season_id is
  'Festival season owning this official laurel / digital award output.';

notify pgrst, 'reload schema';

commit;
