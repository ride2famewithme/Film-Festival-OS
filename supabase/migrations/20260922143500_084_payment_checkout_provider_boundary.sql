-- Film Festival OS™
-- 084 Payment Checkout Provider Boundary
-- Provider-neutral checkout sessions + verified provider events.
-- No card data, PayPal passwords, API secrets or wallet keys are stored here.

alter table public.platform_payment_policy
  add column if not exists checkout_provider text
    not null default 'paypal',
  add column if not exists checkout_environment text
    not null default 'sandbox',
  add column if not exists paypal_checkout_enabled boolean
    not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'platform_payment_policy_checkout_environment_check'
  ) then
    alter table public.platform_payment_policy
      add constraint platform_payment_policy_checkout_environment_check
      check (checkout_environment in ('sandbox','live'));
  end if;
end $$;


create table if not exists public.payment_checkout_sessions (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  season_id uuid not null,

  submission_id uuid not null
    references public.submissions(id) on delete cascade,

  submission_payment_id uuid not null
    references public.submission_payments(id) on delete cascade,

  provider text not null default 'paypal',
  environment text not null default 'sandbox',

  provider_order_id text,
  provider_capture_id text,

  status text not null default 'created',

  amount_due numeric(12,2) not null,
  currency text not null,

  approval_url text,

  idempotency_key text not null unique,

  created_by uuid not null
    references auth.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (provider in ('paypal','stripe','other')),
  check (environment in ('sandbox','live')),
  check (
    status in (
      'created',
      'approval_pending',
      'approved',
      'capture_pending',
      'completed',
      'denied',
      'cancelled',
      'refunded',
      'error'
    )
  ),
  check (amount_due >= 0)
);

create unique index if not exists
  payment_checkout_provider_order_idx
on public.payment_checkout_sessions(
  provider,
  environment,
  provider_order_id
)
where provider_order_id is not null;

create index if not exists
  payment_checkout_tenant_season_idx
on public.payment_checkout_sessions(
  tenant_id,
  season_id,
  created_at desc
);

create index if not exists
  payment_checkout_payment_idx
on public.payment_checkout_sessions(
  submission_payment_id,
  created_at desc
);


create table if not exists public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  checkout_session_id uuid
    references public.payment_checkout_sessions(id)
    on delete set null,

  submission_payment_id uuid
    references public.submission_payments(id)
    on delete set null,

  provider text not null,
  environment text not null,

  provider_event_id text not null,
  event_type text not null,
  provider_reference text,

  verified boolean not null default false,
  processed boolean not null default false,
  processing_result text,

  amount numeric(12,2),
  currency text,

  occurred_at timestamptz,
  received_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb,

  unique(provider, environment, provider_event_id),

  check (provider in ('paypal','stripe','other')),
  check (environment in ('sandbox','live'))
);

create index if not exists
  payment_provider_events_tenant_idx
on public.payment_provider_events(
  tenant_id,
  received_at desc
);


alter table public.payment_checkout_sessions
  enable row level security;

alter table public.payment_provider_events
  enable row level security;


drop policy if exists checkout_manager_read
  on public.payment_checkout_sessions;

create policy checkout_manager_read
on public.payment_checkout_sessions
for select
using (
  public.has_tenant_role(
    tenant_id,
    array[
      'platform_admin',
      'festival_owner',
      'festival_staff'
    ]
  )
);


drop policy if exists checkout_creator_read
  on public.payment_checkout_sessions;

create policy checkout_creator_read
on public.payment_checkout_sessions
for select
using (
  exists (
    select 1
    from public.submissions s
    where s.id = submission_id
      and s.tenant_id = tenant_id
      and s.owner_id = auth.uid()
  )
);


drop policy if exists provider_events_manager_read
  on public.payment_provider_events;

create policy provider_events_manager_read
on public.payment_provider_events
for select
using (
  public.has_tenant_role(
    tenant_id,
    array[
      'platform_admin',
      'festival_owner',
      'festival_staff'
    ]
  )
);


-- Client applications may inspect authorised records,
-- but payment creation/update is server-side only.
grant select on public.payment_checkout_sessions
  to authenticated;

grant select on public.payment_provider_events
  to authenticated;

revoke insert, update, delete
  on public.payment_checkout_sessions
  from authenticated;

revoke insert, update, delete
  on public.payment_provider_events
  from authenticated;
