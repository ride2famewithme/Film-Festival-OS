-- Film Festival OS™ — LIVE jury release-gate summary (READ ONLY)
-- One result table for the operator/Supervisor evidence package.
-- Run on the target FFOS Supabase project BEFORE migrations 095/096.
begin;
set transaction read only;

with
migration_state as (
  select
    count(*) filter (where version = '20260926044000') as m095,
    count(*) filter (where version = '20260926090000') as m096
  from supabase_migrations.schema_migrations
),
rls_state as (
  select
    bool_and(c.relrowsecurity) as all_rls_enabled,
    count(*) as protected_table_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('jury_assignments','jury_reviews')
),
preflight as (
  select
    to_regclass('public.jury_assignments') is not null as assignments_exists,
    to_regclass('public.jury_reviews') is not null as reviews_exists,
    to_regprocedure('public.submit_criterion_jury_review(uuid,text,text)') is not null as submit_rpc_exists,
    exists (
      select 1 from pg_catalog.pg_policies
      where schemaname='public'
        and tablename='jury_assignments'
        and policyname='jury_assignments_juror_update'
        and cmd='UPDATE'
    ) as juror_update_policy_exists
),
trigger_state as (
  select
    count(*) filter (where t.tgname='trg_guard_juror_assignment_update') as guard_trigger,
    count(*) filter (where t.tgname='trg_enforce_submitted_jury_review_immutability') as immutable_trigger
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid=t.tgrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where not t.tgisinternal
    and n.nspname='public'
    and c.relname in ('jury_assignments','jury_reviews')
),
review_anomalies as (
  select
    count(*) filter (where status='submitted' and submitted_at is null)::bigint as submitted_without_timestamp,
    count(*) filter (where status='draft' and submitted_at is not null)::bigint as draft_with_timestamp
  from public.jury_reviews
),
assignment_anomalies as (
  select count(*)::bigint as completed_without_submitted_review
  from public.jury_assignments a
  where a.status='completed'
    and not exists (
      select 1
      from public.jury_reviews r
      where r.assignment_id=a.id
        and r.tenant_id=a.tenant_id
        and r.submission_id=a.submission_id
        and r.juror_user_id=a.juror_user_id
        and r.status='submitted'
        and r.submitted_at is not null
    )
),
rpc_state as (
  select
    coalesce(bool_or(p.prosecdef),false) as submit_rpc_security_definer,
    coalesce(bool_or(pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')),false) as authenticated_can_execute
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='submit_criterion_jury_review'
    and pg_catalog.pg_get_function_identity_arguments(p.oid)='p_review_id uuid, p_recommendation text, p_notes text'
)
select *
from (
  select 10 as seq, '095 not yet applied' as check_name,
    case when m.m095=0 then 'PASS' else 'HOLD' end as result,
    'applied_count='||m.m095::text as detail from migration_state m
  union all
  select 20, '096 not yet applied',
    case when m.m096=0 then 'PASS' else 'HOLD' end,
    'applied_count='||m.m096::text from migration_state m
  union all
  select 30, 'jury tables exist and RLS enabled',
    case when r.protected_table_count=2 and r.all_rls_enabled then 'PASS' else 'HOLD' end,
    'table_count='||r.protected_table_count::text||', all_rls='||coalesce(r.all_rls_enabled::text,'null') from rls_state r
  union all
  select 40, '095 preflight objects exist',
    case when p.assignments_exists and p.reviews_exists and p.submit_rpc_exists and p.juror_update_policy_exists then 'PASS' else 'HOLD' end,
    'assignments='||p.assignments_exists::text||', reviews='||p.reviews_exists::text||', rpc='||p.submit_rpc_exists::text||', policy='||p.juror_update_policy_exists::text
    from preflight p
  union all
  select 50, '095/096 triggers absent before deployment',
    case when t.guard_trigger=0 and t.immutable_trigger=0 then 'PASS' else 'HOLD' end,
    'guard='||t.guard_trigger::text||', immutable='||t.immutable_trigger::text from trigger_state t
  union all
  select 60, 'submit RPC security boundary',
    case when r.submit_rpc_security_definer and r.authenticated_can_execute then 'PASS' else 'HOLD' end,
    'security_definer='||r.submit_rpc_security_definer::text||', authenticated_execute='||r.authenticated_can_execute::text from rpc_state r
  union all
  select 70, 'review status/timestamp anomalies',
    case when a.submitted_without_timestamp=0 and a.draft_with_timestamp=0 then 'PASS' else 'HOLD' end,
    'submitted_without_timestamp='||a.submitted_without_timestamp::text||', draft_with_timestamp='||a.draft_with_timestamp::text from review_anomalies a
  union all
  select 80, 'completed assignment linkage',
    case when a.completed_without_submitted_review=0 then 'PASS' else 'REVIEW' end,
    'completed_without_submitted_review='||a.completed_without_submitted_review::text from assignment_anomalies a
) checks
order by seq;

rollback;
