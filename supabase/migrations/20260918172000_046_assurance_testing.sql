-- Film Festival OS™
-- Migration 046 — Assurance & Testing™
--
-- Tenant-scoped control assurance records:
-- - control under test
-- - test method
-- - evidence
-- - result
-- - reviewer
-- - exceptions/findings
-- - retest date
-- - AAL2 protected final result
-- - audit evidence

create table if not exists public.control_assurance_tests (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  control_id uuid not null
    references public.governance_controls(id) on delete cascade,

  test_code text not null,

  test_method text not null,

  evidence_summary text,
  evidence_reference text,

  result text not null default 'planned'
    check (
      result in (
        'planned',
        'passed',
        'failed',
        'exception'
      )
    ),

  reviewer_user_id uuid
    references auth.users(id),

  reviewed_at timestamptz,

  exception_notes text,

  retest_due date,

  created_by_user_id uuid not null
    references auth.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    tenant_id,
    test_code
  )
);

create index if not exists
control_assurance_tests_tenant_result_idx
on public.control_assurance_tests (
  tenant_id,
  result,
  retest_due
);

create index if not exists
control_assurance_tests_control_idx
on public.control_assurance_tests (
  control_id,
  created_at desc
);

alter table public.control_assurance_tests
enable row level security;

drop policy if exists control_assurance_tests_select
on public.control_assurance_tests;

create policy control_assurance_tests_select
on public.control_assurance_tests
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
on table public.control_assurance_tests
from authenticated;

grant select
on table public.control_assurance_tests
to authenticated;


-- ============================================================
-- ASSURANCE REGISTER
-- ============================================================

create or replace function public.assurance_test_register(
  p_tenant_id uuid
)
returns table (
  assurance_id uuid,
  assurance_tenant_id uuid,
  control_id uuid,
  control_code text,
  control_title text,
  test_code text,
  test_method text,
  evidence_summary text,
  evidence_reference text,
  result text,
  reviewer_user_id uuid,
  reviewer_email text,
  reviewed_at timestamptz,
  exception_notes text,
  retest_due date,
  created_by_user_id uuid,
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
      'Permission denied: assurance administration required.';
  end if;

  return query
  select
    a.id,
    a.tenant_id,
    a.control_id,
    c.control_code,
    c.title,
    a.test_code,
    a.test_method,
    a.evidence_summary,
    a.evidence_reference,
    a.result,
    a.reviewer_user_id,
    u.email::text,
    a.reviewed_at,
    a.exception_notes,
    a.retest_due,
    a.created_by_user_id,
    a.created_at,
    a.updated_at
  from public.control_assurance_tests a
  join public.governance_controls c
    on c.id = a.control_id
   and c.tenant_id = a.tenant_id
  left join auth.users u
    on u.id = a.reviewer_user_id
  where a.tenant_id = p_tenant_id
  order by
    case a.result
      when 'failed' then 0
      when 'exception' then 1
      when 'planned' then 2
      else 3
    end,
    a.retest_due nulls last,
    a.created_at desc;
end;
$$;

revoke all
on function public.assurance_test_register(uuid)
from public;

grant execute
on function public.assurance_test_register(uuid)
to authenticated;


-- ============================================================
-- CREATE PLANNED ASSURANCE TEST
-- ============================================================

create or replace function public.create_control_assurance_test(
  p_tenant_id uuid,
  p_control_id uuid,
  p_test_method text
)
returns public.control_assurance_tests
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_control public.governance_controls%rowtype;
  v_result public.control_assurance_tests%rowtype;
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
      'Permission denied: assurance administration required.';
  end if;

  if trim(coalesce(p_test_method,'')) = '' then
    raise exception 'Test method is required.';
  end if;

  select *
  into v_control
  from public.governance_controls
  where id = p_control_id
    and tenant_id = p_tenant_id;

  if not found then
    raise exception
      'Control not found in the active tenant.';
  end if;

  v_code :=
    'TST-' ||
    upper(
      substr(
        replace(gen_random_uuid()::text,'-',''),
        1,
        8
      )
    );

  insert into public.control_assurance_tests (
    tenant_id,
    control_id,
    test_code,
    test_method,
    result,
    created_by_user_id
  )
  values (
    p_tenant_id,
    p_control_id,
    v_code,
    trim(p_test_method),
    'planned',
    auth.uid()
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
    'governance.assurance_test_created',
    'control_assurance_test',
    v_result.id,
    jsonb_build_object(
      'test_code', v_result.test_code,
      'control_id', v_result.control_id,
      'control_code', v_control.control_code,
      'result', v_result.result
    ),
    now()
  );

  return v_result;
end;
$$;

revoke all
on function public.create_control_assurance_test(
  uuid,
  uuid,
  text
)
from public;

grant execute
on function public.create_control_assurance_test(
  uuid,
  uuid,
  text
)
to authenticated;


-- ============================================================
-- RECORD FINAL ASSURANCE RESULT
-- ============================================================

create or replace function public.record_control_assurance_result(
  p_assurance_id uuid,
  p_result text,
  p_evidence_summary text,
  p_evidence_reference text default null,
  p_exception_notes text default null,
  p_retest_due date default null
)
returns public.control_assurance_tests
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_test public.control_assurance_tests%rowtype;
  v_aal text;
begin
  if p_result not in (
    'passed',
    'failed',
    'exception'
  ) then
    raise exception
      'Invalid assurance result.';
  end if;

  select *
  into v_test
  from public.control_assurance_tests
  where id = p_assurance_id;

  if not found then
    raise exception
      'Assurance test not found.';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_role(
      v_test.tenant_id,
      array['festival_owner']
    )
  ) then
    raise exception
      'Permission denied: assurance administration required.';
  end if;

  if v_test.result <> 'planned' then
    raise exception
      'Only planned assurance tests can receive a final result.';
  end if;

  if trim(coalesce(p_evidence_summary,'')) = '' then
    raise exception
      'Evidence summary is required.';
  end if;

  if p_result in ('failed','exception')
     and trim(coalesce(p_exception_notes,'')) = '' then
    raise exception
      'Findings or exception notes are required for failed or exception results.';
  end if;

  if p_result in ('failed','exception')
     and p_retest_due is null then
    raise exception
      'Retest date is required for failed or exception results.';
  end if;

  v_aal := coalesce(
    auth.jwt() ->> 'aal',
    'unknown'
  );

  if v_aal <> 'aal2' then
    raise exception
      'MFA step-up required: assurance results require AAL2.';
  end if;

  update public.control_assurance_tests
  set
    result = p_result,
    evidence_summary =
      trim(p_evidence_summary),
    evidence_reference =
      nullif(
        trim(coalesce(p_evidence_reference,'')),
        ''
      ),
    exception_notes =
      nullif(
        trim(coalesce(p_exception_notes,'')),
        ''
      ),
    retest_due = p_retest_due,
    reviewer_user_id = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = p_assurance_id
  returning *
  into v_test;

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
    v_test.tenant_id,
    auth.uid(),
    'governance.assurance_result_recorded',
    'control_assurance_test',
    v_test.id,
    jsonb_build_object(
      'test_code', v_test.test_code,
      'control_id', v_test.control_id,
      'result', v_test.result,
      'retest_due', v_test.retest_due,
      'actor_aal', v_aal
    ),
    now()
  );

  return v_test;
end;
$$;

revoke all
on function public.record_control_assurance_result(
  uuid,
  text,
  text,
  text,
  text,
  date
)
from public;

grant execute
on function public.record_control_assurance_result(
  uuid,
  text,
  text,
  text,
  text,
  date
)
to authenticated;
