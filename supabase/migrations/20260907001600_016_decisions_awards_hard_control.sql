-- Film Festival OS™
-- Migration 016 — Decisions & Awards Hard Control
-- Reconstructed from verified live implementation
-- 07–08 Sep 2026

grant select, insert, update
on table public.awards
to authenticated;

create or replace function
public.assert_award_jury_result_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  if not exists (
    select 1
    from public.jury_submission_results jr
    where jr.submission_id = new.submission_id
      and jr.tenant_id = new.tenant_id
      and jr.calculation_status = 'locked'
      and jr.review_count > 0
  ) then

    raise exception
      'Award blocked: jury result must be locked before an award can be created.';

  end if;

  return new;

end;
$$;

drop trigger if exists
trg_award_requires_locked_jury_result
on public.awards;

create trigger
trg_award_requires_locked_jury_result
before insert
on public.awards
for each row
execute function
public.assert_award_jury_result_locked();

