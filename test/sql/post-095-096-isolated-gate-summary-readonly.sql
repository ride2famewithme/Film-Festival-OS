-- Film Festival OS™ — POST 095/096 verification summary (READ ONLY)
-- Run only on an isolated restored/staging database AFTER applying migrations 095 and 096.
-- Single SELECT-only statement: SQL Editor displays the result table directly.

with
migration_state as (
  select
    count(*) filter (where version='20260926044000') as m095,
    count(*) filter (where version='20260926090000') as m096
  from supabase_migrations.schema_migrations
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
review_grants as (
  select
    exists (
      select 1 from information_schema.role_table_grants
      where table_schema='public' and table_name='jury_reviews'
        and grantee='authenticated' and privilege_type='UPDATE'
    ) as table_update,
    array_agg(column_name::text order by column_name::text) filter (
      where grantee='authenticated' and privilege_type='UPDATE'
    ) as update_columns
  from information_schema.role_column_grants
  where table_schema='public' and table_name='jury_reviews'
),
anomalies as (
  select
    count(*) filter (where status='submitted' and submitted_at is null)::bigint as submitted_without_timestamp,
    count(*) filter (where status='draft' and submitted_at is not null)::bigint as draft_with_timestamp
  from public.jury_reviews
)
select *
from (
  select 10 as seq, '095 applied in isolated target' as check_name,
    case when m.m095=1 then 'PASS' else 'HOLD' end as result,
    'applied_count='||m.m095::text as detail from migration_state m
  union all
  select 20, '096 applied in isolated target',
    case when m.m096=1 then 'PASS' else 'HOLD' end,
    'applied_count='||m.m096::text from migration_state m
  union all
  select 30, 'security triggers installed',
    case when t.guard_trigger=1 and t.immutable_trigger=1 then 'PASS' else 'HOLD' end,
    'guard='||t.guard_trigger::text||', immutable='||t.immutable_trigger::text from trigger_state t
  union all
  select 40, 'jury_reviews authenticated table-wide UPDATE revoked',
    case when not g.table_update then 'PASS' else 'HOLD' end,
    'table_update='||g.table_update::text from review_grants g
  union all
  select 50, 'jury_reviews authenticated column UPDATE limited',
    case when coalesce(g.update_columns,'{}'::text[]) <@ array['notes','recommendation','score']::text[]
          and array['notes','recommendation','score']::text[] <@ coalesce(g.update_columns,'{}'::text[])
         then 'PASS' else 'HOLD' end,
    'columns='||coalesce(array_to_string(g.update_columns,','),'') from review_grants g
  union all
  select 60, 'review status/timestamp anomalies unchanged',
    case when a.submitted_without_timestamp=0 and a.draft_with_timestamp=0 then 'PASS' else 'HOLD' end,
    'submitted_without_timestamp='||a.submitted_without_timestamp::text||', draft_with_timestamp='||a.draft_with_timestamp::text from anomalies a
) checks
order by seq;
