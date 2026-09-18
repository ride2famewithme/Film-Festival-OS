import { db } from '@/data/db';
import { getActiveContext } from '@/data/session';
import { can } from '@/data/access';
import { writeAuditEvent } from '@/data/services';

async function manager() {
  const ctx = await getActiveContext();
  if (!ctx) throw new Error('Authentication required');
  if (!can(ctx.role, 'festival.manage')) throw new Error('Permission denied');
  return ctx;
}

export async function listVenues() {
  const c = await manager();
  const r = await db.from<any>('event_venues')
    .select('*')
    .eq('tenant_id', c.tenantId)
    .order('name');
  if (r.error) throw new Error(r.error.message);
  return r.data ?? [];
}

export async function createVenue(values: {
  name: string;
  venue_type?: string;
  city?: string;
  country?: string;
  declared_safe_capacity?: number | null;
  seated_capacity?: number | null;
  standing_capacity?: number | null;
  capacity_source?: string | null;
  venue_url?: string | null;
}) {
  const c = await manager();
  const name = values.name.trim();
  if (!name) throw new Error('Venue name is required.');

  const safeCapacity =
    values.declared_safe_capacity === null ||
    values.declared_safe_capacity === undefined
      ? null
      : Number(values.declared_safe_capacity);

  if (safeCapacity !== null && (!Number.isFinite(safeCapacity) || safeCapacity < 0)) {
    throw new Error('Declared safe capacity must be zero or greater.');
  }

  const r = await db.from<any>('event_venues').insert({
    tenant_id: c.tenantId,
    name,
    venue_type: values.venue_type || 'cinema',
    city: values.city?.trim() || null,
    country: values.country?.trim() || null,
    declared_safe_capacity: safeCapacity,
    seated_capacity: values.seated_capacity ?? null,
    standing_capacity: values.standing_capacity ?? null,
    capacity_source: values.capacity_source?.trim() || null,
    venue_url: values.venue_url?.trim() || null,
    status: 'active',
    updated_at: new Date().toISOString(),
  });

  if (r.error) throw new Error(r.error.message);
  const row = (r.data ?? [])[0];

  await writeAuditEvent(
    'ticketing.venue_created',
    'event_venue',
    row?.id,
    { name, declaredSafeCapacity: safeCapacity }
  );

  return row;
}

export async function listTicketedEvents() {
  const c = await manager();
  const r = await db.from<any>('ticketed_events')
    .select('*')
    .eq('tenant_id', c.tenantId)
    .order('starts_at', { ascending: true });
  if (r.error) throw new Error(r.error.message);
  return r.data ?? [];
}

export async function createTicketedEvent(values: {
  title: string;
  event_kind?: string;
  delivery_mode: 'in_person' | 'online' | 'hybrid';
  venue_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  manual_capacity?: number | null;
  online_capacity?: number | null;
  external_provider?: 'native' | 'eventbrite' | 'ticketebo' | 'other';
  external_ticket_url?: string | null;
}) {
  const c = await manager();
  const title = values.title.trim();
  if (!title) throw new Error('Event title is required.');

  const venueId = values.venue_id || null;
  if (values.delivery_mode === 'in_person' && !venueId) {
    throw new Error('In-person events require a venue.');
  }

  const capacityMode =
    values.delivery_mode === 'online' && !values.online_capacity
      ? 'unlimited_virtual'
      : venueId
        ? 'venue'
        : 'manual';

  const r = await db.from<any>('ticketed_events').insert({
    tenant_id: c.tenantId,
    title,
    event_kind: values.event_kind || 'screening',
    delivery_mode: values.delivery_mode,
    venue_id: venueId,
    starts_at: values.starts_at || null,
    ends_at: values.ends_at || null,
    capacity_mode: capacityMode,
    manual_capacity: values.manual_capacity ?? null,
    online_capacity: values.online_capacity ?? null,
    sales_status: 'draft',
    public_listing: false,
    external_provider: values.external_provider || 'native',
    external_ticket_url: values.external_ticket_url?.trim() || null,
    stream_access_mode:
      values.delivery_mode === 'online' || values.delivery_mode === 'hybrid'
        ? 'ticket_unlock'
        : 'none',
    updated_at: new Date().toISOString(),
  });

  if (r.error) throw new Error(r.error.message);
  const row = (r.data ?? [])[0];

  await writeAuditEvent(
    'ticketing.event_created',
    'ticketed_event',
    row?.id,
    {
      title,
      deliveryMode: values.delivery_mode,
      provider: values.external_provider || 'native',
    }
  );

  return row;
}

export async function listTicketTypes(eventId?: string) {
  const c = await manager();
  let q = db.from<any>('event_ticket_types')
    .select('*')
    .eq('tenant_id', c.tenantId);
  if (eventId) q = q.eq('event_id', eventId);
  const r = await q.order('name');
  if (r.error) throw new Error(r.error.message);
  return r.data ?? [];
}

export async function createTicketType(values: {
  event_id: string;
  name: string;
  price_cents: number;
  currency?: string;
  admission_mode?: 'in_person' | 'online' | 'hybrid';
  inventory_limit?: number | null;
}) {
  const c = await manager();
  const name = values.name.trim();
  if (!name) throw new Error('Ticket type name is required.');

  const price = Number(values.price_cents);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Ticket price must be zero or greater.');
  }

  const r = await db.from<any>('event_ticket_types').insert({
    tenant_id: c.tenantId,
    event_id: values.event_id,
    name,
    price_cents: Math.round(price),
    currency: (values.currency || 'AUD').toUpperCase(),
    admission_mode: values.admission_mode || 'in_person',
    inventory_limit: values.inventory_limit ?? null,
    status: 'active',
    updated_at: new Date().toISOString(),
  });

  if (r.error) throw new Error(r.error.message);
  const row = (r.data ?? [])[0];

  await writeAuditEvent(
    'ticketing.ticket_type_created',
    'event_ticket_type',
    row?.id,
    { eventId: values.event_id, name, priceCents: Math.round(price) }
  );

  return row;
}

export async function getTicketingSnapshot() {
  const c = await manager();

  const [venues, events, orders, tickets] = await Promise.all([
    db.from<any>('event_venues').select('*').eq('tenant_id', c.tenantId),
    db.from<any>('ticketed_events').select('*').eq('tenant_id', c.tenantId),
    db.from<any>('event_orders').select('*').eq('tenant_id', c.tenantId),
    db.from<any>('event_tickets').select('*').eq('tenant_id', c.tenantId),
  ]);

  for (const r of [venues, events, orders, tickets]) {
    if (r.error) throw new Error(r.error.message);
  }

  const orderRows = orders.data ?? [];
  return {
    venues: (venues.data ?? []).length,
    events: (events.data ?? []).length,
    onSale: (events.data ?? []).filter((x:any) => x.sales_status === 'on_sale').length,
    orders: orderRows.length,
    tickets: (tickets.data ?? []).length,
    grossCents: orderRows
      .filter((x:any) => x.payment_status === 'paid')
      .reduce((sum:number, x:any) => sum + Number(x.total_cents || 0), 0),
  };
}
