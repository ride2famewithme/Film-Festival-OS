\set ON_ERROR_STOP on
\echo 'FFOS 096: isolated PostgreSQL review fixture'
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.jury_reviews (
  id uuid primary key,
  tenant_id uuid not null,
  assignment_id uuid not null,
  submission_id uuid not null,
  juror_user_id uuid not null,
  score numeric,
  notes text,
  status text not null
);
alter table public.jury_reviews enable row level security;
create policy jury_reviews_juror_all on public.jury_reviews
for all to authenticated
using (juror_user_id = auth.uid())
with check (juror_user_id = auth.uid());
grant select, insert, update, delete on public.jury_reviews to authenticated;

insert into public.jury_reviews values
('11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 '44444444-4444-4444-8444-444444444444',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 50,'draft notes','draft');

\ir ../../supabase/migrations/20260926090000_096_submitted_jury_review_immutability.sql

set role authenticated;
select set_config('request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);

-- Draft edit and legitimate draft-to-submitted transition still work.
update public.jury_reviews set score = 70 where status = 'draft';
do $draft$
begin
  if not exists (select 1 from public.jury_reviews
    where score = 70 and status = 'draft') then
    raise exception 'FAIL: draft edit did not work';
  end if;
  begin
    update public.jury_reviews set tenant_id =
      '99999999-9999-4999-8999-999999999999'
    where status = 'draft';
    raise exception 'FAIL: draft identity mutation was allowed';
  exception when sqlstate '42501' then
    if sqlerrm <> 'Jury review identity cannot be changed.' then
      raise exception 'FAIL: unexpected draft denial: %',sqlerrm;
    end if;
  end;
end;
$draft$;
update public.jury_reviews set status = 'submitted'
where id = '11111111-1111-4111-8111-111111111111';

-- Submitted score, notes, status and deletion must be immutable.
do $submitted$
declare
  v_count integer;
begin
  begin
    update public.jury_reviews set score = 99
    where id = '11111111-1111-4111-8111-111111111111';
    raise exception 'FAIL: submitted score was changed';
  exception when sqlstate '42501' then
    if sqlerrm <> 'Submitted jury reviews cannot be changed.' then
      raise exception 'FAIL: unexpected score denial: %',sqlerrm;
    end if;
  end;
  begin
    update public.jury_reviews set notes = 'rewritten'
    where id = '11111111-1111-4111-8111-111111111111';
    raise exception 'FAIL: submitted notes were changed';
  exception when sqlstate '42501' then
    if sqlerrm <> 'Submitted jury reviews cannot be changed.' then
      raise exception 'FAIL: unexpected notes denial: %',sqlerrm;
    end if;
  end;
  begin
    update public.jury_reviews set status = 'draft'
    where id = '11111111-1111-4111-8111-111111111111';
    raise exception 'FAIL: submitted review was reopened';
  exception when sqlstate '42501' then
    if sqlerrm <> 'Submitted jury reviews cannot be changed.' then
      raise exception 'FAIL: unexpected reopening denial: %',sqlerrm;
    end if;
  end;
  begin
    delete from public.jury_reviews
    where id = '11111111-1111-4111-8111-111111111111';
    raise exception 'FAIL: submitted review was deleted';
  exception when sqlstate '42501' then
    if sqlerrm <> 'Submitted jury reviews cannot be deleted.' then
      raise exception 'FAIL: unexpected deletion denial: %',sqlerrm;
    end if;
  end;
  select count(*) into v_count from public.jury_reviews
  where id = '11111111-1111-4111-8111-111111111111'
    and score = 70 and notes = 'draft notes' and status = 'submitted';
  if v_count <> 1 then
    raise exception 'FAIL: submitted review changed';
  end if;
end;
$submitted$;

\echo 'PASS: submitted review immutability and draft edit path'
