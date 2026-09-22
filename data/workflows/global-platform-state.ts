import { requireSupabaseClient } from '@/data/supabase-client';
import { getActiveContext } from '@/data/session';

const client = requireSupabaseClient();

export type GlobalPlatformState =
  | 'active'
  | 'restricted'
  | 'suspended'
  | 'retired';

export async function getGlobalPlatformState() {
  const { data, error } =
    await client.rpc('get_platform_global_state');

  if (error)
    throw new Error(error.message);

  return data as {
    state: GlobalPlatformState;
    changed_at: string;
  };
}

export async function setGlobalPlatformState(
  state: GlobalPlatformState,
  reason: string,
  confirmation = ''
) {
  const ctx = await getActiveContext();

  if (!ctx)
    throw new Error('Authentication required.');

  if (ctx.role !== 'platform_admin')
    throw new Error('GLOBAL MASTER authority required.');

  const { data, error } =
    await client.rpc('set_platform_global_state', {
      p_state: state,
      p_reason: reason.trim(),
      p_audit_tenant_id: ctx.tenantId,
      p_confirmation: confirmation.trim(),
    });

  if (error)
    throw new Error(error.message);

  return data;
}
