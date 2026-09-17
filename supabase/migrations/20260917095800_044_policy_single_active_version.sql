-- Film Festival OS™
-- Policy Register™
-- Only one APPROVED version of a policy may be active.
-- Approving a new version automatically supersedes the old approved version.

alter table public.governance_policies
  add column if not exists superseded_by_policy_id uuid
    references public.governance_policies(id)
    on delete restrict;

alter table public.governance_policies
  add column if not exists superseded_at timestamptz;


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
  v_previous public.governance_policies%rowtype;
  v_aal text;
  v_superseded_count integer := 0;
begin
  if p_status not in ('approved','retired') then
    raise exception
      'Invalid policy transition.';
  end if;

  select *
  into v_policy
  from public.governance_policies
  where id = p_policy_id
  for update;

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


  -- ==========================================================
  -- APPROVAL
  -- ==========================================================

  if p_status = 'approved' then

    if v_policy.status <> 'draft' then
      raise exception
        'Only draft policies can be approved.';
    end if;

    -- Retire any currently-approved earlier version
    -- of the SAME policy code.

    for v_previous in
      select *
      from public.governance_policies
      where tenant_id = v_policy.tenant_id
        and policy_code = v_policy.policy_code
        and status = 'approved'
        and id <> v_policy.id
      for update
    loop

      update public.governance_policies
      set
        status = 'retired',
        superseded_by_policy_id = v_policy.id,
        superseded_at = now(),
        updated_at = now()
      where id = v_previous.id;

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
        v_previous.tenant_id,
        auth.uid(),
        'governance.policy_superseded',
        'governance_policy',
        v_previous.id,
        jsonb_build_object(
          'policy_code', v_previous.policy_code,
          'superseded_version', v_previous.version,
          'superseded_by_policy_id', v_policy.id,
          'superseded_by_version', v_policy.version,
          'actor_aal', v_aal
        ),
        now()
      );

      v_superseded_count :=
        v_superseded_count + 1;

    end loop;


    update public.governance_policies
    set
      status = 'approved',
      approved_by_user_id = auth.uid(),
      approved_at = now(),
      effective_date = coalesce(
        effective_date,
        current_date
      ),
      superseded_by_policy_id = null,
      superseded_at = null,
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
      'governance.policy_approved',
      'governance_policy',
      v_policy.id,
      jsonb_build_object(
        'policy_code', v_policy.policy_code,
        'version', v_policy.version,
        'status', v_policy.status,
        'superseded_versions', v_superseded_count,
        'actor_aal', v_aal
      ),
      now()
    );

    return v_policy;
  end if;


  -- ==========================================================
  -- MANUAL RETIREMENT
  -- ==========================================================

  if v_policy.status <> 'approved' then
    raise exception
      'Only approved policies can be retired.';
  end if;

  update public.governance_policies
  set
    status = 'retired',
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
    'governance.policy_retired',
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
on function public.set_governance_policy_status(uuid,text)
from public;

grant execute
on function public.set_governance_policy_status(uuid,text)
to authenticated;


-- Database safety net:
-- physically prevents two APPROVED versions of the same policy.

create unique index if not exists
governance_policies_one_active_approved_version_idx
on public.governance_policies(
  tenant_id,
  policy_code
)
where status = 'approved';
