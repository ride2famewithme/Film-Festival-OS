\set ON_ERROR_STOP on
\echo 'FFOS 022 + 095 + 096: combined migrations and real RPC in isolated PostgreSQL'

do $role$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $role$;
do $role$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $role$;
create schema auth;
grant usage on schema auth to authenticated;
create function auth.uid() returns uuid language sql stable as $uid$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$uid$;
create function auth.role() returns text language sql stable as $role$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$role$;
create function public.is_tenant_member(p_tenant uuid)
returns boolean language sql stable as $member$
  select p_tenant = '11111111-1111-4111-8111-111111111111'::uuid
     and auth.uid() = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
$member$;
create function public.has_tenant_role(p_tenant uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public, auth as $tenant_role$
  select p_tenant = '11111111-1111-4111-8111-111111111111'::uuid
     and (
       (auth.uid() = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
        and 'juror' = any(p_roles))
       or (auth.uid() = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
           and 'festival_owner' = any(p_roles))
     )
$tenant_role$;
create function public.is_platform_admin()
returns boolean language sql stable as $admin$ select false $admin$;

create table public.jury_scoring_forms (
  id uuid primary key, status text not null,
  recommendation_required boolean not null,
  overall_comment_required boolean not null
);
create table public.jury_assignments (
  id uuid primary key, tenant_id uuid not null,
  juror_user_id uuid not null, scoring_form_id uuid not null,
  status text not null, conflict_status text not null
);
create table public.jury_reviews (
  id uuid primary key, tenant_id uuid not null,
  assignment_id uuid not null, submission_id uuid not null,
  juror_user_id uuid not null, score numeric,
  recommendation text, notes text, status text not null,
  submitted_at timestamptz
);
create table public.jury_scoring_criteria (
  id uuid primary key, form_id uuid not null,
  tenant_id uuid not null, weight_percent numeric not null,
  comment_required boolean not null
);
create table public.jury_review_criterion_scores (
  review_id uuid not null, criterion_id uuid not null,
  assignment_id uuid not null, scoring_form_id uuid not null,
  tenant_id uuid not null, juror_user_id uuid not null,
  weighted_contribution numeric not null,
  criterion_comment text
);
create table public.jury_submission_results (
  submission_id uuid primary key,
  calculation_status text not null
);

alter table public.jury_assignments enable row level security;
alter table public.jury_reviews enable row level security;
create policy jury_assignments_juror_read on public.jury_assignments
for select to authenticated
using (juror_user_id = auth.uid() and public.is_tenant_member(tenant_id));
create policy jury_assignments_juror_update on public.jury_assignments
for update to authenticated
using (juror_user_id = auth.uid() and public.is_tenant_member(tenant_id))
with check (juror_user_id = auth.uid() and public.is_tenant_member(tenant_id));
create policy jury_assignments_owner_all on public.jury_assignments
for all to authenticated
using (public.has_tenant_role(tenant_id, array['festival_owner']))
with check (public.has_tenant_role(tenant_id, array['festival_owner']));
create policy jury_reviews_juror_all on public.jury_reviews
for all to authenticated
using (juror_user_id = auth.uid())
with check (juror_user_id = auth.uid());
grant select, insert, update, delete on public.jury_reviews to authenticated;
grant select, update on public.jury_assignments to authenticated;

-- The live pre-existing trigger blocks changes when the final result is locked.
-- Its definition was read from production metadata; this fixture has no live rows.
create function public.ci_prevent_locked_review_change()
returns trigger language plpgsql security definer set search_path = public as $locked$
begin
  if exists (
    select 1 from public.jury_submission_results
    where submission_id = coalesce(new.submission_id, old.submission_id)
      and calculation_status = 'locked'
  ) then
    raise exception 'Jury result is locked. Reviews cannot be changed.';
  end if;
  return coalesce(new, old);
end;
$locked$;
create trigger trg_prevent_locked_jury_review_change
before insert or update or delete on public.jury_reviews
for each row execute function public.ci_prevent_locked_review_change();

insert into public.jury_scoring_forms values
('22222222-2222-4222-8222-222222222222','active',true,true);
insert into public.jury_assignments values
('33333333-3333-4333-8333-333333333333',
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '22222222-2222-4222-8222-222222222222',
 'assigned','clear');
insert into public.jury_assignments values
('88888888-8888-4888-8888-888888888888',
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '22222222-2222-4222-8222-222222222222',
 'assigned','clear');
insert into public.jury_reviews values
('44444444-4444-4444-8444-444444444444',
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '55555555-5555-4555-8555-555555555555',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 null,null,null,'draft',null);
insert into public.jury_reviews values
('77777777-7777-4777-8777-777777777777',
 '11111111-1111-4111-8111-111111111111',
 '88888888-8888-4888-8888-888888888888',
 '55555555-5555-4555-8555-555555555555',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 null,null,null,'draft',null);
insert into public.jury_scoring_criteria values
('66666666-6666-4666-8666-666666666666',
 '22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111',
 100,true);

\ir ../../supabase/migrations/20260911210000_022_submit_criterion_jury_review.sql
\ir ../../supabase/migrations/20260926044000_095_jury_assignment_juror_write_guard.sql
\ir ../../supabase/migrations/20260926090000_096_submitted_jury_review_immutability.sql

-- Before submission, a direct juror cannot complete an assignment or
-- replace its identity, even with an RLS UPDATE policy.
set role authenticated;
select set_config('request.jwt.claim.sub',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.role','authenticated',false);
do $assignment_guard$ begin
  begin
    update public.jury_assignments set status = 'completed'
    where id = '33333333-3333-4333-8333-333333333333';
    raise exception 'FAIL: direct juror completed assignment before review';
  exception when sqlstate '42501' then
    if sqlerrm <> 'Jury assignment cannot be completed without its submitted review.' then
      raise exception 'FAIL: unexpected assignment denial: %', sqlerrm;
    end if;
  end;
  begin
    update public.jury_assignments set conflict_status = 'recused'
    where id = '33333333-3333-4333-8333-333333333333';
    raise exception 'FAIL: direct juror changed governance';
  exception when sqlstate '42501' then
    if sqlerrm <> 'Permission denied: jurors may not change assignment governance fields.' then
      raise exception 'FAIL: unexpected governance denial: %', sqlerrm;
    end if;
  end;
end $assignment_guard$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $other_user$ begin
  begin
    perform public.submit_criterion_jury_review(
      '44444444-4444-4444-8444-444444444444',
      'accept','overall');
    raise exception 'FAIL: other user submitted the review';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Draft jury review or assigned scoring form not found.' then
      raise;
    end if;
  end;
end $other_user$;

reset role;
select set_config('request.jwt.claim.sub',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
set role authenticated;
do $incomplete$ begin
  begin
    perform public.submit_criterion_jury_review(
      '44444444-4444-4444-8444-444444444444',
      'accept','overall');
    raise exception 'FAIL: incomplete scores were submitted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Cannot submit review: every scoring criterion must be completed.' then
      raise;
    end if;
  end;
end $incomplete$;

reset role;
insert into public.jury_review_criterion_scores values
('44444444-4444-4444-8444-444444444444',
 '66666666-6666-4666-8666-666666666666',
 '33333333-3333-4333-8333-333333333333',
 '22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 75,'   ');
set role authenticated;
do $criterion_comment$ begin
  begin
    perform public.submit_criterion_jury_review(
      '44444444-4444-4444-8444-444444444444',
      'accept','overall');
    raise exception 'FAIL: blank required criterion comment was accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Cannot submit review: required criterion comments are missing.' then
      raise;
    end if;
  end;
end $criterion_comment$;

reset role;
update public.jury_review_criterion_scores
set criterion_comment = 'criterion comment'
where review_id = '44444444-4444-4444-8444-444444444444'
  and criterion_id = '66666666-6666-4666-8666-666666666666';
set role authenticated;
do $required$ begin
  begin
    perform public.submit_criterion_jury_review(
      '44444444-4444-4444-8444-444444444444',
      null,'overall');
    raise exception 'FAIL: missing recommendation was accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Cannot submit review: recommendation is required.' then
      raise;
    end if;
  end;
end $required$;

do $overall_comment$ begin
  begin
    perform public.submit_criterion_jury_review(
      '44444444-4444-4444-8444-444444444444',
      'accept','   ');
    raise exception 'FAIL: blank required overall comment was accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Cannot submit review: overall comment is required.' then
      raise;
    end if;
  end;
  if not exists (
    select 1 from public.jury_reviews
    where id = '44444444-4444-4444-8444-444444444444'
      and status = 'draft' and submitted_at is null
  ) then
    raise exception 'FAIL: rejected overall comment changed the draft review';
  end if;
  if not exists (
    select 1 from public.jury_assignments
    where id = '33333333-3333-4333-8333-333333333333'
      and status = 'assigned'
  ) then
    raise exception 'FAIL: rejected overall comment completed the assignment';
  end if;
end $overall_comment$;

select public.submit_criterion_jury_review(
 '44444444-4444-4444-8444-444444444444',
 'accept','overall');

do $verify$
begin
  if not exists (
    select 1 from public.jury_reviews
    where id = '44444444-4444-4444-8444-444444444444'
      and status = 'submitted' and score = 75
      and recommendation = 'accept' and notes = 'overall'
      and submitted_at is not null
  ) then
    raise exception 'FAIL: RPC did not finalize score and review';
  end if;
  if not exists (
    select 1 from public.jury_assignments
    where id = '33333333-3333-4333-8333-333333333333'
      and status = 'completed'
  ) then
    raise exception 'FAIL: RPC did not complete assignment';
  end if;
  begin
    update public.jury_reviews set score = 99
    where id = '44444444-4444-4444-8444-444444444444';
    raise exception 'FAIL: submitted score was mutable';
  exception when sqlstate '42501' then
    null;
  end;
  begin
    perform public.submit_criterion_jury_review(
      '44444444-4444-4444-8444-444444444444',
      'accept','again');
    raise exception 'FAIL: duplicate submission was accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Only a draft jury review may be submitted.' then
      raise;
    end if;
  end;
end $verify$;
reset role;

-- A legitimate owner can still manage assignment governance after the RPC.
select set_config('request.jwt.claim.sub',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
set role authenticated;
do $owner_management$ declare changed integer; begin
  update public.jury_assignments set conflict_status = 'recused'
  where id = '33333333-3333-4333-8333-333333333333';
  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'FAIL: owner could not manage assignment after submission';
  end if;
end $owner_management$;
reset role;

-- The legacy result lock and 096 submitted-review trigger coexist.
insert into public.jury_submission_results values
('55555555-5555-4555-8555-555555555555','locked');
do $legacy_lock$ begin
  begin
    update public.jury_reviews set notes = 'after result lock'
    where id = '77777777-7777-4777-8777-777777777777';
    raise exception 'FAIL: locked final result allowed review change';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Jury result is locked. Reviews cannot be changed.' then
      raise exception 'FAIL: unexpected result-lock denial: %', sqlerrm;
    end if;
  end;
end $legacy_lock$;
\echo 'PASS: 095 + 096, real RPC, juror denial, owner path and legacy result lock in isolated PostgreSQL'
