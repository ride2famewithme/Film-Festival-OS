-- Film Festival OS™
-- Policy Register™ corrective control
-- Safe deletion of DRAFT policies only.

create or replace function public.delete_governance_policy_draft(
  p_policy_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_policy public.governance_policies%rowtype;
  v_aal text;
begin
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
      'MFA step-up required: deleting a policy draft requires AAL2.';
  end if;

  if v_policy.status <> 'draft' then
    raise exception
      'Only draft policies can be deleted.';
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
    v_policy.tenant_id,
    auth.uid(),
    'governance.policy_draft_deleted',
    'governance_policy',
    v_policy.id,
    jsonb_build_object(
      'policy_code', v_policy.policy_code,
      'title', v_policy.title,
      'version', v_policy.version,
      'status', v_policy.status,
      'actor_aal', v_aal
    ),
    now()
  );

  delete from public.governance_policies
  where id = p_policy_id;

  return true;
end;
$$;

revoke all
on function public.delete_governance_policy_draft(uuid)
from public;

grant execute
on function public.delete_governance_policy_draft(uuid)
to authenticated;
