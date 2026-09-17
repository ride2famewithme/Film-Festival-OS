-- Film Festival OS™
-- Migration 042 — Policy Register™
--
-- Tenant-scoped governance policies with:
-- - policy code + version
-- - owner
-- - approval / retirement lifecycle
-- - next review date
-- - applicable entities
-- - audit evidence
-- - AAL2 required for approval and retirement

create table if not exists public.governance_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  policy_code text not null,
  title text not null,
  summary text,

  version text not null default '1.0',

  status text not null default 'draft'
    check (status in (
      'draft',
      'approved',
      'retired'
    )),

  owner_user_id uuid not null
    references auth.users(id),

  approved_by_user_id uuid
    references auth.users(id),

  approved_at timestamptz,
  effective_date date,
  next_review_due date,

  applicable_entities text not null
    default 'Current tenant',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    tenant_id,
    policy_code,
    version
  )
);

create index if not exists
governance_policies_tenant_status_idx
on public.governance_policies(
  tenant_id,
  status,
  next_review_due
);

alter table public.governance_policies
enable row level security;

drop policy if exists governance_policies_select
on public.governance_policies;

create policy governance_policies_select
on public.governance_policies
for select
to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner']
  )
);

revoke all
on table public.governance_policies
from authenticated;

grant select
on table public.governance_policies
to authenticated;


-- ============================================================
-- POLICY REGISTER
-- ============================================================

create or replace function public.policy_register(
  p_tenant_id uuid
)
returns setof public.governance_policies
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not (
    public.is_platform_admin()
    or public.has_tenant_role(
      p_tenant_id,
      array['festival_owner']
    )
  ) then
    raise exception
      'Permission denied: policy administration required.';
  end if;

  return query
  select p.*
  from public.governance_policies p
  where p.tenant_id = p_tenant_id
  order by
    case p.status
      when 'draft' then 0
      when 'approved' then 1
      else 2
    end,
    p.title,
    p.created_at desc;
end;
$$;

revoke all
on function public.policy_register(uuid)
from public;

grant execute
on function public.policy_register(uuid)
to authenticated;


-- ============================================================
-- CREATE POLICY
-- ============================================================

create or replace function public.create_governance_policy(
  p_tenant_id uuid,
  p_title text,
  p_summary text default null,
  p_version text default '1.0',
  p_applicable_entities text default 'Current tenant'
)
returns public.governance_policies
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_result public.governance_policies%rowtype;
  v_code text;
begin
  if not (
    public.is_platform_admin()
    or public.has_tenant_role(
      p_tenant_id,
      array['festival_owner']
    )
  ) then
    raise exception
      'Permission denied: policy administration required.';
  end if;

  if trim(coalesce(p_title,'')) = '' then
    raise exception 'Policy title is required.';
  end if;

  if trim(coalesce(p_version,'')) = '' then
    raise exception 'Policy version is required.';
  end if;

  v_code :=
    'POL-' ||
    upper(
      substr(
        replace(gen_random_uuid()::text,'-',''),
        1,
        8
      )
    );

  insert into public.governance_policies (
    tenant_id,
    policy_code,
    title,
    summary,
    version,
    status,
    owner_user_id,
    next_review_due,
    applicable_entities
  )
  values (
    p_tenant_id,
    v_code,
    trim(p_title),
    nullif(trim(coalesce(p_summary,'')), ''),
    trim(p_version),
    'draft',
    auth.uid(),
    current_date + 365,
    coalesce(
      nullif(
        trim(coalesce(p_applicable_entities,'')),
        ''
      ),
      'Current tenant'
    )
  )
  returning *
  into v_result;

  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    detail,
    created_at
  )
  values (
    p_tenant_id,
    auth.uid(),
    'governance.policy_created',
    'governance_policy',
    v_result.id,
    jsonb_build_object(
      'policy_code', v_result.policy_code,
      'title', v_result.title,
      'version', v_result.version,
      'status', v_result.status
    ),
    now()
  );

  return v_result;
end;
$$;

revoke all
on function public.create_governance_policy(
  uuid,text,text,text,text
)
from public;

grant execute
on function public.create_governance_policy(
  uuid,text,text,text,text
)
to authenticated;


-- ============================================================
-- APPROVE / RETIRE POLICY
-- ============================================================

create or replace function public.set_governance_policy_status(
  p_policy_id uuid,
  p_status text
)
returns public.governance_policies
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_policy public.governance_policies%rowtype;
  v_aal text;
begin
  if p_status not in ('approved','retired') then
    raise exception
      'Invalid policy transition.';
  end if;

  select *
  into v_policy
  from public.governance_policies
  where id = p_policy_id;

  if not found then
    raise exception 'Policy not found.';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_role(
      v_policy.tenant_id,
      array['festival_owner']
    )
  ) then
    raise exception
      'Permission denied: policy administration required.';
  end if;

  v_aal := coalesce(
    auth.jwt() ->> 'aal',
    'unknown'
  );

  if v_aal <> 'aal2' then
    raise exception
      'MFA step-up required: policy approval or retirement requires AAL2.';
  end if;

  if p_status = 'approved'
     and v_policy.status <> 'draft' then
    raise exception
      'Only draft policies can be approved.';
  end if;

  if p_status = 'retired'
     and v_policy.status <> 'approved' then
    raise exception
      'Only approved policies can be retired.';
  end if;

  update public.governance_policies
  set
    status = p_status,

    approved_by_user_id =
      case
        when p_status = 'approved'
          then auth.uid()
        else approved_by_user_id
      end,

    approved_at =
      case
        when p_status = 'approved'
          then now()
        else approved_at
      end,

    effective_date =
      case
        when p_status = 'approved'
          then coalesce(
            effective_date,
            current_date
          )
        else effective_date
      end,

    updated_at = now()

  where id = p_policy_id

  returning *
  into v_policy;

  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    detail,
    created_at
  )
  values (
    v_policy.tenant_id,
    auth.uid(),
    case
      when p_status = 'approved'
        then 'governance.policy_approved'
      else 'governance.policy_retired'
    end,
    'governance_policy',
    v_policy.id,
    jsonb_build_object(
      'policy_code', v_policy.policy_code,
      'version', v_policy.version,
      'status', v_policy.status,
      'actor_aal', v_aal
    ),
    now()
  );

  return v_policy;
end;
$$;

revoke all
on function public.set_governance_policy_status(
  uuid,text
)
from public;

grant execute
on function public.set_governance_policy_status(
  uuid,text
)
to authenticated;


-- ============================================================
-- CREATE NEW VERSION
-- ============================================================

create or replace function public.create_governance_policy_version(
  p_source_policy_id uuid,
  p_new_version text
)
returns public.governance_policies
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_source public.governance_policies%rowtype;
  v_result public.governance_policies%rowtype;
begin
  if trim(coalesce(p_new_version,'')) = '' then
    raise exception 'New policy version is required.';
  end if;

  select *
  into v_source
  from public.governance_policies
  where id = p_source_policy_id;

  if not found then
    raise exception 'Source policy not found.';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_role(
      v_source.tenant_id,
      array['festival_owner']
    )
  ) then
    raise exception
      'Permission denied: policy administration required.';
  end if;

  if v_source.status <> 'approved'
     and v_source.status <> 'retired' then
    raise exception
      'New versions can be created only from approved or retired policies.';
  end if;

  insert into public.governance_policies (
    tenant_id,
    policy_code,
    title,
    summary,
    version,
    status,
    owner_user_id,
    next_review_due,
    applicable_entities
  )
  values (
    v_source.tenant_id,
    v_source.policy_code,
    v_source.title,
    v_source.summary,
    trim(p_new_version),
    'draft',
    auth.uid(),
    current_date + 365,
    v_source.applicable_entities
  )
  returning *
  into v_result;

  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    detail,
    created_at
  )
  values (
    v_source.tenant_id,
    auth.uid(),
    'governance.policy_version_created',
    'governance_policy',
    v_result.id,
    jsonb_build_object(
      'policy_code', v_result.policy_code,
      'source_policy_id', v_source.id,
      'source_version', v_source.version,
      'new_version', v_result.version
    ),
    now()
  );

  return v_result;
end;
$$;

revoke all
on function public.create_governance_policy_version(
  uuid,text
)
from public;

grant execute
on function public.create_governance_policy_version(
  uuid,text
)
to authenticated;
