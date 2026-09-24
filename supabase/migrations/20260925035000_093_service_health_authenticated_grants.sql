-- Film Festival OS™
-- Migration 093 — System Health authenticated grants
-- Existing RLS continues to restrict access to Platform Admins.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_policies p
    join pg_class c
      on c.oid = 'public.service_health_checks'::regclass
    where p.schemaname = 'public'
      and p.tablename = 'service_health_checks'
      and p.policyname = 'health_admin'
      and p.cmd = 'ALL'
      and p.qual = 'is_platform_admin()'
      and p.with_check = 'is_platform_admin()'
      and c.relrowsecurity = true
  ) then
    raise exception
      'Expected Platform Admin health RLS policy not found.';
  end if;
end $$;

grant select, insert, update
on table public.service_health_checks
to authenticated;

commit;
