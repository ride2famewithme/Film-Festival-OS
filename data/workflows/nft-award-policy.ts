import { getActiveContext } from '@/data/session';
import { can } from '@/data/access';
import { requireSupabaseClient } from '@/data/supabase-client';

export type NftPlacement =
  | 'winner'
  | 'second_place'
  | 'third_place'
  | 'jury_choice'
  | 'audience_choice'
  | 'special_recognition';

async function manager() {
  const ctx = await getActiveContext();

  if (!ctx)
    throw new Error(
      'Authentication required'
    );

  if (!can(ctx.role, 'festival.manage'))
    throw new Error(
      'Permission denied'
    );

  return ctx;
}


export async function getTenantNftAwardPolicy() {
  const ctx = await manager();

  const client = requireSupabaseClient();

  const r = await client.rpc(
    'get_tenant_nft_award_policy',
    {
      p_tenant_id: ctx.tenantId,
    }
  );

  if (r.error)
    throw new Error(r.error.message);

  return (r.data ?? [])[0] ?? null;
}


export async function setTenantNftAwardPolicy(
  values: {
    winner: number | null;
    second: number | null;
    third: number | null;
    jury: number | null;
    audience: number | null;
    special: number | null;
    allowDescendantOverride: boolean;
  }
) {
  const ctx = await manager();

  const client = requireSupabaseClient();

  const r = await client.rpc(
    'set_tenant_nft_award_policy',
    {
      p_tenant_id:
        ctx.tenantId,
      p_winner:
        values.winner,
      p_second:
        values.second,
      p_third:
        values.third,
      p_jury:
        values.jury,
      p_audience:
        values.audience,
      p_special:
        values.special,
      p_allow_descendant_override:
        values.allowDescendantOverride,
    }
  );

  if (r.error)
    throw new Error(r.error.message);

  return true;
}


export async function resolveNftSuggestedValue(
  placement: NftPlacement
) {
  const ctx = await manager();

  const client = requireSupabaseClient();

  const r = await client.rpc(
    'resolve_nft_suggested_value',
    {
      p_tenant_id:
        ctx.tenantId,
      p_placement:
        placement,
    }
  );

  if (r.error)
    throw new Error(r.error.message);

  return (r.data ?? [])[0] ?? null;
}
