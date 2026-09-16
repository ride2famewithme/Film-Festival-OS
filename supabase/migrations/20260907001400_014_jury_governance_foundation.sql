-- Film Festival OS™
-- Migration 014 — Jury Governance Foundation
-- Reconstructed from verified live database
-- 08 Sep 2026

create table if not exists public.jury_governance_settings (
  tenant_id uuid primary key
    references public.tenants(id) on delete cascade,

  sponsor_total_cap_percent numeric not null default 30
    check (
      sponsor_total_cap_percent > 0
      and sponsor_total_cap_percent < 50
    ),

  sponsor_single_cap_percent numeric not null default 15
    check (
      sponsor_single_cap_percent > 0
      and sponsor_single_cap_percent < 50
    ),

  max_single_juror_percent numeric not null default 30
    check (
      max_single_juror_percent > 0
      and max_single_juror_percent < 50
    ),

  ai_cap_percent numeric not null default 25
    check (
      ai_cap_percent > 0
      and ai_cap_percent < 50
    ),

  anti_canvassing_enabled boolean not null default true,

  identity_policy text not null default 'confidential_until_final'
    check (identity_policy in (
      'confidential_until_final',
      'owner_selected_reveal',
      'confidential_permanent'
    )),

  updated_at timestamptz not null default now()
);


insert into public.jury_governance_settings (tenant_id)
select id
from public.tenants
where type = 'festival'
on conflict (tenant_id) do nothing;


create table if not exists public.jury_panel_members (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  auth_user_id uuid
    references auth.users(id) on delete set null,

  display_label text not null,

  juror_kind text not null default 'independent'
    check (juror_kind in (
      'independent',
      'vip_guest',
      'sponsor',
      'ai'
    )),

  weight_percent numeric not null default 10
    check (
      weight_percent > 0
      and weight_percent <= 100
    ),

  status text not null default 'invited'
    check (status in (
      'invited',
      'active',
      'recused',
      'removed',
      'completed'
    )),

  conflict_status text not null default 'clear'
    check (conflict_status in (
      'clear',
      'declared',
      'recused',
      'blocked'
    )),

  identity_visibility text not null default 'confidential'
    check (identity_visibility in (
      'confidential',
      'reveal_after_awards',
      'public'
    )),

  consent_to_reveal boolean not null default false,

  invited_at timestamptz not null default now(),
  recused_at timestamptz,

  created_by uuid
    references auth.users(id) on delete set null,

  updated_at timestamptz not null default now()
);


create unique index if not exists jury_panel_member_user_idx
on public.jury_panel_members(tenant_id, auth_user_id)
where auth_user_id is not null;


alter table public.jury_assignments
  add column if not exists panel_member_id uuid
  references public.jury_panel_members(id)
  on delete set null;

alter table public.jury_assignments
  add column if not exists weight_percent_snapshot numeric;

alter table public.jury_assignments
  add column if not exists confidentiality_status text
  not null default 'confidential'
  check (confidentiality_status in (
    'confidential',
    'reveal_after_awards',
    'released'
  ));

alter table public.jury_assignments
  add column if not exists conflict_status text
  not null default 'clear'
  check (conflict_status in (
    'clear',
    'declared',
    'recused',
    'blocked'
  ));


create table if not exists public.jury_integrity_events (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  submission_id uuid
    references public.submissions(id) on delete set null,

  panel_member_id uuid
    references public.jury_panel_members(id) on delete set null,

  event_type text not null
    check (event_type in (
      'conflict_declared',
      'recusal',
      'contact_attempt',
      'canvassing_attempt',
      'gift_or_inducement',
      'pressure_or_lobbying',
      'score_disclosure',
      'manual_review'
    )),

  severity text not null default 'medium'
    check (severity in (
      'low',
      'medium',
      'high',
      'critical'
    )),

  note text,

  resolved boolean not null default false,

  created_by uuid
    references auth.users(id) on delete set null,

  created_at timestamptz not null default now()
);


alter table public.jury_governance_settings enable row level security;
alter table public.jury_panel_members enable row level security;
alter table public.jury_integrity_events enable row level security;


drop policy if exists jury_governance_manager_all
on public.jury_governance_settings;

create policy jury_governance_manager_all
on public.jury_governance_settings
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


drop policy if exists jury_panel_manager_all
on public.jury_panel_members;

create policy jury_panel_manager_all
on public.jury_panel_members
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


drop policy if exists jury_panel_own_read
on public.jury_panel_members;

create policy jury_panel_own_read
on public.jury_panel_members
for select
using (
  auth_user_id = auth.uid()
  and public.is_tenant_member(tenant_id)
);


drop policy if exists jury_integrity_manager_all
on public.jury_integrity_events;

create policy jury_integrity_manager_all
on public.jury_integrity_events
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


create or replace function
public.enforce_jury_weight_governance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.jury_governance_settings%rowtype;
  sponsor_total numeric := 0;
  panel_total numeric := 0;
begin

  select *
  into cfg
  from public.jury_governance_settings
  where tenant_id = new.tenant_id;

  if not found then
    raise exception
      'Jury governance settings not configured.';
  end if;


  if new.weight_percent > cfg.max_single_juror_percent then
    raise exception
      'Juror weight exceeds the maximum permitted individual weight.';
  end if;


  if new.juror_kind = 'sponsor'
     and new.weight_percent > cfg.sponsor_single_cap_percent then
    raise exception
      'Sponsor juror weight exceeds the permitted sponsor limit.';
  end if;


  if new.juror_kind = 'ai'
     and new.weight_percent > cfg.ai_cap_percent then
    raise exception
      'AI juror weight exceeds the configured AI limit.';
  end if;


  if new.status in ('invited','active') then

    select coalesce(sum(weight_percent),0)
    into panel_total
    from public.jury_panel_members
    where tenant_id = new.tenant_id
      and status in ('invited','active')
      and id <> new.id;

    if panel_total + new.weight_percent > 100 then
      raise exception
        'Total active jury weighting cannot exceed 100 percent.';
    end if;


    if new.juror_kind = 'sponsor' then

      select coalesce(sum(weight_percent),0)
      into sponsor_total
      from public.jury_panel_members
      where tenant_id = new.tenant_id
        and juror_kind = 'sponsor'
        and status in ('invited','active')
        and id <> new.id;

      if sponsor_total + new.weight_percent
         > cfg.sponsor_total_cap_percent then
        raise exception
          'Combined sponsor jury weighting exceeds the permitted sponsor cap.';
      end if;

    end if;

  end if;

  new.updated_at := now();

  return new;
end;
$$;


drop trigger if exists trg_jury_weight_governance
on public.jury_panel_members;

create trigger trg_jury_weight_governance
before insert or update
on public.jury_panel_members
for each row
execute function public.enforce_jury_weight_governance();


grant select, insert, update
on public.jury_governance_settings
to authenticated;

grant select, insert, update
on public.jury_panel_members
to authenticated;

grant select, insert, update
on public.jury_integrity_events
to authenticated;

