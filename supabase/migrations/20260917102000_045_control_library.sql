-- Film Festival OS™
-- BLOCK 043 — Control Library™

create table if not exists public.governance_controls (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  control_code text not null,

  title text not null,
  purpose text not null,

  owner_user_id uuid not null
    references auth.users(id),

  status text not null default 'designed'
    check (
      status in (
        'designed',
        'implemented',
        'tested',
        'failed',
        'remediation_required',
        'closed'
      )
    ),

  linked_risk_id uuid,
  linked_obligation_ref text,

  implementation_notes text,
  next_review_due date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    tenant_id,
    control_code
  )
);

create index if not exists
governance_controls_tenant_status_idx
on public.governance_controls(
  tenant_id,
  status,
  next_review_due
);

alter table public.governance_controls
enable row level security;

drop policy if exists governance_controls_select
on public.governance_controls;

create policy governance_controls_select
on public.governance_controls
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
on table public.governance_controls
from authenticated;

grant select
on table public.governance_controls
to authenticated;


-- ============================================================
-- REGISTER
-- ============================================================

create or replace function public.control_library_register(
  p_tenant_id uuid
)
returns setof public.governance_controls
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
      'Permission denied: control administration required.';
  end if;

  return query
  select c.*
  from public.governance_controls c
  where c.tenant_id = p_tenant_id
  order by
    case c.status
      when 'failed' then 0
      when 'remediation_required' then 1
      when 'designed' then 2
      when 'implemented' then 3
      when 'tested' then 4
      else 5
    end,
    c.title,
    c.created_at desc;

end;
$$;

revoke all
on function public.control_library_register(uuid)
from public;

grant execute
on function public.control_library_register(uuid)
to authenticated;


-- ============================================================
-- CREATE CONTROL
-- ============================================================

create or replace function public.create_governance_control(
  p_tenant_id uuid,
  p_title text,
  p_purpose text,
  p_linked_risk_id uuid default null,
  p_linked_obligation_ref text default null
)
returns public.governance_controls
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_control public.governance_controls%rowtype;
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
      'Permission denied: control administration required.';
  end if;

  if trim(coalesce(p_title,'')) = '' then
    raise exception 'Control title is required.';
  end if;

  if trim(coalesce(p_purpose,'')) = '' then
    raise exception 'Control purpose is required.';
  end if;

  v_code :=
    'CTRL-' ||
    upper(
      substr(
        replace(gen_random_uuid()::text,'-',''),
        1,
        8
      )
    );

  insert into public.governance_controls (
    tenant_id,
    control_code,
    title,
    purpose,
    owner_user_id,
    status,
    linked_risk_id,
    linked_obligation_ref,
    next_review_due
  )
  values (
    p_tenant_id,
    v_code,
    trim(p_title),
    trim(p_purpose),
    auth.uid(),
    'designed',
    p_linked_risk_id,
    nullif(trim(coalesce(p_linked_obligation_ref,'')), ''),
    current_date + 365
  )
  returning *
  into v_control;

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
    'governance.control_created',
    'governance_control',
    v_control.id,
    jsonb_build_object(
      'control_code', v_control.control_code,
      'title', v_control.title,
      'status', v_control.status
    ),
    now()
  );

  return v_control;

end;
$$;

revoke all
on function public.create_governance_control(
  uuid,text,text,uuid,text
)
from public;

grant execute
on function public.create_governance_control(
  uuid,text,text,uuid,text
)
to authenticated;


-- ============================================================
-- STATUS CHANGE
-- ============================================================

create or replace function public.set_governance_control_status(
  p_control_id uuid,
  p_status text,
  p_notes text default null
)
returns public.governance_controls
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_control public.governance_controls%rowtype;
  v_aal text;
begin

  if p_status not in (
    'designed',
    'implemented',
    'tested',
    'failed',
    'remediation_required',
    'closed'
  ) then
    raise exception
      'Invalid control status.';
  end if;

  select *
  into v_control
  from public.governance_controls
  where id = p_control_id
  for update;

  if not found then
    raise exception 'Control not found.';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_role(
      v_control.tenant_id,
      array['festival_owner']
    )
  ) then
    raise exception
      'Permission denied: control administration required.';
  end if;

  v_aal := coalesce(
    auth.jwt() ->> 'aal',
    'unknown'
  );

  if p_status in (
    'tested',
    'failed',
    'remediation_required',
    'closed'
  )
  and v_aal <> 'aal2' then
    raise exception
      'MFA step-up required for assurance-sensitive control status changes.';
  end if;

  update public.governance_controls
  set
    status = p_status,
    implementation_notes =
      case
        when nullif(trim(coalesce(p_notes,'')), '') is not null
          then trim(p_notes)
        else implementation_notes
      end,
    updated_at = now()
  where id = p_control_id
  returning *
  into v_control;

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
    v_control.tenant_id,
    auth.uid(),
    'governance.control_status_changed',
    'governance_control',
    v_control.id,
    jsonb_build_object(
      'control_code', v_control.control_code,
      'status', v_control.status,
      'actor_aal', v_aal
    ),
    now()
  );

  return v_control;

end;
$$;

revoke all
on function public.set_governance_control_status(
  uuid,text,text
)
from public;

grant execute
on function public.set_governance_control_status(
  uuid,text,text
)
to authenticated;


-- ============================================================
-- DELETE DESIGNED CONTROL ONLY
-- ============================================================

create or replace function public.delete_governance_control_draft(
  p_control_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_control public.governance_controls%rowtype;
  v_aal text;
begin

  select *
  into v_control
  from public.governance_controls
  where id = p_control_id;

  if not found then
    raise exception 'Control not found.';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_role(
      v_control.tenant_id,
      array['festival_owner']
    )
  ) then
    raise exception
      'Permission denied: control administration required.';
  end if;

  v_aal := coalesce(
    auth.jwt() ->> 'aal',
    'unknown'
  );

  if v_aal <> 'aal2' then
    raise exception
      'MFA step-up required: deleting a designed control requires AAL2.';
  end if;

  if v_control.status <> 'designed' then
    raise exception
      'Only controls in DESIGNED status can be deleted.';
  end if;

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
    v_control.tenant_id,
    auth.uid(),
    'governance.control_deleted',
    'governance_control',
    v_control.id,
    jsonb_build_object(
      'control_code', v_control.control_code,
      'title', v_control.title,
      'status', v_control.status,
      'actor_aal', v_aal
    ),
    now()
  );

  delete from public.governance_controls
  where id = p_control_id;

  return true;

end;
$$;

revoke all
on function public.delete_governance_control_draft(uuid)
from public;

grant execute
on function public.delete_governance_control_draft(uuid)
to authenticated;
