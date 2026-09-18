import { db } from '@/data/db';
import { getActiveContext } from '@/data/session';
import { requireSupabaseClient } from '@/data/supabase-client';

export type GovernanceControl = {
  id: string;
  tenant_id: string;
  control_code: string;
  title: string;
  purpose: string;
  status: string;
  owner_user_id: string;
  linked_risk_id?: string | null;
  linked_obligation_ref?: string | null;
  implementation_notes?: string | null;
  next_review_due: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

async function controlLibraryContext() {
  const ctx = await getActiveContext();

  if (!ctx) {
    throw new Error('Authentication required');
  }

  return ctx;
}

export async function listGovernanceControls(): Promise<GovernanceControl[]> {
  const ctx = await controlLibraryContext();

  const result = await db
    .from<any>('governance_controls')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .order('control_code', { ascending: true });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []) as GovernanceControl[];
}

export async function getGovernanceControl(
  controlId: string
): Promise<GovernanceControl | null> {
  const ctx = await controlLibraryContext();

  const result = await db
    .from<any>('governance_controls')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('id', controlId);

  if (result.error) {
    throw new Error(result.error.message);
  }

  return ((result.data ?? [])[0] ?? null) as GovernanceControl | null;
}

export async function createGovernanceControl(values: {
  title: string;
  purpose: string;
  linkedRiskId?: string | null;
  linkedObligationRef?: string | null;
}): Promise<GovernanceControl> {
  const ctx = await controlLibraryContext();

  const title = values.title.trim();
  const purpose = values.purpose.trim();

  if (!title) {
    throw new Error('Control title is required.');
  }

  if (!purpose) {
    throw new Error('Control purpose is required.');
  }

  const client = requireSupabaseClient();

  const { data, error } = await client.rpc(
    'create_governance_control',
    {
      p_tenant_id: ctx.tenantId,
      p_title: title,
      p_purpose: purpose,
      p_linked_risk_id:
        values.linkedRiskId || null,
      p_linked_obligation_ref:
        values.linkedObligationRef?.trim() || null,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data)
    ? data[0]
    : data;

  if (!row) {
    throw new Error(
      'Control was created but no record was returned.'
    );
  }

  return row as GovernanceControl;
}

export async function getControlLibrarySummary() {
  const controls = await listGovernanceControls();

  return {
    total: controls.length,

    designed: controls.filter(
      (control) => control.status === 'designed'
    ).length,

    implemented: controls.filter(
      (control) => control.status === 'implemented'
    ).length,

    tested: controls.filter(
      (control) => control.status === 'tested'
    ).length,

    failed: controls.filter(
      (control) => control.status === 'failed'
    ).length,

    remediationRequired: controls.filter(
      (control) =>
        control.status === 'remediation_required'
    ).length,

    closed: controls.filter(
      (control) => control.status === 'closed'
    ).length,

    reviewDue: controls.filter((control) => {
      if (!control.next_review_due) return false;

      const due = new Date(
        `${control.next_review_due}T23:59:59`
      );

      return due.getTime() < Date.now();
    }).length,
  };
}

export type GovernanceControlStatus =
  | 'designed'
  | 'implemented'
  | 'tested'
  | 'failed'
  | 'remediation_required'
  | 'closed';

export async function setGovernanceControlStatus(
  controlId: string,
  status: GovernanceControlStatus,
  notes?: string
): Promise<GovernanceControl> {
  await controlLibraryContext();

  const client = requireSupabaseClient();

  const { data, error } = await client.rpc(
    'set_governance_control_status',
    {
      p_control_id: controlId,
      p_status: status,
      p_notes: notes?.trim() || null,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data)
    ? data[0]
    : data;

  if (!row) {
    throw new Error(
      'Control status changed but no record was returned.'
    );
  }

  return row as GovernanceControl;
}


export type ControlAuditEvent = {
  id: string;
  action: string;
  actor_user_id: string | null;
  detail: any;
  created_at: string;
};

export async function listGovernanceControlAudit(
  controlId: string
): Promise<ControlAuditEvent[]> {
  const ctx = await controlLibraryContext();

  const result = await db
    .from<any>('audit_events')
    .select('id,action,actor_user_id,detail,created_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('entity_type', 'governance_control')
    .eq('entity_id', controlId)
    .order('created_at', { ascending: false });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []) as ControlAuditEvent[];
}
