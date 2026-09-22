begin;

-- FFOS minimum payout policy
alter table public.platform_payment_policy
  add column if not exists minimum_payout_threshold numeric(12,2)
    not null default 50 check (minimum_payout_threshold >= 0),
  add column if not exists minimum_payout_currency text
    not null default 'USD',
  add column if not exists carry_forward_below_threshold boolean
    not null default true,
  add column if not exists paypal_payouts_enabled boolean
    not null default false,
  add column if not exists crypto_payments_enabled boolean
    not null default false,
  add column if not exists crypto_payouts_enabled boolean
    not null default false;

update public.platform_payment_policy
set
  minimum_payout_threshold = 50,
  minimum_payout_currency = 'USD',
  carry_forward_below_threshold = true,
  updated_at = now()
where scope = 'global';


-- Festival payout destinations
create table if not exists public.festival_payout_destinations (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id) on delete cascade,

  destination_type text not null
    check (
      destination_type in (
        'paypal',
        'bank_transfer',
        'connected_provider',
        'crypto_wallet'
      )
    ),

  display_label text not null,
  provider_name text,
  account_reference text,
  crypto_network text,

  payout_currency text not null default 'USD',

  status text not null default 'inactive'
    check (
      status in (
        'inactive',
        'active',
        'suspended',
        'retired'
      )
    ),

  verification_status text not null default 'unverified'
    check (
      verification_status in (
        'unverified',
        'pending',
        'verified',
        'failed'
      )
    ),

  is_primary boolean not null default false,

  notes text,

  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    status <> 'active'
    or (
      verification_status = 'verified'
      and nullif(trim(account_reference),'') is not null
    )
  ),

  check (
    not is_primary
    or (
      status = 'active'
      and verification_status = 'verified'
    )
  )
);


create unique index if not exists
festival_payout_one_primary_currency_idx
on public.festival_payout_destinations(
  tenant_id,
  payout_currency
)
where is_primary;


alter table public.festival_payout_destinations
enable row level security;


create policy festival_payout_destinations_read
on public.festival_payout_destinations
for select
to authenticated
using (
  public.is_tenant_member(tenant_id)
  or public.is_platform_admin()
);


create policy festival_payout_destinations_manage
on public.festival_payout_destinations
for all
to authenticated
using (
  public.has_tenant_role(
    tenant_id,
    array[
      'platform_admin',
      'festival_owner',
      'festival_staff'
    ]
  )
)
with check (
  public.has_tenant_role(
    tenant_id,
    array[
      'platform_admin',
      'festival_owner',
      'festival_staff'
    ]
  )
);


grant select, insert, update
on public.festival_payout_destinations
to authenticated;


-- Current Colortape PayPal placeholder.
-- OFF + UNVERIFIED = cannot be used for payout.
insert into public.festival_payout_destinations (
  tenant_id,
  destination_type,
  display_label,
  provider_name,
  account_reference,
  payout_currency,
  status,
  verification_status,
  is_primary,
  notes
)
select
  id,
  'paypal',
  'Colortape PayPal — Placeholder',
  'PayPal',
  'colortape@gmail.com',
  'USD',
  'inactive',
  'unverified',
  false,
  'Placeholder only. Verify before activation.'
from public.tenants
where id = '474f4f6b-c3e9-4b94-9b5f-b239de7b96c0'
and not exists (
  select 1
  from public.festival_payout_destinations d
  where d.tenant_id =
    '474f4f6b-c3e9-4b94-9b5f-b239de7b96c0'
    and d.destination_type = 'paypal'
);


-- Future crypto-wallet placeholder.
-- No address / private key / seed phrase stored.
insert into public.festival_payout_destinations (
  tenant_id,
  destination_type,
  display_label,
  provider_name,
  payout_currency,
  status,
  verification_status,
  is_primary,
  notes
)
select
  id,
  'crypto_wallet',
  'Crypto Wallet — Future Setup',
  'MetaMask / Compatible Wallet',
  'USD',
  'inactive',
  'unverified',
  false,
  'Placeholder only. Public wallet address and network to be configured later.'
from public.tenants
where id = '474f4f6b-c3e9-4b94-9b5f-b239de7b96c0'
and not exists (
  select 1
  from public.festival_payout_destinations d
  where d.tenant_id =
    '474f4f6b-c3e9-4b94-9b5f-b239de7b96c0'
    and d.destination_type = 'crypto_wallet'
);


comment on table public.festival_payout_destinations is
'FFOS™ controlled PayPal, bank/provider and future crypto payout destinations. Never store passwords, wallet private keys or seed phrases.';

notify pgrst, 'reload schema';

commit;
