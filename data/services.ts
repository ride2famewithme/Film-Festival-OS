import { db } from './db';
import { assertTenantScope, can, type Permission } from './access';
import { getActiveContext } from './session';

async function requireContext(permission: Permission) {
  const ctx = await getActiveContext();
  if (!ctx) throw new Error('Authentication required');
  if (!can(ctx.role, permission)) throw new Error('Permission denied');
  return ctx;
}

export async function listTenantRows(table: string, permission: Permission = 'tenant.read') {
  const ctx = await requireContext(permission);
  const res = await db.from<any>(table).select().eq('tenant_id', ctx.tenantId);
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

export async function createTenantRow(table: string, values: Record<string, unknown>, permission: Permission) {
  const ctx = await requireContext(permission);
  if (values.tenant_id && String(values.tenant_id) !== ctx.tenantId) throw new Error('Cross-tenant write denied');
  const row = { ...values, tenant_id: ctx.tenantId };
  assertTenantScope(String(row.tenant_id), ctx.tenantId);
  const res = await db.from<any>(table).insert(row);
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

export async function writeAuditEvent(action: string, entityType: string, entityId?: string, detail: Record<string, unknown> = {}) {
  const ctx = await getActiveContext();
  if (!ctx) return;
  const res = await db.from<any>('audit_events').insert({
    tenant_id: ctx.tenantId,
    actor_user_id: ctx.userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    detail,
    created_at: new Date().toISOString(),
  });

  if (res.error) {
    throw new Error(`Audit event failed: ${res.error.message}`);
  }
}
