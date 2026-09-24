-- Film Festival OS™
-- Migration 094 — Project and Task tenant security
-- Preserve the verified Project Management database repair.
-- No direct grants are added to tenants or payment-policy tables.

begin;

-- Verify the expected security foundation.
do $$
begin
  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.projects'::regclass
  ) or not (
    select relrowsecurity
    from pg_class
    where oid = 'public.tasks'::regclass
  ) then
    raise exception 'STOP: Projects/Tasks RLS is not enabled.';
  end if;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and (
        (tablename = 'projects'
         and policyname in ('projects_select', 'projects_write'))
        or
        (tablename = 'tasks'
         and policyname in ('tasks_select', 'tasks_write'))
      )
  ) <> 4 then
    raise exception 'STOP: Expected Project/Task policies changed.';
  end if;

  if exists (
    select 1
    from public.tasks t
    join public.projects p on p.id = t.project_id
    where t.tenant_id is distinct from p.tenant_id
  ) then
    raise exception 'STOP: Cross-tenant task links need review.';
  end if;
end $$;

-- Add constraints only when absent. Check existing definitions.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.projects'::regclass
      and conname = 'projects_id_tenant_uniq'
  ) then
    alter table public.projects
      add constraint projects_id_tenant_uniq
      unique (id, tenant_id);
  elsif not exists (
    select 1 from pg_constraint
    where conrelid = 'public.projects'::regclass
      and conname = 'projects_id_tenant_uniq'
      and pg_get_constraintdef(oid)
          = 'UNIQUE (id, tenant_id)'
  ) then
    raise exception 'STOP: Existing project constraint differs.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_project_tenant_fk'
  ) then
    alter table public.tasks
      add constraint tasks_project_tenant_fk
      foreign key (project_id, tenant_id)
      references public.projects(id, tenant_id)
      on delete cascade;
  elsif not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_project_tenant_fk'
      and pg_get_constraintdef(oid) like
        'FOREIGN KEY (project_id, tenant_id) REFERENCES %projects(id, tenant_id) ON DELETE CASCADE%'
  ) then
    raise exception 'STOP: Existing task constraint differs.';
  end if;
end $$;

-- Read access requires tenant membership or Platform Admin.
alter policy projects_select on public.projects
  using (
    public.is_platform_admin()
    or public.has_tenant_role(tenant_id)
  );

alter policy tasks_select on public.tasks
  using (
    public.is_platform_admin()
    or public.has_tenant_role(tenant_id)
  );

-- Tenant operators can manage work.
-- Creators can manage their own records only in authorised tenants.
alter policy projects_write on public.projects
  using (
    public.is_platform_admin()
    or public.has_tenant_role(
      tenant_id, array['festival_owner', 'festival_staff']
    )
    or (
      owner_id = auth.uid()
      and public.has_tenant_role(tenant_id, array['creator'])
    )
  )
  with check (
    public.is_platform_admin()
    or public.has_tenant_role(
      tenant_id, array['festival_owner', 'festival_staff']
    )
    or (
      owner_id = auth.uid()
      and public.has_tenant_role(tenant_id, array['creator'])
    )
  );

alter policy tasks_write on public.tasks
  using (
    public.is_platform_admin()
    or public.has_tenant_role(
      tenant_id, array['festival_owner', 'festival_staff']
    )
    or (
      owner_id = auth.uid()
      and public.has_tenant_role(tenant_id, array['creator'])
    )
  )
  with check (
    public.is_platform_admin()
    or public.has_tenant_role(
      tenant_id, array['festival_owner', 'festival_staff']
    )
    or (
      owner_id = auth.uid()
      and public.has_tenant_role(tenant_id, array['creator'])
    )
  );

-- Table grants allow authorised RLS policies to be evaluated.
-- DELETE is deliberately not granted.
grant insert, update
on public.projects, public.tasks
to authenticated;

commit;
