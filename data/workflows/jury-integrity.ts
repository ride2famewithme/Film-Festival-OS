import { db } from '@/data/db';
import { getActiveContext } from '@/data/session';
import { can } from '@/data/access';
import { writeAuditEvent } from '@/data/services';

export type JuryIntegrityEventType =
  | 'conflict_declared'
  | 'recusal'
  | 'contact_attempt'
  | 'canvassing_attempt'
  | 'gift_or_inducement'
  | 'pressure_or_lobbying'
  | 'score_disclosure'
  | 'manual_review';

export type JuryIntegritySeverity =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

async function manager() {
  const ctx = await getActiveContext();

  if (!ctx) throw new Error('Authentication required');
  if (!can(ctx.role, 'jury.manage')) throw new Error('Permission denied');

  return ctx;
}

export async function listJuryIntegrityEvents() {
  const c = await manager();

  const r = await db
    .from<any>('jury_integrity_events')
    .select('*')
    .eq('tenant_id', c.tenantId)
    .order('created_at', { ascending: false });

  if (r.error) throw new Error(r.error.message);

  return r.data ?? [];
}

export async function createJuryIntegrityEvent(v: {
  event_type: JuryIntegrityEventType;
  severity: JuryIntegritySeverity;
  note: string;
}) {
  const c = await manager();

  const r = await db.from<any>('jury_integrity_events').insert({
    tenant_id: c.tenantId,
    event_type: v.event_type,
    severity: v.severity,
    note: v.note.trim(),
    resolved: false,
    created_by: c.userId,
    created_at: new Date().toISOString(),
  });

  if (r.error) throw new Error(r.error.message);

  const row = (r.data ?? [])[0];

  await writeAuditEvent(
    'jury.integrity_event_created',
    'jury_integrity_event',
    row?.id,
    {
      event_type: v.event_type,
      severity: v.severity,
    }
  );

  return row;
}

export async function resolveJuryIntegrityEvent(id: string) {
  const c = await manager();

  const r = await db
    .from<any>('jury_integrity_events')
    .update({ resolved: true })
    .eq('id', id)
    .eq('tenant_id', c.tenantId);

  if (r.error) throw new Error(r.error.message);

  await writeAuditEvent(
    'jury.integrity_event_resolved',
    'jury_integrity_event',
    id,
    {}
  );
}
