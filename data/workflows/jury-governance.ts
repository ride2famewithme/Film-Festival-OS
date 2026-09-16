import { db } from '@/data/db';
import { getActiveContext } from '@/data/session';
import { can } from '@/data/access';
import { writeAuditEvent } from '@/data/services';
import { requireSupabaseClient } from '@/data/supabase-client';

async function manager() {
  const ctx = await getActiveContext();
  if (!ctx) throw new Error('Authentication required');
  if (!can(ctx.role, 'jury.manage')) throw new Error('Permission denied');
  return ctx;
}

export async function getJuryGovernanceSettings() {
  const c = await manager();
  const r = await db
    .from<any>('jury_governance_settings')
    .select('*')
    .eq('tenant_id', c.tenantId);

  if (r.error) throw new Error(r.error.message);
  return (r.data ?? [])[0] ?? null;
}

export async function listJuryPanelMembers() {
  const c = await manager();
  const r = await db
    .from<any>('jury_panel_members')
    .select('*')
    .eq('tenant_id', c.tenantId)
    .order('invited_at', { ascending: true });

  if (r.error) throw new Error(r.error.message);
  return r.data ?? [];
}

export async function listJurorCandidates() {
  const c = await manager();
  const client = requireSupabaseClient();

  const { data, error } = await client.rpc('jury_member_candidates', {
    p_tenant_id: c.tenantId,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function inviteJurorAccount(email: string) {
  const c = await manager();
  const client = requireSupabaseClient();

  const { data, error } = await client.functions.invoke('invite-staff', {
    body: {
      email: email.trim().toLowerCase(),
      tenant_id: c.tenantId,
      role: 'juror',
    },
  });

  if (error) {
    let message = error.message;
    try {
      const body = await (error as any).context?.json();
      if (body?.error) message = String(body.error);
    } catch {}
    throw new Error(message);
  }

  if (data?.error) throw new Error(String(data.error));

  await writeAuditEvent(
    'jury.account_invited',
    'membership',
    data?.user_id,
    { email: email.trim().toLowerCase(), role: 'juror' }
  );

  return data;
}

export async function linkJuryPanelMemberAccount(
  panelMemberId: string,
  userId: string
) {
  await manager();
  const client = requireSupabaseClient();

  const { data, error } = await client.rpc(
    'link_jury_panel_member_account',
    {
      p_panel_member_id: panelMemberId,
      p_user_id: userId,
    }
  );

  if (error) throw new Error(error.message);

  await writeAuditEvent(
    'jury.panel_member_account_linked',
    'jury_panel_member',
    panelMemberId,
    { user_id: userId }
  );

  return data;
}

export async function createJuryPanelMember(v: {
  display_label: string;
  juror_kind: 'independent' | 'vip_guest' | 'sponsor' | 'ai';
  weight_percent: number;
}) {
  const c = await manager();

  const r = await db.from<any>('jury_panel_members').insert({
    tenant_id: c.tenantId,
    display_label: v.display_label.trim(),
    juror_kind: v.juror_kind,
    weight_percent: v.weight_percent,
    status: 'invited',
    conflict_status: 'clear',
    identity_visibility: 'confidential',
    consent_to_reveal: false,
    created_by: c.userId,
    invited_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (r.error) throw new Error(r.error.message);

  const row = (r.data ?? [])[0];

  await writeAuditEvent(
    'jury.panel_member_created',
    'jury_panel_member',
    row?.id,
    {
      kind: v.juror_kind,
      weight: v.weight_percent,
      confidentiality: 'confidential',
    }
  );

  return row;
}

export async function recuseJuryPanelMember(id: string) {
  const c = await manager();

  const r = await db
    .from<any>('jury_panel_members')
    .update({
      status: 'recused',
      conflict_status: 'recused',
      recused_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', c.tenantId);

  if (r.error) throw new Error(r.error.message);

  await writeAuditEvent(
    'jury.recused',
    'jury_panel_member',
    id,
    {}
  );
}
