import { db } from '@/data/db';
import { getActiveContext } from '@/data/session';
import { can, type Permission } from '@/data/access';
import { writeAuditEvent } from '@/data/services';

async function context(permission: Permission) {
  const ctx = await getActiveContext();
  if (!ctx) throw new Error('Authentication required');
  if (!can(ctx.role, permission)) throw new Error('Permission denied');
  return ctx;
}

export async function listRows(table: string, permission: Permission) {
  const ctx = await context(permission);
  const result = await db.from<any>(table).select('*').eq('tenant_id', ctx.tenantId);
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function createRow(table: string, values: Record<string, unknown>, permission: Permission, entityType = table) {
  const ctx = await context(permission);
  const row = { ...values, tenant_id: ctx.tenantId };
  const result = await db.from<any>(table).insert(row);
  if (result.error) throw new Error(result.error.message);
  const created = (result.data ?? [])[0];
  await writeAuditEvent(`${entityType}.created`, entityType, created?.id ? String(created.id) : undefined, { source: 'workflow' });
  return created;
}

export async function updateRow(table: string, id: string, patch: Record<string, unknown>, permission: Permission, entityType = table) {
  const ctx = await context(permission);
  const result = await db.from<any>(table).update(patch).eq('id', id).eq('tenant_id', ctx.tenantId);
  if (result.error) throw new Error(result.error.message);
  await writeAuditEvent(`${entityType}.updated`, entityType, id, { changed: Object.keys(patch) });
  return (result.data ?? [])[0];
}

export async function currentUserId() {
  const ctx = await getActiveContext();
  if (!ctx) throw new Error('Authentication required');
  return ctx.userId;
}
