-- Film Festival OS™
-- Migration 092 — Platform Configuration authenticated grants
-- RLS continues to restrict platform_settings to Platform Admins.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_policies p
    join pg_class c
      on c.oid = 'public.platform_settings'::regclass
    where p.schemaname = 'public'
      and p.tablename = 'platform_settings'
      and p.policyname = 'settings_admin'
      and p.cmd = 'ALL'
      and p.qual = 'is_platform_admin()'
      and p.with_check = 'is_platform_admin()'
      and c.relrowsecurity = true
  ) then
    raise exception
      'Expected Platform Admin RLS policy not found.';
  end if;
end $$;

grant select, insert, update
on table public.platform_settings
to authenticated;

commit;
