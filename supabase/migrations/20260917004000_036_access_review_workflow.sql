-- Film Festival OS™
-- Migration 036 — Periodic Access Review Workflow

create table if not exists public.access_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id),
  outcome text not null check (outcome in ('retained','action_required')),
  note text,
  reviewed_at timestamptz not null default now(),
  next_review_due timestamptz not null default (now() + interval '90 days')
);

create index if not exists access_reviews_tenant_membership_idx
on public.access_reviews(tenant_id, membership_id, reviewed_at desc);

alter table public.access_reviews enable row level security;

drop policy if exists access_reviews_select on public.access_reviews;

create policy access_reviews_select
on public.access_reviews
for select
to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(tenant_id, array['festival_owner'])
);

grant select
on table public.access_reviews
to authenticated;


-- ============================================================
-- ACCESS REVIEW REGISTER
-- ============================================================

create or replace function public.access_review_register(
  p_tenant_id uuid
)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  role text,
  membership_status text,
  review_id uuid,
  review_outcome text,
  reviewed_at timestamptz,
  next_review_due timestamptz
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
      'Permission denied: access review administration required.';
  end if;

  return query
  select
    m.id,
    m.user_id,
    u.email::text,
    m.role,
    m.status,
    ar.id,
    ar.outcome,
    ar.reviewed_at,
    ar.next_review_due
  from public.memberships m
  join auth.users u
    on u.id = m.user_id
  left join lateral (
    select
      r.id,
      r.outcome,
      r.reviewed_at,
      r.next_review_due
    from public.access_reviews r
    where r.membership_id = m.id
      and r.tenant_id = m.tenant_id
    order by r.reviewed_at desc
    limit 1
  ) ar on true
  where m.tenant_id = p_tenant_id
    and (
      public.is_platform_admin()
      or m.role not in ('platform_admin','festival_owner')
    )
  order by
    case m.status
      when 'suspended' then 0
      when 'invited' then 1
      else 2
    end,
    u.email;
end;
$$;

revoke all
on function public.access_review_register(uuid)
from public;

grant execute
on function public.access_review_register(uuid)
to authenticated;


-- ============================================================
-- RECORD A PERIODIC ACCESS REVIEW
-- ============================================================

create or replace function public.record_access_review(
  p_membership_id uuid,
  p_outcome text,
  p_note text default null
)
returns public.access_reviews
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target public.memberships%rowtype;
  v_result public.access_reviews%rowtype;
begin
  if p_outcome not in ('retained','action_required') then
    raise exception 'Invalid access review outcome.';
  end if;

  select *
  into v_target
  from public.memberships
  where id = p_membership_id;

  if not found then
    raise exception 'Membership not found.';
  end if;

  if v_target.user_id = auth.uid() then
    raise exception
      'Safety lock: users cannot approve their own access review.';
  end if;

  if public.is_platform_admin() then
    null;

  elsif public.has_tenant_role(
    v_target.tenant_id,
    array['festival_owner']
  ) then

    if v_target.role in ('platform_admin','festival_owner') then
      raise exception
        'Festival Owners cannot review Platform Admin or Festival Owner access.';
    end if;

  else
    raise exception
      'Permission denied: access review administration required.';
  end if;

  insert into public.access_reviews (
    tenant_id,
    membership_id,
    reviewer_user_id,
    outcome,
    note,
    reviewed_at,
    next_review_due
  )
  values (
    v_target.tenant_id,
    v_target.id,
    auth.uid(),
    p_outcome,
    nullif(trim(coalesce(p_note,'')), ''),
    now(),
    now() + interval '90 days'
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
    v_target.tenant_id,
    auth.uid(),
    'membership.access_reviewed',
    'membership',
    v_target.id,
    jsonb_build_object(
      'target_user_id', v_target.user_id,
      'target_role', v_target.role,
      'membership_status', v_target.status,
      'outcome', p_outcome,
      'next_review_due', v_result.next_review_due
    ),
    now()
  );

  return v_result;
end;
$$;

revoke all
on function public.record_access_review(uuid,text,text)
from public;

grant execute
on function public.record_access_review(uuid,text,text)
to authenticated;
