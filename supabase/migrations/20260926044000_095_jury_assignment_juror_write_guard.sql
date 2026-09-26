-- Film Festival OS™ — migration 095
-- Juror assignment write boundary. Staged only; do not apply without DB QA.
-- No payment, membership, jury-score or RLS policy changes.
--
-- Keep the existing legitimate review workflows:
--   * submit_criterion_jury_review() completes an assignment as a trusted RPC.
--   * the legacy client completes an assignment after inserting a submitted review.
-- A direct juror UPDATE may do only assigned -> completed, after their
-- matching submitted review exists. Managers and trusted database operations
-- retain the existing behaviour. Submitted-review immutability is a separate gate.

begin;

do $preflight$
begin
  if not (
    select c.relrowsecurity
    from pg_catalog.pg_class c
    where c.oid = 'public.jury_assignments'::pg_catalog.regclass
  ) then
    raise exception 'STOP 095: jury_assignments RLS is not enabled.';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'jury_assignments'
      and p.policyname = 'jury_assignments_juror_update'
      and p.cmd = 'UPDATE'
  ) then
    raise exception 'STOP 095: Expected juror assignment update policy changed.';
  end if;

  if pg_catalog.to_regprocedure(
    'public.submit_criterion_jury_review(uuid,text,text)'
  ) is null then
    raise exception 'STOP 095: Criterion review submission RPC is missing.';
  end if;
end;
$preflight$;

create or replace function public.guard_juror_assignment_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $guard$
begin
  -- Trusted migrations/maintenance, service-role workers and existing
  -- authorised owners/Platform Admins retain their current write paths.
  -- Security INVOKER is important: direct PostgREST calls run as authenticated;
  -- SECURITY DEFINER review RPCs and panel-sync triggers run as their owner.
  if current_user = 'postgres'
     or auth.role() = 'service_role'
     or public.is_platform_admin()
     or public.has_tenant_role(
       old.tenant_id, array['festival_owner']
     )
  then
    return new;
  end if;

  if auth.uid() is distinct from old.juror_user_id
     or not public.has_tenant_role(
       old.tenant_id, array['juror']
     )
  then
    raise exception
      'Permission denied: jury assignment management requires an authorised role.'
      using errcode = '42501';
  end if;

  -- Every column except status must remain unchanged for a direct juror write.
  -- Covers panel/weight, conflict, identity, tenant, season, submission,
  -- scoring form, timestamps and future columns without a denylist.
  if (to_jsonb(new) - 'status') is distinct from
     (to_jsonb(old) - 'status')
  then
    raise exception
      'Permission denied: jurors may not change assignment governance fields.'
      using errcode = '42501';
  end if;

  if old.status is distinct from 'assigned'
     or new.status is distinct from 'completed'
  then
    raise exception
      'Permission denied: only assigned-to-completed is allowed for jurors.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.jury_reviews r
    where r.assignment_id = old.id
      and r.tenant_id = old.tenant_id
      and r.submission_id = old.submission_id
      and r.juror_user_id = auth.uid()
      and r.status = 'submitted'
      and r.submitted_at is not null
  ) then
    raise exception
      'Jury assignment cannot be completed without its submitted review.'
      using errcode = '42501';
  end if;

  return new;
end;
$guard$;

revoke all on function public.guard_juror_assignment_update() from public;
grant execute on function public.guard_juror_assignment_update()
  to authenticated, service_role;

drop trigger if exists trg_guard_juror_assignment_update
  on public.jury_assignments;

create trigger trg_guard_juror_assignment_update
before update on public.jury_assignments
for each row
execute function public.guard_juror_assignment_update();

commit;
