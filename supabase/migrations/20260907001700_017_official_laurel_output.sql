-- Film Festival OS™
-- Migration 017 — Official Laurel Output
-- 07 Sep 2026

create table if not exists public.laurel_outputs (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  award_id uuid not null
    references public.awards(id) on delete cascade,

  submission_id uuid not null
    references public.submissions(id) on delete cascade,

  verification_code text not null default
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),

  format text not null default 'svg'
    check (format in ('svg','png','pdf')),

  status text not null default 'generated'
    check (status in ('generated','revoked')),

  generated_by uuid
    references auth.users(id) on delete set null,

  generated_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  unique (award_id),
  unique (verification_code)
);

alter table public.laurel_outputs
enable row level security;

drop policy if exists laurel_outputs_manager_all
on public.laurel_outputs;

create policy laurel_outputs_manager_all
on public.laurel_outputs
for all
using (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner','festival_staff']
  )
)
with check (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner','festival_staff']
  )
);

grant select, insert, update
on table public.laurel_outputs
to authenticated;

create or replace function
public.assert_laurel_output_eligible()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_award public.awards%rowtype;
  v_submission public.submissions%rowtype;
begin

  select *
  into v_award
  from public.awards
  where id = new.award_id
    and tenant_id = new.tenant_id;

  if not found then
    raise exception 'Award not found.';
  end if;

  if v_award.publication_status <> 'published' then
    raise exception
      'Laurel blocked: award decision must be published first.';
  end if;

  if v_award.submission_id <> new.submission_id then
    raise exception
      'Laurel blocked: award and submission do not match.';
  end if;

  select *
  into v_submission
  from public.submissions
  where id = new.submission_id
    and tenant_id = new.tenant_id;

  if not found then
    raise exception 'Submission not found.';
  end if;

  if v_submission.entry_classification = 'demo_test'
     or v_submission.status = 'demo_test'
     or v_submission.coi_status = 'blocked' then
    raise exception
      'Laurel blocked: demo/test or conflict-restricted submission.';
  end if;

  if not exists (
    select 1
    from public.jury_submission_results jr
    where jr.submission_id = new.submission_id
      and jr.tenant_id = new.tenant_id
      and jr.calculation_status = 'locked'
      and jr.review_count > 0
  ) then
    raise exception
      'Laurel blocked: jury result must be locked first.';
  end if;

  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists
trg_laurel_output_eligible
on public.laurel_outputs;

create trigger
trg_laurel_output_eligible
before insert or update
on public.laurel_outputs
for each row
execute function public.assert_laurel_output_eligible();
