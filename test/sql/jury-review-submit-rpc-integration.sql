\set ON_ERROR_STOP on
\echo 'FFOS 022 + 096: real submission RPC in isolated PostgreSQL'

do $role$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $role$;
create schema auth;
grant usage on schema auth to authenticated;
create function auth.uid() returns uuid language sql stable as $uid$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$uid$;
create function public.is_tenant_member(p_tenant uuid)
returns boolean language sql stable as $member$
  select p_tenant = '11111111-1111-4111-8111-111111111111'::uuid
     and auth.uid() = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
$member$;

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

alter table public.jury_reviews enable row level security;
create policy jury_reviews_juror_all on public.jury_reviews
for all to authenticated
using (juror_user_id = auth.uid())
with check (juror_user_id = auth.uid());
grant select, insert, update, delete on public.jury_reviews to authenticated;
grant select on public.jury_assignments to authenticated;

insert into public.jury_scoring_forms values
('22222222-2222-4222-8222-222222222222','active',true,true);
insert into public.jury_assignments values
('33333333-3333-4333-8333-333333333333',
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
insert into public.jury_scoring_criteria values
('66666666-6666-4666-8666-666666666666',
 '22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111',
 100,true);

\ir ../../supabase/migrations/20260911210000_022_submit_criterion_jury_review.sql
\ir ../../supabase/migrations/20260926090000_096_submitted_jury_review_immutability.sql

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
\echo 'PASS: real criterion submission RPC, authorization, required criterion comment, completeness and immutable result'
