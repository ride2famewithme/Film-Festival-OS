import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './db';
import type { PlatformRole } from './access';

const ACTIVE_TENANT_KEY = 'ffos.activeTenantId';

export type ActiveContext = {
  userId: string;
  email: string;
  tenantId: string;
  role: PlatformRole;
};

export async function listActiveMemberships() {
  const session = await db.auth.getSession();
  if (session.error || !session.data) return [];
  const res = await db.from<any>('memberships').select().eq('user_id', session.data.user.id).eq('status', 'active');
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

export async function setActiveTenant(tenantId: string): Promise<void> {
  const memberships = await listActiveMemberships();
  if (!memberships.some((m: any) => String(m.tenant_id) === tenantId)) throw new Error('Tenant membership required');
  await AsyncStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
}

export async function clearActiveTenant(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_TENANT_KEY);
}

export async function getActiveContext(): Promise<ActiveContext | null> {
  const session = await db.auth.getSession();
  if (session.error || !session.data) return null;
  const memberships = await listActiveMemberships();
  if (!memberships.length) return null;
  const preferred = await AsyncStorage.getItem(ACTIVE_TENANT_KEY);
  const membership = memberships.find((m: any) => String(m.tenant_id) === preferred) ?? memberships[0];
  return {
    userId: session.data.user.id,
    email: session.data.user.email,
    tenantId: String((membership as any).tenant_id),
    role: String((membership as any).role) as PlatformRole,
  };
}
