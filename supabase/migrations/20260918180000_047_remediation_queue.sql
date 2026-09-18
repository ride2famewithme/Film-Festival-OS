-- Film Festival OS™
-- Migration 047 — Remediation Queue™
--
-- Assurance failure / exception -> remediation -> retest -> closure.
--
-- A remediation may NOT be finally closed unless:
-- 1. corrective action is recorded,
-- 2. closure evidence is recorded,
-- 3. a later PASSED assurance test exists for the same control,
-- 4. the closing session is AAL2 authenticated.

create table if not exists public.control_remediations (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  control_id uuid not null
    references public.governance_controls(id) on delete cascade,

  source_assurance_id uuid not null
    references public.control_assurance_tests(id) on delete cascade,

  remediation_code text not null,

  priority text not null default 'medium'
    check (
      priority in (
        'low',
        'medium',
        'high',
        'critical'
      )
    ),

  status text not null default 'open'
    check (
      status in (
        'open',
        'in_progress',
        'ready_for_retest',
        'closed'
      )
    ),

  owner_user_id uuid
    references auth.users(id),

  due_date date,

  corrective_action text,

  closure_evidence text,

  closing_assurance_id uuid
    references public.control_assurance_tests(id),

  closed_by_user_id uuid
    references auth.users(id),

  closed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    tenant_id,
    remediation_code
  ),

  unique (
    source_assurance_id
  )
);

create index if not exists
control_remediations_tenant_status_idx
on public.control_remediations (
  tenant_id,
  status,
  priority,
  due_date
);

create index if not exists
control_remediations_control_idx
on public.control_remediations (
  control_id,
  created_at desc
);

alter table public.control_remediations
enable row level security;

drop policy if exists control_remediations_select
on public.control_remediations;

create policy control_remediations_select
on public.control_remediations
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
on table public.control_remediations
from authenticated;

grant select
on table public.control_remediations
to authenticated;


-- ============================================================
-- AUTOMATIC REMEDIATION CREATION
-- ============================================================

create or replace function public.create_remediation_from_assurance()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_remediation_id uuid;
  v_code text;
begin
  if new.result not in ('failed','exception') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.result = new.result then
    return new;
  end if;

  if exists (
    select 1
    from public.control_remediations r
    where r.source_assurance_id = new.id
  ) then
    return new;
  end if;

  v_code :=
    'REM-' ||
    upper(
      substr(
        replace(gen_random_uuid()::text,'-',''),
        1,
        8
      )
    );

  insert into public.control_remediations (
    tenant_id,
    control_id,
    source_assurance_id,
    remediation_code,
    priority,
    status,
    owner_user_id,
    due_date
  )
  values (
    new.tenant_id,
    new.control_id,
    new.id,
    v_code,
    case
      when new.result = 'failed'
        then 'high'
      else 'medium'
    end,
    'open',
    null,
    new.retest_due
  )
  returning id
  into v_remediation_id;

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
    new.tenant_id,
    coalesce(
      new.reviewer_user_id,
      auth.uid()
    ),
    'governance.remediation_created',
    'control_remediation',
    v_remediation_id,
    jsonb_build_object(
      'source_assurance_id', new.id,
      'control_id', new.control_id,
      'assurance_result', new.result,
      'priority',
        case
          when new.result = 'failed'
            then 'high'
          else 'medium'
        end,
      'retest_due', new.retest_due
    ),
    now()
  );

  return new;
end;
$$;

drop trigger if exists
control_assurance_create_remediation
on public.control_assurance_tests;

create trigger control_assurance_create_remediation
after insert or update of result
on public.control_assurance_tests
for each row
execute function public.create_remediation_from_assurance();


-- ============================================================
-- REMEDIATION QUEUE REGISTER
-- ============================================================

create or replace function public.remediation_queue(
  p_tenant_id uuid
)
returns table (
  remediation_id uuid,
  remediation_tenant_id uuid,

  remediation_code text,
  priority text,
  remediation_status text,

  control_id uuid,
  control_code text,
  control_title text,

  source_assurance_id uuid,
  source_test_code text,
  source_result text,
  source_reviewed_at timestamptz,

  source_finding text,
  retest_due date,

  owner_user_id uuid,
  owner_email text,

  due_date date,
  corrective_action text,
  closure_evidence text,

  closing_assurance_id uuid,
  closing_test_code text,

  closed_by_user_id uuid,
  closed_at timestamptz,

  created_at timestamptz,
  updated_at timestamptz
)
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
      'Permission denied: remediation administration required.';
  end if;

  return query
  select
    r.id,
    r.tenant_id,

    r.remediation_code,
    r.priority,
    r.status,

    r.control_id,
    c.control_code,
    c.title,

    r.source_assurance_id,
    a.test_code,
    a.result,
    a.reviewed_at,

    a.exception_notes,
    a.retest_due,

    r.owner_user_id,
    owner_user.email::text,

    r.due_date,
    r.corrective_action,
    r.closure_evidence,

    r.closing_assurance_id,
    closing_test.test_code,

    r.closed_by_user_id,
    r.closed_at,

    r.created_at,
    r.updated_at

  from public.control_remediations r

  join public.governance_controls c
    on c.id = r.control_id
   and c.tenant_id = r.tenant_id

  join public.control_assurance_tests a
    on a.id = r.source_assurance_id

  left join auth.users owner_user
    on owner_user.id = r.owner_user_id

  left join public.control_assurance_tests closing_test
    on closing_test.id = r.closing_assurance_id

  where r.tenant_id = p_tenant_id

  order by
    case r.status
      when 'open' then 0
      when 'in_progress' then 1
      when 'ready_for_retest' then 2
      else 3
    end,
    case r.priority
      when 'critical' then 0
      when 'high' then 1
      when 'medium' then 2
      else 3
    end,
    r.due_date nulls last,
    r.created_at desc;
end;
$$;

revoke all
on function public.remediation_queue(uuid)
from public;

grant execute
on function public.remediation_queue(uuid)
to authenticated;


-- ============================================================
-- UPDATE REMEDIATION
-- ============================================================

create or replace function public.update_control_remediation(
  p_remediation_id uuid,
  p_priority text,
  p_due_date date,
  p_corrective_action text,
  p_status text
)
returns public.control_remediations
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.control_remediations%rowtype;
begin
  select *
  into v_row
  from public.control_remediations
  where id = p_remediation_id;

  if not found then
    raise exception
      'Remediation item not found.';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_role(
      v_row.tenant_id,
      array['festival_owner']
    )
  ) then
    raise exception
      'Permission denied: remediation administration required.';
  end if;

  if p_priority not in (
    'low',
    'medium',
    'high',
    'critical'
  ) then
    raise exception
      'Invalid remediation priority.';
  end if;

  if p_status not in (
    'open',
    'in_progress',
    'ready_for_retest'
  ) then
    raise exception
      'Invalid remediation lifecycle status.';
  end if;

  if p_status in (
    'in_progress',
    'ready_for_retest'
  )
  and trim(
    coalesce(p_corrective_action,'')
  ) = '' then
    raise exception
      'Corrective action is required.';
  end if;

  if p_status = 'ready_for_retest'
     and p_due_date is null then
    raise exception
      'Due / retest date is required before marking READY FOR RETEST.';
  end if;

  update public.control_remediations
  set
    priority = p_priority,
    due_date = p_due_date,
    corrective_action =
      nullif(
        trim(
          coalesce(
            p_corrective_action,
            ''
          )
        ),
        ''
      ),
    status = p_status,
    owner_user_id =
      coalesce(
        owner_user_id,
        auth.uid()
      ),
    updated_at = now()
  where id = p_remediation_id
  returning *
  into v_row;

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
    v_row.tenant_id,
    auth.uid(),
    'governance.remediation_updated',
    'control_remediation',
    v_row.id,
    jsonb_build_object(
      'remediation_code',
        v_row.remediation_code,
      'priority',
        v_row.priority,
      'status',
        v_row.status,
      'due_date',
        v_row.due_date
    ),
    now()
  );

  return v_row;
end;
$$;

revoke all
on function public.update_control_remediation(
  uuid,
  text,
  date,
  text,
  text
)
from public;

grant execute
on function public.update_control_remediation(
  uuid,
  text,
  date,
  text,
  text
)
to authenticated;


-- ============================================================
-- CLOSE REMEDIATION
-- ============================================================

create or replace function public.close_control_remediation(
  p_remediation_id uuid,
  p_closure_evidence text
)
returns public.control_remediations
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.control_remediations%rowtype;
  v_source public.control_assurance_tests%rowtype;
  v_retest public.control_assurance_tests%rowtype;
  v_aal text;
begin
  select *
  into v_row
  from public.control_remediations
  where id = p_remediation_id;

  if not found then
    raise exception
      'Remediation item not found.';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_role(
      v_row.tenant_id,
      array['festival_owner']
    )
  ) then
    raise exception
      'Permission denied: remediation administration required.';
  end if;

  if v_row.status <> 'ready_for_retest' then
    raise exception
      'Remediation must be READY FOR RETEST before closure.';
  end if;

  if trim(
    coalesce(
      v_row.corrective_action,
      ''
    )
  ) = '' then
    raise exception
      'Corrective action is required before closure.';
  end if;

  if trim(
    coalesce(
      p_closure_evidence,
      ''
    )
  ) = '' then
    raise exception
      'Closure evidence is required.';
  end if;

  select *
  into v_source
  from public.control_assurance_tests
  where id = v_row.source_assurance_id;

  if not found then
    raise exception
      'Source assurance test not found.';
  end if;

  select *
  into v_retest
  from public.control_assurance_tests
  where tenant_id = v_row.tenant_id
    and control_id = v_row.control_id
    and result = 'passed'
    and id <> v_row.source_assurance_id
    and reviewed_at is not null
    and reviewed_at >
      coalesce(
        v_source.reviewed_at,
        v_source.created_at
      )
  order by reviewed_at desc
  limit 1;

  if not found then
    raise exception
      'Closure blocked: a later PASSED assurance retest is required.';
  end if;

  v_aal := coalesce(
    auth.jwt() ->> 'aal',
    'unknown'
  );

  if v_aal <> 'aal2' then
    raise exception
      'MFA step-up required: remediation closure requires AAL2.';
  end if;

  update public.control_remediations
  set
    status = 'closed',
    closure_evidence =
      trim(p_closure_evidence),
    closing_assurance_id =
      v_retest.id,
    closed_by_user_id =
      auth.uid(),
    closed_at = now(),
    updated_at = now()
  where id = p_remediation_id
  returning *
  into v_row;

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
    v_row.tenant_id,
    auth.uid(),
    'governance.remediation_closed',
    'control_remediation',
    v_row.id,
    jsonb_build_object(
      'remediation_code',
        v_row.remediation_code,
      'source_assurance_id',
        v_row.source_assurance_id,
      'closing_assurance_id',
        v_retest.id,
      'closing_test_code',
        v_retest.test_code,
      'actor_aal',
        v_aal
    ),
    now()
  );

  return v_row;
end;
$$;

revoke all
on function public.close_control_remediation(
  uuid,
  text
)
from public;

grant execute
on function public.close_control_remediation(
  uuid,
  text
)
to authenticated;
