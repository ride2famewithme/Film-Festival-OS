import { useCallback } from 'react';
import { WorkflowRegister } from '@/components/workflows/WorkflowRegister';
import {
  createRow,
  currentUserId,
  listRows,
  updateRow,
} from '@/data/workflows/core';

export default function IncidentsScreen() {
  const load = useCallback(
    () => listRows('incidents', 'risk.manage'),
    []
  );

  const create = useCallback(async (summary: string) => {
    return createRow(
      'incidents',
      {
        severity: 'medium',
        summary,
        status: 'open',
        owner_id: await currentUserId(),
        occurred_at: new Date().toISOString(),
      },
      'risk.manage',
      'incident'
    );
  }, []);

  const advance = useCallback((row: any) => {
    const flow: Record<string,string> = {
      open: 'contained',
      contained: 'investigating',
      investigating: 'remediated',
      remediated: 'closed',
      closed: 'open',
    };

    return updateRow(
      'incidents',
      String(row.id),
      {
        status: flow[String(row.status)] ?? 'contained',
      },
      'risk.manage',
      'incident'
    );
  }, []);

  return (
    <WorkflowRegister
      eyebrow="SAFETY NET CENTRE™"
      title="Incidents & Remediation — Real Workflow"
      subtitle="Tenant-scoped incident records with severity, ownership, lifecycle status and audit history."
      emptyText="No incidents recorded for this tenant."
      inputLabel="Record Incident"
      inputPlaceholder="Describe the incident in plain language"
      load={load}
      create={create}
      createSuccessMessage="Incident recorded and audit event created."
      primary={(r) => String(r.summary)}
      secondary={(r) =>
        `${String(r.severity).toUpperCase()} • ${new Date(r.occurred_at).toLocaleString()}`
      }
      status={(r) => String(r.status)}
      onAdvance={advance}
      advanceLabel="Advance incident lifecycle"
    />
  );
}
