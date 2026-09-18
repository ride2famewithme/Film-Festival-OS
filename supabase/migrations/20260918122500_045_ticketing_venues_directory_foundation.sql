-- Film Festival OS™
-- Migration 045 — Ticketing, Venues, Public Directory & Acquisition Foundation
--
-- Provider-neutral foundation for:
--   * in-person / online / hybrid festival editions
--   * venues and declared safe capacity
--   * native ticket inventory and optional external ticket providers
--   * allocated seating foundation
--   * orders/tickets/check-in records
--   * campaign/source attribution fields
--
-- SAFETY PRINCIPLE:
-- Film Festival OS™ stores and enforces the venue/operator's declared capacity.
-- It does not calculate or certify a legal occupancy limit.

alter table public.festival_profiles
  add column if not exists delivery_mode text not null default 'in_person'
    check (delivery_mode in ('in_person','online','hybrid'));

alter table public.festival_profiles
  add column if not exists directory_public boolean not null default false;

alter table public.festival_profiles
  add column if not exists directory_slug text;

create unique index if not exists festival_profiles_directory_slug_uidx
on public.festival_profiles(directory_slug)
where directory_slug is not null;

drop policy if exists festival_profiles_public_directory_select_anon
on public.festival_profiles;

create policy festival_profiles_public_directory_select_anon
on public.festival_profiles
for select
to anon
using (
  status = 'published'
  and directory_public = true
);

drop policy if exists festival_profiles_public_directory_select_authenticated
on public.festival_profiles;

create policy festival_profiles_public_directory_select_authenticated
on public.festival_profiles
for select
to authenticated
using (
  status = 'published'
  and directory_public = true
);

grant select on table public.festival_profiles to anon;


create table if not exists public.event_venues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  venue_type text not null default 'cinema'
    check (venue_type in (
      'cinema','theatre','concert_hall','outdoor',
      'community','online','other'
    )),
  address_line text,
  city text,
  region text,
  country text,
  venue_url text,
  declared_safe_capacity integer,
  seated_capacity integer,
  standing_capacity integer,
  accessible_seat_count integer,
  capacity_source text,
  capacity_verified_at timestamptz,
  status text not null default 'active'
    check (status in ('active','inactive','draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (declared_safe_capacity is null or declared_safe_capacity >= 0),
  check (seated_capacity is null or seated_capacity >= 0),
  check (standing_capacity is null or standing_capacity >= 0),
  check (accessible_seat_count is null or accessible_seat_count >= 0)
);

create index if not exists event_venues_tenant_idx
on public.event_venues(tenant_id, status);


create table if not exists public.ticketed_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  festival_season_id uuid references public.festival_seasons(id) on delete set null,
  venue_id uuid references public.event_venues(id) on delete set null,
  title text not null,
  event_kind text not null default 'screening'
    check (event_kind in (
      'screening','concert','ceremony','panel','workshop',
      'livestream','party','other'
    )),
  delivery_mode text not null default 'in_person'
    check (delivery_mode in ('in_person','online','hybrid')),
  starts_at timestamptz,
  ends_at timestamptz,
  capacity_mode text not null default 'venue'
    check (capacity_mode in ('venue','manual','unlimited_virtual')),
  manual_capacity integer,
  online_capacity integer,
  sales_status text not null default 'draft'
    check (sales_status in (
      'draft','on_sale','paused','sold_out','closed','cancelled'
    )),
  public_listing boolean not null default false,
  external_provider text not null default 'native'
    check (external_provider in (
      'native','eventbrite','ticketebo','other'
    )),
  external_event_id text,
  external_ticket_url text,
  stream_access_mode text not null default 'none'
    check (stream_access_mode in (
      'none','ticket_unlock','pass_unlock','external_link'
    )),
  stream_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (manual_capacity is null or manual_capacity >= 0),
  check (online_capacity is null or online_capacity >= 0),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists ticketed_events_tenant_idx
on public.ticketed_events(tenant_id, sales_status, starts_at);

create index if not exists ticketed_events_venue_idx
on public.ticketed_events(venue_id, starts_at);


create table if not exists public.event_ticket_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_id uuid not null references public.ticketed_events(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null default 0,
  currency text not null default 'AUD',
  inventory_limit integer,
  minimum_per_order integer not null default 1,
  maximum_per_order integer not null default 10,
  sales_start_at timestamptz,
  sales_end_at timestamptz,
  status text not null default 'active'
    check (status in ('active','paused','hidden','sold_out')),
  external_ticket_class_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price_cents >= 0),
  check (inventory_limit is null or inventory_limit >= 0),
  check (minimum_per_order >= 1),
  check (maximum_per_order >= minimum_per_order)
);

create index if not exists event_ticket_types_event_idx
on public.event_ticket_types(event_id, status);


create table if not exists public.venue_seats (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.event_venues(id) on delete cascade,
  section_name text,
  row_label text,
  seat_number text,
  seat_code text not null,
  seat_type text not null default 'standard',
  accessible boolean not null default false,
  status text not null default 'active'
    check (status in ('active','blocked','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, seat_code)
);

create index if not exists venue_seats_venue_idx
on public.venue_seats(venue_id, status);


create table if not exists public.event_seat_inventory (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_id uuid not null references public.ticketed_events(id) on delete cascade,
  seat_id uuid not null references public.venue_seats(id) on delete cascade,
  ticket_type_id uuid references public.event_ticket_types(id) on delete set null,
  state text not null default 'available'
    check (state in ('available','held','sold','blocked')),
  hold_expires_at timestamptz,
  price_override_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, seat_id),
  check (price_override_cents is null or price_override_cents >= 0)
);

create index if not exists event_seat_inventory_event_idx
on public.event_seat_inventory(event_id, state);


create table if not exists public.event_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_id uuid not null references public.ticketed_events(id) on delete cascade,
  provider text not null default 'native'
    check (provider in ('native','eventbrite','ticketebo','other')),
  external_order_id text,
  purchaser_name text,
  purchaser_email text,
  order_status text not null default 'pending'
    check (order_status in (
      'pending','confirmed','cancelled','refunded','part_refunded'
    )),
  payment_status text not null default 'pending'
    check (payment_status in (
      'pending','paid','waived','failed','refunded','part_refunded'
    )),
  subtotal_cents integer not null default 0,
  fees_cents integer not null default 0,
  total_cents integer not null default 0,
  currency text not null default 'AUD',
  source_channel text,
  campaign_code text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  ordered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (subtotal_cents >= 0),
  check (fees_cents >= 0),
  check (total_cents >= 0)
);

create index if not exists event_orders_event_idx
on public.event_orders(event_id, ordered_at desc);

create index if not exists event_orders_campaign_idx
on public.event_orders(tenant_id, utm_campaign, ordered_at desc);


create table if not exists public.event_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_id uuid not null references public.ticketed_events(id) on delete cascade,
  order_id uuid references public.event_orders(id) on delete set null,
  ticket_type_id uuid references public.event_ticket_types(id) on delete set null,
  seat_inventory_id uuid references public.event_seat_inventory(id) on delete set null,
  holder_name text,
  holder_email text,
  ticket_status text not null default 'active'
    check (ticket_status in ('active','void','refunded')),
  barcode_token_hash text,
  checked_in_at timestamptz,
  checked_in_gate text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_tickets_event_idx
on public.event_tickets(event_id, ticket_status);

create index if not exists event_tickets_order_idx
on public.event_tickets(order_id);


alter table public.event_venues enable row level security;
alter table public.ticketed_events enable row level security;
alter table public.event_ticket_types enable row level security;
alter table public.venue_seats enable row level security;
alter table public.event_seat_inventory enable row level security;
alter table public.event_orders enable row level security;
alter table public.event_tickets enable row level security;


drop policy if exists event_venues_select on public.event_venues;
create policy event_venues_select on public.event_venues
for select to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(tenant_id)
);

drop policy if exists event_venues_manage on public.event_venues;
create policy event_venues_manage on public.event_venues
for all to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
)
with check (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
);


drop policy if exists ticketed_events_select on public.ticketed_events;
create policy ticketed_events_select on public.ticketed_events
for select to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(tenant_id)
);

drop policy if exists ticketed_events_manage on public.ticketed_events;
create policy ticketed_events_manage on public.ticketed_events
for all to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
)
with check (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
);


drop policy if exists event_ticket_types_select on public.event_ticket_types;
create policy event_ticket_types_select on public.event_ticket_types
for select to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(tenant_id)
);

drop policy if exists event_ticket_types_manage on public.event_ticket_types;
create policy event_ticket_types_manage on public.event_ticket_types
for all to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
)
with check (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
);


drop policy if exists venue_seats_select on public.venue_seats;
create policy venue_seats_select on public.venue_seats
for select to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(tenant_id)
);

drop policy if exists venue_seats_manage on public.venue_seats;
create policy venue_seats_manage on public.venue_seats
for all to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
)
with check (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
);


drop policy if exists event_seat_inventory_select on public.event_seat_inventory;
create policy event_seat_inventory_select on public.event_seat_inventory
for select to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(tenant_id)
);

drop policy if exists event_seat_inventory_manage on public.event_seat_inventory;
create policy event_seat_inventory_manage on public.event_seat_inventory
for all to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
)
with check (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
);


drop policy if exists event_orders_select on public.event_orders;
create policy event_orders_select on public.event_orders
for select to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(tenant_id)
);

drop policy if exists event_orders_manage on public.event_orders;
create policy event_orders_manage on public.event_orders
for all to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
)
with check (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
);


drop policy if exists event_tickets_select on public.event_tickets;
create policy event_tickets_select on public.event_tickets
for select to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(tenant_id)
);

drop policy if exists event_tickets_manage on public.event_tickets;
create policy event_tickets_manage on public.event_tickets
for all to authenticated
using (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
)
with check (
  public.is_platform_admin()
  or public.has_tenant_role(
    tenant_id,
    array['festival_owner','festival_staff']
  )
);


grant select, insert, update, delete
on table
  public.event_venues,
  public.ticketed_events,
  public.event_ticket_types,
  public.venue_seats,
  public.event_seat_inventory,
  public.event_orders,
  public.event_tickets
to authenticated;
