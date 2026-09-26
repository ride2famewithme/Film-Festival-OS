\set ON_ERROR_STOP on
\echo 'FFOS 095: preparing isolated PostgreSQL fixture (no Supabase connection)'

create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema public, auth to authenticated, service_role;

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create function auth.role() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;

create table public.memberships (
  user_id uuid not null,
  tenant_id uuid not null,
  role text not null,
  status text not null
);

create function public.has_tenant_role(target_tenant uuid, allowed_roles text[] default null)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = target_tenant
      and m.status = 'active'
      and (allowed_roles is null or m.role = any(allowed_roles))
  )
$$;

create function public.is_tenant_member(target_tenant uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select public.has_tenant_role(target_tenant)
$$;

create function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.role = 'platform_admin'
      and m.status = 'active'
  )
$$;

create table public.jury_assignments (
  id uuid primary key,
  tenant_id uuid not null,
  submission_id uuid not null,
  juror_user_id uuid not null,
  status text not null,
  weight_percent_snapshot numeric,
  conflict_status text,
  panel_member_id uuid,
  confidentiality_status text,
  scoring_form_id uuid,
  season_id uuid,
  assigned_at timestamptz default now()
);

create table public.jury_reviews (
  id uuid primary key,
  tenant_id uuid not null,
  submission_id uuid not null,
  assignment_id uuid not null,
  juror_user_id uuid not null,
  status text not null,
  submitted_at timestamptz
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

create policy jury_assignments_manager_all on public.jury_assignments
for all to authenticated
using (public.has_tenant_role(tenant_id, array['festival_owner']))
with check (public.has_tenant_role(tenant_id, array['festival_owner']));

create policy jury_reviews_juror_read on public.jury_reviews
for select to authenticated
using (juror_user_id = auth.uid() and public.is_tenant_member(tenant_id));

grant select, update on public.jury_assignments to authenticated;
grant select on public.jury_reviews to authenticated;

-- The migration checks this RPC's signature. This minimal stub models only
-- its existence; trusted-RPC behaviour is tested separately below.
create function public.submit_criterion_jury_review(uuid,text,text)
returns boolean language sql as $$ select true $$;

insert into public.memberships(user_id,tenant_id,role,status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111','juror','active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '11111111-1111-4111-8111-111111111111','festival_owner','active'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   '22222222-2222-4222-8222-222222222222','juror','active');

insert into public.jury_assignments(
  id,tenant_id,submission_id,juror_user_id,status,
  weight_percent_snapshot,conflict_status
) values
  ('44444444-4444-4444-8444-444444444444',
   '11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333333',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'assigned',20,'clear'),
  ('55555555-5555-4555-8555-555555555555',
   '22222222-2222-4222-8222-222222222222',
   '66666666-6666-4666-8666-666666666666',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'assigned',20,'clear');

\echo 'FFOS 095: applying only the staged migration to isolated fixture'
\ir ../../supabase/migrations/20260926044000_095_jury_assignment_juror_write_guard.sql

\echo 'FFOS 095: testing direct juror denial'
set role authenticated;
select set_config('request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.role','authenticated',false);

do $juror_checks$
begin
  begin
    update public.jury_assignments
    set weight_percent_snapshot = 99
    where id = '44444444-4444-4444-8444-444444444444';
    raise exception 'FAIL: direct juror weight mutation was allowed';
  exception when sqlstate '42501' then
    if sqlerrm not like 'Permission denied: jurors may not change assignment governance fields.%' then
      raise exception 'FAIL: unexpected weight denial: %', sqlerrm;
    end if;
  end;

  begin
    update public.jury_assignments
    set status = 'completed'
    where id = '44444444-4444-4444-8444-444444444444';
    raise exception 'FAIL: assignment completed before review submission';
  exception when sqlstate '42501' then
    if sqlerrm not like 'Jury assignment cannot be completed without its submitted review.%' then
      raise exception 'FAIL: unexpected pre-review denial: %', sqlerrm;
    end if;
  end;

  begin
    update public.jury_assignments
    set status = 'assigned'
    where id = '44444444-4444-4444-8444-444444444444';
    raise exception 'FAIL: juror no-op assignment update was allowed';
  exception when sqlstate '42501' then
    if sqlerrm not like 'Permission denied: only assigned-to-completed is allowed for jurors.%' then
      raise exception 'FAIL: unexpected status denial: %', sqlerrm;
    end if;
  end;
end;
$juror_checks$;

\echo 'FFOS 095: testing legitimate juror completion'
reset role;
insert into public.jury_reviews(
  id,tenant_id,submission_id,assignment_id,juror_user_id,status,submitted_at
) values (
  '77777777-7777-4777-8777-777777777777',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'submitted',now()
);
set role authenticated;

do $completion$
declare
  v_count int;
begin
  update public.jury_assignments
  set status = 'completed'
  where id = '44444444-4444-4444-8444-444444444444';
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'FAIL: matching submitted review did not permit completion';
  end if;

  begin
    update public.jury_assignments
    set status = 'assigned'
    where id = '44444444-4444-4444-8444-444444444444';
    raise exception 'FAIL: completed assignment was reopened by juror';
  exception when sqlstate '42501' then
    if sqlerrm not like 'Permission denied: only assigned-to-completed is allowed for jurors.%' then
      raise exception 'FAIL: unexpected reopening denial: %', sqlerrm;
    end if;
  end;
end;
$completion$;

\echo 'FFOS 095: testing authorised festival owner'
reset role;
select set_config('request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
set role authenticated;
do $owner$
declare v_count int;
begin
  update public.jury_assignments
  set weight_percent_snapshot = 25
  where id = '44444444-4444-4444-8444-444444444444';
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'FAIL: festival owner could not manage assignment';
  end if;
end;
$owner$;

\echo 'FFOS 095: testing cross-tenant juror denial'
reset role;
select set_config('request.jwt.claim.sub',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
set role authenticated;
do $cross_tenant$
declare v_count int;
begin
  update public.jury_assignments
  set weight_percent_snapshot = 35
  where id = '44444444-4444-4444-8444-444444444444';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: foreign juror changed another tenant assignment';
  end if;
end;
$cross_tenant$;

\echo 'FFOS 095: testing trusted SECURITY DEFINER submission path'
reset role;
delete from public.jury_reviews
where id = '77777777-7777-4777-8777-777777777777';
update public.jury_assignments set status = 'assigned'
where id = '44444444-4444-4444-8444-444444444444';

create function public.ci_trusted_review_completion()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.jury_assignments set status = 'completed'
  where id = '44444444-4444-4444-8444-444444444444';
end;
$$;
grant execute on function public.ci_trusted_review_completion()
  to authenticated;
select set_config('request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
set role authenticated;
select public.ci_trusted_review_completion();
do $trusted$
begin
  if not exists (
    select 1 from public.jury_assignments
    where id = '44444444-4444-4444-8444-444444444444'
      and status = 'completed'
  ) then
    raise exception 'FAIL: trusted review RPC path could not complete assignment';
  end if;
end;
$trusted$;

reset role;
\echo 'PASS: isolated PostgreSQL jury assignment negative and legitimate-path tests'
