-- Film Festival OS™
-- Migration 008 — Demo / Conflict-of-Interest Hard Controls
-- 07 Sep 2026

alter table public.submissions
  add column if not exists entry_classification text not null default 'competition',
  add column if not exists coi_status text not null default 'clear',
  add column if not exists restriction_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='submissions_entry_classification_check'
      and conrelid='public.submissions'::regclass
  ) then
    alter table public.submissions
      add constraint submissions_entry_classification_check
      check (entry_classification in ('competition','demo_test'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='submissions_coi_status_check'
      and conrelid='public.submissions'::regclass
  ) then
    alter table public.submissions
      add constraint submissions_coi_status_check
      check (coi_status in ('clear','declared','blocked'));
  end if;
end $$;

create or replace function public.assert_submission_competition_eligible()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.submissions%rowtype;
begin
  select * into s
  from public.submissions
  where id=new.submission_id;

  if not found then
    raise exception 'Submission not found.';
  end if;

  if s.entry_classification='demo_test' then
    raise exception 'DEMO / TEST ONLY submissions are not eligible for competition workflows.';
  end if;

  if s.coi_status='blocked' then
    raise exception 'Submission blocked by Film Festival OS conflict-of-interest policy.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payment_submission_eligibility on public.submission_payments;
create trigger trg_payment_submission_eligibility
before insert or update on public.submission_payments
for each row execute function public.assert_submission_competition_eligible();

drop trigger if exists trg_jury_submission_eligibility on public.jury_assignments;
create trigger trg_jury_submission_eligibility
before insert or update on public.jury_assignments
for each row execute function public.assert_submission_competition_eligible();

drop trigger if exists trg_award_submission_eligibility on public.awards;
create trigger trg_award_submission_eligibility
before insert or update on public.awards
for each row execute function public.assert_submission_competition_eligible();
