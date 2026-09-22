begin;

-- ============================================================
-- FILM FESTIVAL OS™
-- NFT Suggested Resale / Fundraising Value™ hierarchy
--
-- Hierarchy follows tenants.parent_tenant_id.
-- Nearest policy normally wins.
-- An ancestor may lock descendants from overriding its value.
-- ============================================================

create table if not exists public.tenant_nft_award_policies (
  tenant_id uuid primary key
    references public.tenants(id)
    on delete cascade,

  winner_suggested_eth numeric(18,8),
  second_place_suggested_eth numeric(18,8),
  third_place_suggested_eth numeric(18,8),
  jury_choice_suggested_eth numeric(18,8),
  audience_choice_suggested_eth numeric(18,8),
  special_recognition_suggested_eth numeric(18,8),

  allow_descendant_override boolean
    not null default true,

  updated_by uuid,
  updated_at timestamptz
    not null default now()
);


-- Existing category-level ETH fields become an optional
-- FINAL EVENT / CATEGORY override.
alter table public.festival_categories
  add column if not exists nft_value_override_enabled
    boolean not null default false;


alter table public.tenant_nft_award_policies
  enable row level security;


-- ============================================================
-- GET ONE TENANT'S POLICY
-- ============================================================

create or replace function public.get_tenant_nft_award_policy(
  p_tenant_id uuid
)
returns table (
  tenant_id uuid,
  tenant_name text,
  tenant_type text,
  winner_suggested_eth numeric,
  second_place_suggested_eth numeric,
  third_place_suggested_eth numeric,
  jury_choice_suggested_eth numeric,
  audience_choice_suggested_eth numeric,
  special_recognition_suggested_eth numeric,
  allow_descendant_override boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin

  if not exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and (
        m.role = 'platform_admin'
        or m.tenant_id = p_tenant_id
      )
  ) then
    raise exception 'Permission denied';
  end if;

  return query
  select
    t.id,
    t.name::text,
    t.type::text,
    p.winner_suggested_eth,
    p.second_place_suggested_eth,
    p.third_place_suggested_eth,
    p.jury_choice_suggested_eth,
    p.audience_choice_suggested_eth,
    p.special_recognition_suggested_eth,
    coalesce(
      p.allow_descendant_override,
      true
    )
  from public.tenants t
  left join public.tenant_nft_award_policies p
    on p.tenant_id = t.id
  where t.id = p_tenant_id;

end;
$$;


-- ============================================================
-- SAVE CURRENT TENANT POLICY
-- platform_admin can configure any tenant.
-- active owner/staff can configure their own tenant.
-- ============================================================

create or replace function public.set_tenant_nft_award_policy(
  p_tenant_id uuid,
  p_winner numeric,
  p_second numeric,
  p_third numeric,
  p_jury numeric,
  p_audience numeric,
  p_special numeric,
  p_allow_descendant_override boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  if not exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and (
        m.role = 'platform_admin'
        or (
          m.tenant_id = p_tenant_id
          and m.role in (
            'festival_owner',
            'festival_staff'
          )
        )
      )
  ) then
    raise exception 'Permission denied';
  end if;


  if
    coalesce(p_winner, 0) < 0
    or coalesce(p_second, 0) < 0
    or coalesce(p_third, 0) < 0
    or coalesce(p_jury, 0) < 0
    or coalesce(p_audience, 0) < 0
    or coalesce(p_special, 0) < 0
  then
    raise exception 'ETH values cannot be negative';
  end if;


  insert into public.tenant_nft_award_policies (
    tenant_id,
    winner_suggested_eth,
    second_place_suggested_eth,
    third_place_suggested_eth,
    jury_choice_suggested_eth,
    audience_choice_suggested_eth,
    special_recognition_suggested_eth,
    allow_descendant_override,
    updated_by,
    updated_at
  )
  values (
    p_tenant_id,
    p_winner,
    p_second,
    p_third,
    p_jury,
    p_audience,
    p_special,
    coalesce(
      p_allow_descendant_override,
      true
    ),
    auth.uid(),
    now()
  )
  on conflict (tenant_id)
  do update set
    winner_suggested_eth =
      excluded.winner_suggested_eth,
    second_place_suggested_eth =
      excluded.second_place_suggested_eth,
    third_place_suggested_eth =
      excluded.third_place_suggested_eth,
    jury_choice_suggested_eth =
      excluded.jury_choice_suggested_eth,
    audience_choice_suggested_eth =
      excluded.audience_choice_suggested_eth,
    special_recognition_suggested_eth =
      excluded.special_recognition_suggested_eth,
    allow_descendant_override =
      excluded.allow_descendant_override,
    updated_by = auth.uid(),
    updated_at = now();

end;
$$;


-- ============================================================
-- RESOLVE EFFECTIVE VALUE
--
-- 1. Locked ancestor beats lower descendants.
-- 2. Otherwise nearest tenant policy wins.
-- 3. Otherwise FFOS system default applies.
-- ============================================================

create or replace function public.resolve_nft_suggested_value(
  p_tenant_id uuid,
  p_placement text
)
returns table (
  placement text,
  suggested_eth numeric,
  source_tenant_id uuid,
  source_tenant_name text,
  source_tenant_type text,
  source_depth integer,
  source_kind text,
  override_locked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default numeric;

  v_id uuid;
  v_name text;
  v_type text;
  v_depth integer;
  v_value numeric;
begin

  if p_placement not in (
    'winner',
    'second_place',
    'third_place',
    'jury_choice',
    'audience_choice',
    'special_recognition'
  ) then
    raise exception 'Unsupported NFT award placement';
  end if;


  if not exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and (
        m.role = 'platform_admin'
        or m.tenant_id = p_tenant_id
      )
  ) then
    raise exception 'Permission denied';
  end if;


  v_default :=
    case p_placement
      when 'winner'
        then 0.00300000
      when 'second_place'
        then 0.00050000
      when 'third_place'
        then 0.00025000
      when 'jury_choice'
        then 0.00020000
      when 'audience_choice'
        then 0.00020000
      when 'special_recognition'
        then 0.00010000
    end;


  -- ----------------------------------------------------------
  -- Highest locked ANCESTOR controls descendants.
  -- depth 0 is the current tenant, therefore not an ancestor.
  -- ----------------------------------------------------------

  with recursive chain as (
    select
      t.id,
      t.parent_tenant_id,
      t.name,
      t.type,
      0::integer as depth
    from public.tenants t
    where t.id = p_tenant_id

    union all

    select
      t.id,
      t.parent_tenant_id,
      t.name,
      t.type,
      c.depth + 1
    from public.tenants t
    join chain c
      on t.id = c.parent_tenant_id
    where c.depth < 20
  ),
  candidates as (
    select
      c.id,
      c.name,
      c.type,
      c.depth,
      p.allow_descendant_override,

      case p_placement
        when 'winner'
          then p.winner_suggested_eth
        when 'second_place'
          then p.second_place_suggested_eth
        when 'third_place'
          then p.third_place_suggested_eth
        when 'jury_choice'
          then p.jury_choice_suggested_eth
        when 'audience_choice'
          then p.audience_choice_suggested_eth
        when 'special_recognition'
          then p.special_recognition_suggested_eth
      end as value

    from chain c
    join public.tenant_nft_award_policies p
      on p.tenant_id = c.id
  )
  select
    id,
    name::text,
    type::text,
    depth,
    value
  into
    v_id,
    v_name,
    v_type,
    v_depth,
    v_value
  from candidates
  where depth > 0
    and allow_descendant_override = false
    and value is not null
  order by depth desc
  limit 1;


  if v_id is not null then
    return query
    select
      p_placement,
      v_value,
      v_id,
      v_name,
      v_type,
      v_depth,
      'LOCKED ANCESTOR POLICY'::text,
      true;

    return;
  end if;


  -- ----------------------------------------------------------
  -- No ancestor lock: nearest defined policy wins.
  -- ----------------------------------------------------------

  v_id := null;
  v_name := null;
  v_type := null;
  v_depth := null;
  v_value := null;


  with recursive chain as (
    select
      t.id,
      t.parent_tenant_id,
      t.name,
      t.type,
      0::integer as depth
    from public.tenants t
    where t.id = p_tenant_id

    union all

    select
      t.id,
      t.parent_tenant_id,
      t.name,
      t.type,
      c.depth + 1
    from public.tenants t
    join chain c
      on t.id = c.parent_tenant_id
    where c.depth < 20
  ),
  candidates as (
    select
      c.id,
      c.name,
      c.type,
      c.depth,

      case p_placement
        when 'winner'
          then p.winner_suggested_eth
        when 'second_place'
          then p.second_place_suggested_eth
        when 'third_place'
          then p.third_place_suggested_eth
        when 'jury_choice'
          then p.jury_choice_suggested_eth
        when 'audience_choice'
          then p.audience_choice_suggested_eth
        when 'special_recognition'
          then p.special_recognition_suggested_eth
      end as value

    from chain c
    join public.tenant_nft_award_policies p
      on p.tenant_id = c.id
  )
  select
    id,
    name::text,
    type::text,
    depth,
    value
  into
    v_id,
    v_name,
    v_type,
    v_depth,
    v_value
  from candidates
  where value is not null
  order by depth asc
  limit 1;


  if v_id is not null then
    return query
    select
      p_placement,
      v_value,
      v_id,
      v_name,
      v_type,
      v_depth,
      case
        when v_depth = 0
          then 'CURRENT TENANT POLICY'
        else 'INHERITED TENANT POLICY'
      end,
      false;

    return;
  end if;


  -- ----------------------------------------------------------
  -- No configured franchise policy.
  -- ----------------------------------------------------------

  return query
  select
    p_placement,
    v_default,
    null::uuid,
    'Film Festival OS™'::text,
    'system'::text,
    null::integer,
    'SYSTEM DEFAULT'::text,
    false;

end;
$$;


grant execute
on function public.get_tenant_nft_award_policy(uuid)
to authenticated;

grant execute
on function public.set_tenant_nft_award_policy(
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean
)
to authenticated;

grant execute
on function public.resolve_nft_suggested_value(
  uuid,
  text
)
to authenticated;


notify pgrst, 'reload schema';

commit;
