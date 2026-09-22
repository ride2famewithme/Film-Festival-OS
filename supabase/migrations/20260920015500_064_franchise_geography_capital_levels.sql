begin;

-- Film Festival OS™ v4.0
-- Migration 064 — Franchise Geography + Capital Levels
--
-- Adds:
--   regional_capital = STATE / REGIONAL CAPITAL
--   region_code      = state / province / region abbreviation/code
--
-- Existing capital_city is preserved for compatibility and represents:
--   NATIONAL / COUNTRY CAPITAL
--
-- Examples:
--   Australia -> Canberra                   = capital_city
--   Australia -> Queensland -> Brisbane    = regional_capital
--   USA -> California (CA) -> Sacramento   = regional_capital

alter table public.franchise_profiles
  add column if not exists region_code text;

alter table public.franchise_profiles
  drop constraint if exists franchise_profiles_franchise_level_check;

alter table public.franchise_profiles
  add constraint franchise_profiles_franchise_level_check
  check (
    franchise_level in (
      'global_master',
      'continent_master',
      'country_master',
      'region_master',
      'capital_city',
      'regional_capital',
      'city_operator',
      'festival_operator',
      'global_pool'
    )
  );


-- ============================================================
-- AUTHORITATIVE HIERARCHY VALIDATOR
-- ============================================================

create or replace function public.validate_franchise_hierarchy(
  p_tenant_id uuid,
  p_level text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_type text;
  v_parent_tenant_id uuid;
  v_parent_level text;
begin
  select type, parent_tenant_id
    into v_tenant_type, v_parent_tenant_id
  from public.tenants
  where id = p_tenant_id;

  if not found then
    raise exception
      'Franchise tenant does not exist: %',
      p_tenant_id
      using errcode = '23514';
  end if;

  -- GLOBAL MASTER
  if p_level = 'global_master' then
    if v_tenant_type <> 'hq' then
      raise exception
        'GLOBAL MASTER must use an HQ tenant'
        using errcode = '23514';
    end if;

    if v_parent_tenant_id is not null then
      raise exception
        'GLOBAL MASTER cannot have a parent tenant'
        using errcode = '23514';
    end if;

    return;
  end if;

  -- All remaining franchise levels require a parent.
  if v_parent_tenant_id is null then
    raise exception
      'Franchise level % requires a parent tenant',
      p_level
      using errcode = '23514';
  end if;

  select franchise_level
    into v_parent_level
  from public.franchise_profiles
  where tenant_id = v_parent_tenant_id;

  if v_parent_level is null then
    raise exception
      'Parent tenant must have a franchise profile first'
      using errcode = '23514';
  end if;

  case p_level

    when 'continent_master' then
      if v_tenant_type <> 'territory'
         or v_parent_level <> 'global_master'
      then
        raise exception
          'CONTINENT MASTER must be a TERRITORY beneath GLOBAL MASTER'
          using errcode = '23514';
      end if;

    when 'country_master' then
      if v_tenant_type <> 'territory'
         or v_parent_level not in (
           'continent_master',
           'global_master'
         )
      then
        raise exception
          'COUNTRY MASTER must be beneath CONTINENT MASTER or GLOBAL MASTER'
          using errcode = '23514';
      end if;

    when 'region_master' then
      if v_tenant_type <> 'territory'
         or v_parent_level <> 'country_master'
      then
        raise exception
          'REGION / STATE MASTER must be a TERRITORY beneath COUNTRY MASTER'
          using errcode = '23514';
      end if;

    when 'capital_city' then
      if v_tenant_type <> 'territory'
         or v_parent_level <> 'country_master'
      then
        raise exception
          'NATIONAL / COUNTRY CAPITAL must be a TERRITORY beneath COUNTRY MASTER'
          using errcode = '23514';
      end if;

    when 'regional_capital' then
      if v_tenant_type <> 'territory'
         or v_parent_level <> 'region_master'
      then
        raise exception
          'STATE / REGIONAL CAPITAL must be a TERRITORY beneath REGION / STATE MASTER'
          using errcode = '23514';
      end if;

    when 'city_operator' then
      if v_tenant_type <> 'operator'
         or v_parent_level not in (
           'region_master',
           'capital_city',
           'regional_capital',
           'country_master'
         )
      then
        raise exception
          'CITY OPERATOR must be beneath REGION / STATE, NATIONAL CAPITAL, STATE / REGIONAL CAPITAL or COUNTRY MASTER'
          using errcode = '23514';
      end if;

    when 'festival_operator' then
      if v_tenant_type <> 'festival'
         or v_parent_level not in (
           'city_operator',
           'region_master',
           'capital_city',
           'regional_capital',
           'country_master'
         )
      then
        raise exception
          'FESTIVAL OPERATOR must be beneath an approved local territory/operator'
          using errcode = '23514';
      end if;

    when 'global_pool' then
      if v_tenant_type <> 'territory'
         or v_parent_level <> 'global_master'
      then
        raise exception
          'GLOBAL POOL must be a TERRITORY beneath GLOBAL MASTER'
          using errcode = '23514';
      end if;

    else
      raise exception
        'Unknown franchise level: %',
        p_level
        using errcode = '23514';

  end case;
end;
$$;


-- ============================================================
-- ATOMIC FRANCHISE / OPERATOR CREATION RPC
-- ============================================================
-- Remove the Migration 063 signature so PostgREST does not see
-- two ambiguous overloads.

drop function if exists public.create_franchise_operator(
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
);


create function public.create_franchise_operator(
  p_name text,
  p_franchise_level text,
  p_territory_name text,
  p_parent_tenant_id uuid,
  p_continent_name text default null,
  p_country_name text default null,
  p_country_code text default null,
  p_region_name text default null,
  p_region_code text default null,
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

    when 'regional_capital' then
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
    region_code,
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
    nullif(upper(btrim(p_region_code)), ''),
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
      ('territory_profile', 'Confirm territory profile'),
      ('agreement_record', 'Record executed agreement reference'),
      ('operator_access', 'Create operator access'),
      ('brand_pack', 'Issue approved brand pack'),
      ('training_complete', 'Complete operator training'),
      ('festival_setup', 'Configure first festival workspace'),
      ('compliance_pack', 'Issue compliance and governance pack'),
      ('launch_readiness', 'Complete launch-readiness review')
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
      'regionCode',
        nullif(upper(btrim(p_region_code)), ''),
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
  text,
  boolean,
  integer,
  text
)
is
'Film Festival OS™ controlled atomic creation of franchise/operator tenants with country, region/state and national/regional capital hierarchy support. Platform Admin only.';

-- Refresh Supabase/PostgREST schema cache after RPC signature change.
notify pgrst, 'reload schema';

commit;
