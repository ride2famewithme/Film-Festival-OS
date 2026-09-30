\set ON_ERROR_STOP on
-- Existing restored schema only. No replacement functions, policies or triggers.
begin;
set local statement_timeout='90s';
set local lock_timeout='5s';

do $$ begin
  if current_database() <> 'ffos_restored' then
    raise exception 'This harness requires the isolated ffos_restored database';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_roles r on r.oid=p.proowner
    where p.oid='public.submit_criterion_jury_review(uuid,text,text)'::regprocedure
      and p.prosecdef and r.rolname='postgres'
  ) then
    raise exception 'Unexpected submit RPC security boundary';
  end if;
end $$;

create temp table ffos_ci_ids on commit drop as
select gen_random_uuid() ta, gen_random_uuid() tb,
       gen_random_uuid() creator, gen_random_uuid() juror,
       gen_random_uuid() peer, gen_random_uuid() owner_user,
       gen_random_uuid() outsider,
       gen_random_uuid() sa, gen_random_uuid() sb,
       gen_random_uuid() fa, gen_random_uuid() fb,
       gen_random_uuid() ca, gen_random_uuid() cb,
       gen_random_uuid() aa, gen_random_uuid() ap, gen_random_uuid() ab,
       gen_random_uuid() ra, gen_random_uuid() rp, gen_random_uuid() rb;
grant select on table pg_temp.ffos_ci_ids to authenticated, postgres;
select * from pg_temp.ffos_ci_ids \gset ci_

-- Synthetic identities have no password and are never retained.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select u, 'authenticated', 'authenticated', u::text || '@ffos-test.invalid',
       '{}'::jsonb, '{}'::jsonb, now(), now()
from pg_temp.ffos_ci_ids c
cross join lateral unnest(array[c.creator,c.juror,c.peer,c.owner_user,c.outsider]) u;

insert into public.tenants (id,name,type,status)
select ta, 'FFOS rollback festival A ' || ta::text, 'festival','active' from pg_temp.ffos_ci_ids
union all
select tb, 'FFOS rollback festival B ' || tb::text, 'festival','active' from pg_temp.ffos_ci_ids;

insert into public.memberships (user_id,tenant_id,role,status)
select juror,ta,'juror','active' from pg_temp.ffos_ci_ids
union all select peer,ta,'juror','active' from pg_temp.ffos_ci_ids
union all select owner_user,ta,'festival_owner','active' from pg_temp.ffos_ci_ids
union all select creator,ta,'creator','active' from pg_temp.ffos_ci_ids
union all select creator,tb,'creator','active' from pg_temp.ffos_ci_ids
union all select outsider,tb,'juror','active' from pg_temp.ffos_ci_ids;

insert into public.jury_governance_settings (tenant_id)
select ta from pg_temp.ffos_ci_ids union all select tb from pg_temp.ffos_ci_ids
on conflict (tenant_id) do nothing;
insert into public.jury_panel_members
  (tenant_id,auth_user_id,display_label,juror_kind,weight_percent,status,conflict_status)
select ta,juror,'Rollback juror','independent',20,'active','clear' from pg_temp.ffos_ci_ids
union all select ta,peer,'Rollback peer','independent',20,'active','clear' from pg_temp.ffos_ci_ids
union all select tb,outsider,'Rollback outsider','independent',20,'active','clear' from pg_temp.ffos_ci_ids;

insert into public.submissions
  (id,tenant_id,owner_id,title,filmmaker_name,entry_classification,coi_status)
select sa,ta,creator,'Rollback film A','Synthetic creator','competition','clear' from pg_temp.ffos_ci_ids
union all select sb,tb,creator,'Rollback film B','Synthetic creator','competition','clear' from pg_temp.ffos_ci_ids;

insert into public.jury_scoring_forms
  (id,tenant_id,name,status,recommendation_required,overall_comment_required)
select fa,ta,'Rollback form A','draft',true,true from pg_temp.ffos_ci_ids
union all select fb,tb,'Rollback form B','draft',true,true from pg_temp.ffos_ci_ids;
insert into public.jury_scoring_criteria
  (id,tenant_id,form_id,label,weight_percent,score_min,score_max,comment_required)
select ca,ta,fa,'Rollback criterion',100,0,100,true from pg_temp.ffos_ci_ids
union all select cb,tb,fb,'Rollback criterion',100,0,100,true from pg_temp.ffos_ci_ids;
update public.jury_scoring_forms set status='active'
where id in (select fa from pg_temp.ffos_ci_ids union all select fb from pg_temp.ffos_ci_ids);

insert into public.jury_assignments
  (id,tenant_id,submission_id,juror_user_id,scoring_form_id,status)
select aa,ta,sa,juror,fa,'assigned' from pg_temp.ffos_ci_ids
union all select ap,ta,sa,peer,fa,'assigned' from pg_temp.ffos_ci_ids
union all select ab,tb,sb,outsider,fb,'assigned' from pg_temp.ffos_ci_ids;
insert into public.jury_reviews
  (id,tenant_id,assignment_id,submission_id,juror_user_id,status,submitted_at)
select ra,ta,aa,sa,juror,'draft',null::timestamptz from pg_temp.ffos_ci_ids
union all select rp,ta,ap,sa,peer,'draft',null::timestamptz from pg_temp.ffos_ci_ids
union all select rb,tb,ab,sb,outsider,'draft',null::timestamptz from pg_temp.ffos_ci_ids;

-- Set both JWT representations used by real Supabase Auth helpers.
select set_config('request.jwt.claims',jsonb_build_object('sub',juror,'role','authenticated')::text,true),
       set_config('request.jwt.claim.sub',juror::text,true),
       set_config('request.jwt.claim.role','authenticated',true)
from pg_temp.ffos_ci_ids;
set local role authenticated;
do $$ declare c record; denied boolean; changed integer; begin
  select * into c from pg_temp.ffos_ci_ids;
  if auth.uid() is distinct from c.juror or public.is_platform_admin()
     or not public.has_tenant_role(c.ta,array['juror']) then
    raise exception 'Synthetic juror authentication failed';
  end if;
  if not exists(select 1 from public.jury_assignments where id=c.aa)
     or not exists(select 1 from public.jury_reviews where id=c.ra) then
    raise exception 'Juror cannot read own assignment/review';
  end if;
  update public.jury_reviews set notes='Draft edit' where id=c.ra;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Draft edit failed'; end if;
  denied:=false;
  begin
    update public.jury_reviews set status='submitted',submitted_at=now() where id=c.ra;
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Direct submission was allowed'; end if;
  denied:=false;
  begin
    update public.jury_assignments set status='completed' where id=c.aa;
  exception when insufficient_privilege then
    if sqlerrm<>'Jury assignment cannot be completed without its submitted review.' then raise; end if;
    denied:=true;
  end;
  if not denied then raise exception 'Premature completion allowed'; end if;
  denied:=false;
  begin
    update public.jury_assignments set weight_percent_snapshot=21 where id=c.aa;
  exception when insufficient_privilege then
    if sqlerrm<>'Permission denied: jurors may not change assignment governance fields.' then raise; end if;
    denied:=true;
  end;
  if not denied then raise exception 'Juror governance edit allowed'; end if;
  denied:=false;
  begin
    perform public.submit_criterion_jury_review(c.ra,'accept','Overall comment');
  exception when raise_exception then
    if sqlerrm<>'Cannot submit review: every scoring criterion must be completed.' then raise; end if;
    denied:=true;
  end;
  if not denied then raise exception 'Incomplete review submitted'; end if;
end $$;
\echo 'PASS: real juror draft path, direct-write denials and incomplete RPC denial'
reset role;

-- Real criterion trigger derives all identity and score snapshot fields.
select set_config('request.jwt.claims',jsonb_build_object('sub',juror,'role','authenticated')::text,true),
       set_config('request.jwt.claim.sub',juror::text,true)
from pg_temp.ffos_ci_ids;
set local role authenticated;
insert into public.jury_review_criterion_scores (review_id,criterion_id,raw_score,criterion_comment)
select ra,ca,75,'Criterion comment' from pg_temp.ffos_ci_ids;
do $$ declare c record; denied boolean; begin
  select * into c from pg_temp.ffos_ci_ids;
  if not exists(select 1 from public.jury_review_criterion_scores
    where review_id=c.ra and criterion_id=c.ca and tenant_id=c.ta
      and assignment_id=c.aa and scoring_form_id=c.fa and juror_user_id=c.juror
      and normalized_score=75 and weighted_contribution=75) then
    raise exception 'Criterion snapshot/score calculation failed';
  end if;
  denied:=false;
  begin perform public.submit_criterion_jury_review(c.ra,null,'Overall comment');
  exception when raise_exception then
    if sqlerrm<>'Cannot submit review: recommendation is required.' then raise; end if;
    denied:=true;
  end;
  if not denied then raise exception 'Missing recommendation accepted'; end if;
  denied:=false;
  begin perform public.submit_criterion_jury_review(c.ra,'accept',' ');
  exception when raise_exception then
    if sqlerrm<>'Cannot submit review: overall comment is required.' then raise; end if;
    denied:=true;
  end;
  if not denied then raise exception 'Blank overall comment accepted'; end if;
end $$;
reset role;

-- Both another juror in A and the juror in B must be denied A's target rows.
do $$ declare c record; candidate uuid; denied boolean; changed integer; begin
  select * into c from pg_temp.ffos_ci_ids;
  foreach candidate in array array[c.peer,c.outsider] loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub',candidate,'role','authenticated')::text,true);
    perform set_config('request.jwt.claim.sub',candidate::text,true);
    execute 'set local role authenticated';
    if auth.uid() is distinct from candidate or public.is_platform_admin() then
      raise exception 'Denial-test identity invalid';
    end if;
    if exists(select 1 from public.jury_reviews where id=c.ra)
       or exists(select 1 from public.jury_assignments where id=c.aa)
       or exists(select 1 from public.jury_review_criterion_scores where review_id=c.ra) then
      raise exception 'Other juror can read target rows';
    end if;
    if candidate=c.peer and not exists(select 1 from public.jury_reviews where id=c.rp) then
      raise exception 'Same-tenant peer positive read control failed';
    elsif candidate=c.outsider and not exists(select 1 from public.jury_reviews where id=c.rb) then
      raise exception 'Cross-tenant positive read control failed';
    end if;
    update public.jury_reviews set notes='Forbidden' where id=c.ra;
    get diagnostics changed=row_count;
    if changed<>0 then raise exception 'Other juror edited target review'; end if;
    update public.jury_assignments set status='completed' where id=c.aa;
    get diagnostics changed=row_count;
    if changed<>0 then raise exception 'Other juror edited target assignment'; end if;
    denied:=false;
    begin perform public.submit_criterion_jury_review(c.ra,'accept','Forbidden');
    exception when raise_exception then
      if sqlerrm<>'Draft jury review or assigned scoring form not found.' then raise; end if;
      denied:=true;
    end;
    if not denied then raise exception 'Other juror submitted target review'; end if;
    execute 'reset role';
  end loop;
end $$;
\echo 'PASS: same-tenant other-juror and cross-tenant read/write/RPC isolation'

select set_config('request.jwt.claims',jsonb_build_object('sub',juror,'role','authenticated')::text,true),
       set_config('request.jwt.claim.sub',juror::text,true)
from pg_temp.ffos_ci_ids;
set local role authenticated;
do $$ declare c record; v public.jury_reviews%rowtype; denied boolean; begin
  select * into c from pg_temp.ffos_ci_ids;
  select * into v from public.submit_criterion_jury_review(c.ra,'accept','Overall comment');
  if v.id is distinct from c.ra or v.status is distinct from 'submitted' or v.score is distinct from 75
     or v.submitted_at is null or v.recommendation is distinct from 'accept'
     or v.notes is distinct from 'Overall comment' then
    raise exception 'Real RPC submission result incorrect';
  end if;
  if not exists(select 1 from public.jury_assignments where id=c.aa and status='completed') then
    raise exception 'Real RPC did not complete assignment';
  end if;
  denied:=false;
  begin update public.jury_reviews set notes='After submission' where id=c.ra;
  exception when insufficient_privilege then
    if sqlerrm<>'Submitted jury reviews cannot be changed.' then raise; end if;
    denied:=true;
  end;
  if not denied then raise exception 'Submitted review edit allowed'; end if;
  denied:=false;
  begin update public.jury_review_criterion_scores set raw_score=99 where review_id=c.ra;
  exception when raise_exception then
    if sqlerrm<>'Criterion scores cannot be changed after the jury review is submitted.' then raise; end if;
    denied:=true;
  end;
  if not denied then raise exception 'Submitted criterion edit allowed'; end if;
  denied:=false;
  begin perform public.submit_criterion_jury_review(c.ra,'accept','Again');
  exception when raise_exception then
    if sqlerrm<>'Only a draft jury review may be submitted.' then raise; end if;
    denied:=true;
  end;
  if not denied then raise exception 'Duplicate RPC submission allowed'; end if;
end $$;
reset role;
do $$ declare c record; begin
  select * into c from pg_temp.ffos_ci_ids;
  if not exists(select 1 from public.jury_submission_results
    where submission_id=c.sa and weighted_score=75 and review_count=1
      and participating_weight_percent=20 and calculation_status='provisional') then
    raise exception 'Weighted result refresh failed';
  end if;
end $$;
\echo 'PASS: real RPC, score calculation, assignment completion and submitted locks'

select set_config('request.jwt.claims',jsonb_build_object('sub',owner_user,'role','authenticated')::text,true),
       set_config('request.jwt.claim.sub',owner_user::text,true)
from pg_temp.ffos_ci_ids;
set local role authenticated;
do $$ declare c record; changed integer; begin
  select * into c from pg_temp.ffos_ci_ids;
  if not public.has_tenant_role(c.ta,array['festival_owner']) then
    raise exception 'Owner identity invalid';
  end if;
  update public.jury_assignments set confidentiality_status='reveal_after_awards' where id=c.aa;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Owner assignment management failed'; end if;
  update public.jury_assignments set conflict_status='recused' where id=c.ap;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Owner recusal failed'; end if;
  perform public.lock_jury_submission_result(c.sa);
end $$;
reset role;
-- Verify actual legacy trigger error on a DRAFT delete as table owner.
-- Authenticated DELETE may also be denied by the original table ACL.
set local role postgres;
do $$ declare c record; denied boolean; error_context text; begin
  select * into c from pg_temp.ffos_ci_ids;
  if not exists(select 1 from public.jury_submission_results
    where submission_id=c.sa and calculation_status='locked') then
    raise exception 'Owner result lock failed';
  end if;
  denied:=false;
  begin delete from public.jury_reviews where id=c.rp;
  exception when raise_exception then
    get stacked diagnostics error_context=pg_exception_context;
    if position('prevent_locked_jury_review_change' in error_context)=0 then raise; end if;
    denied:=true;
  end;
  if not denied then raise exception 'Legacy result lock allowed draft deletion'; end if;
end $$;
reset role;
\echo 'PASS: legitimate owner management and real legacy final-result lock'
rollback;

select
  not exists(select 1 from auth.users where id in
    (:'ci_creator'::uuid,:'ci_juror'::uuid,:'ci_peer'::uuid,:'ci_owner_user'::uuid,:'ci_outsider'::uuid))
  and not exists(select 1 from public.tenants where id in (:'ci_ta'::uuid,:'ci_tb'::uuid))
  as cleaned \gset
\if :cleaned
  \echo 'PASS: synthetic identities and tenants rolled back'
\else
  select 1/0;
\endif
