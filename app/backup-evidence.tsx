import { useCallback } from 'react';
import { WorkflowRegister } from '@/components/workflows/WorkflowRegister';
import {
  createRow,
  currentUserId,
  listRows,
  updateRow,
} from '@/data/workflows/core';

export default function BackupEvidenceScreen() {
  const load = useCallback(
    () => listRows('backup_evidence', 'risk.manage'),
    []
  );

  const create = useCallback(async (label: string) => {
    return createRow(
      'backup_evidence',
      {
        label,
        evidence_type: 'full_backup',
        status: 'recorded',
        created_by: await currentUserId(),
        recorded_at: new Date().toISOString(),
      },
      'risk.manage',
      'backup_evidence'
    );
  }, []);

  const advance = useCallback((row: any) => {
    const flow: Record<string,string> = {
      recorded: 'verified',
      verified: 'restore_tested',
      restore_tested: 'archived',
      archived: 'recorded',
    };

    return updateRow(
      'backup_evidence',
      String(row.id),
      { status: flow[String(row.status)] ?? 'verified' },
      'risk.manage',
      'backup_evidence'
    );
  }, []);

  return (
    <WorkflowRegister
      eyebrow="SAFETY NET CENTRE™"
      title="Backup Evidence — Real Workflow"
      subtitle="Tenant-scoped backup, verification and restore-test evidence."
      emptyText="No backup evidence recorded for this tenant."
      inputLabel="Record Backup Evidence"
      inputPlaceholder="Example: FFOS full recovery backup — 16 Sep 2026"
      load={load}
      create={create}
      createSuccessMessage="Backup evidence recorded and audit event created."
      primary={(r) => String(r.label)}
      secondary={(r) =>
        `${String(r.evidence_type).toUpperCase()} • ${new Date(r.recorded_at).toLocaleString()}`
      }
      status={(r) => String(r.status)}
      onAdvance={advance}
      advanceLabel="Advance verification status"
    />
  );
}
