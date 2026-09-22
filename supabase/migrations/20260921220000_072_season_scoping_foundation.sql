begin;

-- Film Festival OS™
-- Roll-Over™ Season Scoping Foundation

alter table public.festival_categories
  add column if not exists season_id uuid
  references public.festival_seasons(id) on delete restrict;

alter table public.jury_panel_members
  add column if not exists season_id uuid
  references public.festival_seasons(id) on delete restrict;

alter table public.benefit_codes
  add column if not exists season_id uuid
  references public.festival_seasons(id) on delete restrict;


-- Ensure existing operational tenants have at least one season.

insert into public.festival_seasons
  (tenant_id, label, status, updated_at)
select x.tenant_id, '2026', 'draft', now()
from (
  select tenant_id from public.festival_categories
  union
  select tenant_id from public.jury_panel_members
  union
  select tenant_id from public.benefit_codes
) x
where not exists (
  select 1
  from public.festival_seasons s
  where s.tenant_id = x.tenant_id
);


-- Attach existing records to the tenant's preferred season.

update public.festival_categories c
set season_id = (
  select s.id
  from public.festival_seasons s
  where s.tenant_id = c.tenant_id
  order by
    case s.status
      when 'open' then 0
      when 'draft' then 1
      else 2
    end,
    s.updated_at desc
  limit 1
)
where c.season_id is null;

update public.jury_panel_members j
set season_id = (
  select s.id
  from public.festival_seasons s
  where s.tenant_id = j.tenant_id
  order by
    case s.status
      when 'open' then 0
      when 'draft' then 1
      else 2
    end,
    s.updated_at desc
  limit 1
)
where j.season_id is null;

update public.benefit_codes b
set season_id = (
  select s.id
  from public.festival_seasons s
  where s.tenant_id = b.tenant_id
  order by
    case s.status
      when 'open' then 0
      when 'draft' then 1
      else 2
    end,
    s.updated_at desc
  limit 1
)
where b.season_id is null;


-- Replace festival-wide uniqueness with season-aware uniqueness.

drop index if exists public.festival_categories_tenant_name_idx;
drop index if exists public.jury_panel_member_user_idx;
drop index if exists public.benefit_codes_tenant_code_idx;

create unique index festival_categories_season_name_idx
on public.festival_categories
  (tenant_id, season_id, lower(name))
where season_id is not null;

create unique index jury_panel_member_season_user_idx
on public.jury_panel_members
  (tenant_id, season_id, auth_user_id)
where season_id is not null
  and auth_user_id is not null;

create unique index benefit_codes_season_code_idx
on public.benefit_codes
  (tenant_id, season_id, upper(code))
where season_id is not null;


-- Transitional protection for any old workflow
-- that does not yet supply season_id.

create unique index festival_categories_unscoped_name_idx
on public.festival_categories
  (tenant_id, lower(name))
where season_id is null;

create unique index jury_panel_member_unscoped_user_idx
on public.jury_panel_members
  (tenant_id, auth_user_id)
where season_id is null
  and auth_user_id is not null;

create unique index benefit_codes_unscoped_code_idx
on public.benefit_codes
  (tenant_id, upper(code))
where season_id is null;

notify pgrst, 'reload schema';

commit;
