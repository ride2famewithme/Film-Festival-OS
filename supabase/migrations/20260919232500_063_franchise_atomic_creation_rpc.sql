-- Film Festival OS™ v4.0
-- Migration 063 — Atomic Franchise / Operator Creation RPC
--
-- Creates the tenant, franchise profile, onboarding checklist and audit
-- record in one database transaction.
--
-- Migration 062 remains the authoritative hierarchy validator.

create or replace function public.create_franchise_operator(
  p_name text,
  p_franchise_level text,
  p_territory_name text,
  p_parent_tenant_id uuid,
  p_continent_name text default null,
  p_country_name text default null,
  p_country_code text default null,
  p_region_name text default null,
  p_city_name text default null,
  p_exclusive_territory boolean default false,
  p_population_reference integer default null,
  p_notes text default null
)
returns table (
  new_tenant_id uuid,
  new_profile_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_type text;
  v_tenant_id uuid;
  v_profile_id uuid;
  v_name text;
  v_territory text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if not public.is_platform_admin() then
    raise exception 'Platform Admin permission required'
      using errcode = '42501';
  end if;

  v_name := nullif(btrim(p_name), '');
  v_territory := nullif(btrim(p_territory_name), '');

  if v_name is null then
    raise exception 'Tenant / operator name is required'
      using errcode = '23514';
  end if;

  if v_territory is null then
    raise exception 'Territory name is required'
      using errcode = '23514';
  end if;

  if p_population_reference is not null
     and p_population_reference < 0 then
    raise exception 'Population reference cannot be negative'
      using errcode = '23514';
  end if;

  case p_franchise_level
    when 'continent_master' then
      v_tenant_type := 'territory';

    when 'country_master' then
      v_tenant_type := 'territory';

    when 'region_master' then
      v_tenant_type := 'territory';

    when 'capital_city' then
      v_tenant_type := 'territory';

    when 'global_pool' then
      v_tenant_type := 'territory';

    when 'city_operator' then
      v_tenant_type := 'operator';

    when 'festival_operator' then
      v_tenant_type := 'festival';

    when 'global_master' then
      raise exception
        'GLOBAL MASTER is created separately through the HQ bootstrap control'
        using errcode = '23514';

    else
      raise exception
        'Unknown franchise level: %',
        p_franchise_level
        using errcode = '23514';
  end case;

  if p_parent_tenant_id is null then
    raise exception
      'Franchise level % requires a parent tenant',
      p_franchise_level
      using errcode = '23514';
  end if;

  insert into public.tenants (
    name,
    type,
    territory,
    parent_tenant_id
  )
  values (
    v_name,
    v_tenant_type,
    v_territory,
    p_parent_tenant_id
  )
  returning id into v_tenant_id;

  -- Migration 062 validates tenant type + parent hierarchy.
  -- Any exception here rolls back the tenant insert above.
  perform public.validate_franchise_hierarchy(
    v_tenant_id,
    p_franchise_level
  );

  insert into public.franchise_profiles (
    tenant_id,
    franchise_level,
    territory_name,
    continent_name,
    country_name,
    country_code,
    region_name,
    city_name,
    status,
    exclusive_territory,
    population_reference,
    notes
  )
  values (
    v_tenant_id,
    p_franchise_level,
    v_territory,
    nullif(btrim(p_continent_name), ''),
    nullif(btrim(p_country_name), ''),
    nullif(upper(btrim(p_country_code)), ''),
    nullif(btrim(p_region_name), ''),
    nullif(btrim(p_city_name), ''),
    'onboarding',
    coalesce(p_exclusive_territory, false),
    p_population_reference,
    nullif(btrim(p_notes), '')
  )
  returning id into v_profile_id;

  insert into public.franchise_onboarding_steps (
    tenant_id,
    step_key,
    label,
    status
  )
  select
    v_tenant_id,
    seed.step_key,
    seed.label,
    'pending'
  from (
    values
      ('territory_profile',  'Confirm territory profile'),
      ('agreement_record',   'Record executed agreement reference'),
      ('operator_access',    'Create operator access'),
      ('brand_pack',         'Issue approved brand pack'),
      ('training_complete',  'Complete operator training'),
      ('festival_setup',     'Configure first festival workspace'),
      ('compliance_pack',    'Issue compliance and governance pack'),
      ('launch_readiness',   'Complete launch-readiness review')
  ) as seed(step_key, label);

  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    detail
  )
  values (
    v_tenant_id,
    auth.uid(),
    'franchise.operator_created',
    'franchise_profile',
    v_profile_id,
    jsonb_build_object(
      'tenantName', v_name,
      'franchiseLevel', p_franchise_level,
      'territory', v_territory,
      'parentTenantId', p_parent_tenant_id
    )
  );

  return query
  select v_tenant_id, v_profile_id;
end;
$$;

revoke all
  on function public.create_franchise_operator(
    text,
    text,
    text,
    uuid,
    text,
    text,
    text,
    text,
    text,
    boolean,
    integer,
    text
  )
  from public, anon, authenticated;

grant execute
  on function public.create_franchise_operator(
    text,
    text,
    text,
    uuid,
    text,
    text,
    text,
    text,
    text,
    boolean,
    integer,
    text
  )
  to authenticated;

comment on function public.create_franchise_operator(
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  boolean,
  integer,
  text
)
is
'Film Festival OS™ controlled atomic creation of a franchise/operator tenant, franchise profile, onboarding checklist and audit record. Platform Admin only.';
