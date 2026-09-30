-- Film Festival OS™ — LIVE jury security inventory (READ ONLY)
-- 30 September 2026
--
-- Purpose: collect the exact target-schema evidence required by issue #23
-- before migrations 095/096 are considered for live deployment.
--
-- Privacy boundary:
--   * no juror identities
--   * no review text
--   * no submission titles
--   * no payment data
--   * aggregate counts only
--
-- Safety boundary:
--   * transaction is explicitly READ ONLY
--   * no DDL/DML
--   * no SET ROLE / impersonation
--   * no migration application
--
-- Run in the linked FFOS Supabase project's SQL Editor as an authorised DB owner.
-- Save/export the result grid as evidence. Do not edit this script to add writes.

begin;
set transaction read only;

-- A. Server / target identity (safe metadata only)
select
  current_database() as database_name,
  current_user as database_role,
  current_setting('server_version') as postgres_version;

-- B. Has migration 095 or 096 already been recorded remotely?
select
  version
from supabase_migrations.schema_migrations
where version in ('20260926044000', '20260926090000')
order by version;

-- C. RLS state on the two protected jury tables
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('jury_assignments', 'jury_reviews')
order by c.relname;

-- C2. Column shape required by the 095/096 preflight and application path
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('jury_assignments', 'jury_reviews')
order by table_name, ordinal_position;

-- D. Live RLS policies (names/roles/commands only; expressions intentionally omitted)
select
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in ('jury_assignments', 'jury_reviews')
order by tablename, policyname;

-- E. Non-internal triggers currently attached to the protected jury tables
select
  c.relname as table_name,
  t.tgname as trigger_name,
  pg_catalog.pg_get_triggerdef(t.oid, true) as trigger_definition
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c
  on c.oid = t.tgrelid
join pg_catalog.pg_namespace n
  on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname = 'public'
  and c.relname in ('jury_assignments', 'jury_reviews')
order by c.relname, t.tgname;

-- F. Critical functions and security mode
select
  p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
  r.rolname as owner_role,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
    as authenticated_can_execute,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
    as anon_can_execute,
  pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
    as service_role_can_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n
  on n.oid = p.pronamespace
join pg_catalog.pg_roles r
  on r.oid = p.proowner
where n.nspname = 'public'
  and p.proname in (
    'submit_criterion_jury_review',
    'guard_juror_assignment_update',
    'enforce_submitted_jury_review_immutability'
  )
order by p.proname, arguments;

-- G. Table-level grants for PostgREST-facing roles
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('jury_assignments', 'jury_reviews')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- H. Column UPDATE grants on jury_reviews.
-- After migration 096 this should show authenticated UPDATE only for
-- score, recommendation and notes (not a table-wide UPDATE grant).
select
  grantee,
  table_name,
  column_name,
  privilege_type
from information_schema.role_column_grants
where table_schema = 'public'
  and table_name = 'jury_reviews'
  and grantee in ('anon', 'authenticated', 'service_role')
  and privilege_type = 'UPDATE'
order by grantee, column_name;

-- I. Safe aggregate state counts (no ids / identities / review text)
select
  status,
  count(*)::bigint as assignment_count
from public.jury_assignments
group by status
order by status;

select
  status,
  count(*)::bigint as review_count,
  count(*) filter (where submitted_at is null)::bigint
    as submitted_at_null_count
from public.jury_reviews
group by status
order by status;

-- J. Aggregate integrity checks relevant to 095/096
select
  count(*) filter (
    where status = 'submitted' and submitted_at is null
  )::bigint as submitted_without_timestamp,
  count(*) filter (
    where status = 'draft' and submitted_at is not null
  )::bigint as draft_with_submitted_timestamp,
  count(distinct tenant_id)::bigint as tenant_count
from public.jury_reviews;

select
  count(*)::bigint as completed_assignment_without_submitted_review
from public.jury_assignments a
where a.status = 'completed'
  and not exists (
    select 1
    from public.jury_reviews r
    where r.assignment_id = a.id
      and r.tenant_id = a.tenant_id
      and r.submission_id = a.submission_id
      and r.juror_user_id = a.juror_user_id
      and r.status = 'submitted'
      and r.submitted_at is not null
  );

-- K. Required preflight objects for migration 095
select
  to_regclass('public.jury_assignments') is not null
    as jury_assignments_exists,
  to_regclass('public.jury_reviews') is not null
    as jury_reviews_exists,
  to_regprocedure(
    'public.submit_criterion_jury_review(uuid,text,text)'
  ) is not null as submit_rpc_exists,
  exists (
    select 1
    from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'jury_assignments'
      and p.policyname = 'jury_assignments_juror_update'
      and p.cmd = 'UPDATE'
  ) as expected_juror_update_policy_exists;

rollback;
