-- Film Festival OS™ v4.0
-- Jury Scoring Forms Foundation
-- 11 Sep 2026

create table if not exists public.jury_scoring_forms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  name text not null,
  version integer not null default 1
    check (version > 0),

  status text not null default 'draft'
    check (status in ('draft','active','retired')),

  score_min numeric not null default 0,
  score_max numeric not null default 100,

  recommendation_required boolean not null default true,
  overall_comment_required boolean not null default false,

  created_by uuid
    references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (score_max > score_min),

  unique (tenant_id, name, version)
);


create unique index if not exists
jury_scoring_forms_one_active_version_idx
on public.jury_scoring_forms
(tenant_id, lower(name))
where status = 'active';


create table if not exists public.jury_scoring_criteria (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  form_id uuid not null
    references public.jury_scoring_forms(id) on delete cascade,

  label text not null,
  description text,

  weight_percent numeric not null
    check (
      weight_percent > 0
      and weight_percent <= 100
    ),

  score_min numeric not null default 0,
  score_max numeric not null default 100,

  comment_required boolean not null default false,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (score_max > score_min),

  unique (form_id, label)
);


alter table public.jury_assignments
  add column if not exists scoring_form_id uuid
  references public.jury_scoring_forms(id)
  on delete restrict;


create or replace function
public.enforce_jury_scoring_criterion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  form_tenant uuid;
  form_status text;
  existing_weight numeric := 0;
begin
  select tenant_id, status
  into form_tenant, form_status
  from public.jury_scoring_forms
  where id = new.form_id;

  if not found then
    raise exception 'Scoring form does not exist.';
  end if;

  if new.tenant_id <> form_tenant then
    raise exception 'Criterion tenant must match scoring form tenant.';
  end if;

  if form_status <> 'draft' then
    raise exception
      'Scoring criteria may only be changed while the form is in draft status.';
  end if;

  select coalesce(sum(weight_percent),0)
  into existing_weight
  from public.jury_scoring_criteria
  where form_id = new.form_id
    and id <> new.id;

  if existing_weight + new.weight_percent > 100 then
    raise exception
      'Total scoring criterion weighting cannot exceed 100 percent.';
  end if;

  new.updated_at := now();

  return new;
end;
$$;


drop trigger if exists
trg_enforce_jury_scoring_criterion
on public.jury_scoring_criteria;

create trigger trg_enforce_jury_scoring_criterion
before insert or update
on public.jury_scoring_criteria
for each row
execute function public.enforce_jury_scoring_criterion();


create or replace function
public.enforce_jury_scoring_form_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total_weight numeric := 0;
  criterion_count integer := 0;
begin
  new.updated_at := now();

  if new.status = 'active'
     and old.status is distinct from 'active' then

    select
      count(*),
      coalesce(sum(weight_percent),0)
    into
      criterion_count,
      total_weight
    from public.jury_scoring_criteria
    where form_id = new.id;

    if criterion_count < 1 then
      raise exception
        'Cannot activate scoring form: at least one criterion is required.';
    end if;

    if total_weight <> 100 then
      raise exception
        'Cannot activate scoring form: criterion weights must total exactly 100 percent.';
    end if;

  end if;

  return new;
end;
$$;


drop trigger if exists
trg_enforce_jury_scoring_form_activation
on public.jury_scoring_forms;

create trigger trg_enforce_jury_scoring_form_activation
before update
on public.jury_scoring_forms
for each row
execute function public.enforce_jury_scoring_form_activation();


alter table public.jury_scoring_forms
enable row level security;

alter table public.jury_scoring_criteria
enable row level security;


drop policy if exists
jury_scoring_forms_manager_all
on public.jury_scoring_forms;

create policy jury_scoring_forms_manager_all
on public.jury_scoring_forms
for all
using (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner']
  )
)
with check (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner']
  )
);


drop policy if exists
jury_scoring_forms_member_read
on public.jury_scoring_forms;

create policy jury_scoring_forms_member_read
on public.jury_scoring_forms
for select
using (
  public.is_tenant_member(tenant_id)
  and status = 'active'
);


drop policy if exists
jury_scoring_criteria_manager_all
on public.jury_scoring_criteria;

create policy jury_scoring_criteria_manager_all
on public.jury_scoring_criteria
for all
using (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner']
  )
)
with check (
  public.has_tenant_role(
    tenant_id,
    array['platform_admin','festival_owner']
  )
);


drop policy if exists
jury_scoring_criteria_member_read
on public.jury_scoring_criteria;

create policy jury_scoring_criteria_member_read
on public.jury_scoring_criteria
for select
using (
  public.is_tenant_member(tenant_id)
  and exists (
    select 1
    from public.jury_scoring_forms f
    where f.id = form_id
      and f.status = 'active'
  )
);


grant select, insert, update, delete
on public.jury_scoring_forms
to authenticated;

grant select, insert, update, delete
on public.jury_scoring_criteria
to authenticated;
