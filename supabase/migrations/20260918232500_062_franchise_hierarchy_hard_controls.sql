-- Film Festival OS™ v4.0
-- Migration 062 — Franchise Hierarchy Hard Controls
--
-- Enforces valid tenant type + parent/child franchise relationships.
-- Higher layers may be skipped where approved, but invalid reverse
-- or cross-level structures are blocked at database level.

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

  -- All other franchise levels require a parent.
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
          'REGION MASTER must be a TERRITORY beneath COUNTRY MASTER'
          using errcode = '23514';
      end if;

    when 'capital_city' then
      if v_tenant_type <> 'territory'
         or v_parent_level <> 'country_master'
      then
        raise exception
          'CAPITAL CITY must be a TERRITORY beneath COUNTRY MASTER'
          using errcode = '23514';
      end if;

    when 'city_operator' then
      if v_tenant_type <> 'operator'
         or v_parent_level not in (
           'region_master',
           'capital_city',
           'country_master'
         )
      then
        raise exception
          'CITY OPERATOR must be beneath REGION, CAPITAL CITY or COUNTRY MASTER'
          using errcode = '23514';
      end if;

    when 'festival_operator' then
      if v_tenant_type <> 'festival'
         or v_parent_level not in (
           'city_operator',
           'region_master',
           'capital_city',
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


create or replace function public.enforce_franchise_profile_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.validate_franchise_hierarchy(
    new.tenant_id,
    new.franchise_level
  );

  return new;
end;
$$;


drop trigger if exists trg_franchise_profile_hierarchy
  on public.franchise_profiles;

create trigger trg_franchise_profile_hierarchy
before insert or update of tenant_id, franchise_level
on public.franchise_profiles
for each row
execute function public.enforce_franchise_profile_hierarchy();


create or replace function public.enforce_franchise_tenant_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_level text;
begin
  select franchise_level
    into v_level
  from public.franchise_profiles
  where tenant_id = new.id;

  if v_level is not null then
    perform public.validate_franchise_hierarchy(
      new.id,
      v_level
    );
  end if;

  return new;
end;
$$;


drop trigger if exists trg_franchise_tenant_change
  on public.tenants;

create trigger trg_franchise_tenant_change
after update of parent_tenant_id, type
on public.tenants
for each row
execute function public.enforce_franchise_tenant_change();


create or replace function public.prevent_parent_franchise_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.tenants child_tenant
    join public.franchise_profiles child_profile
      on child_profile.tenant_id = child_tenant.id
    where child_tenant.parent_tenant_id = old.tenant_id
  ) then
    raise exception
      'Cannot delete franchise profile while child franchise profiles exist'
      using errcode = '23514';
  end if;

  return old;
end;
$$;


drop trigger if exists trg_prevent_parent_franchise_delete
  on public.franchise_profiles;

create trigger trg_prevent_parent_franchise_delete
before delete
on public.franchise_profiles
for each row
execute function public.prevent_parent_franchise_profile_delete();


revoke all
  on function public.validate_franchise_hierarchy(uuid,text)
  from public, anon, authenticated;

revoke all
  on function public.enforce_franchise_profile_hierarchy()
  from public, anon, authenticated;

revoke all
  on function public.enforce_franchise_tenant_change()
  from public, anon, authenticated;

revoke all
  on function public.prevent_parent_franchise_profile_delete()
  from public, anon, authenticated;


comment on function public.validate_franchise_hierarchy(uuid,text) is
'Film Festival OS™ database hard control validating franchise tenant type and permitted parent/child hierarchy.';
