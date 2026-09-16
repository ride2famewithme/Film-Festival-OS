import { useCallback } from 'react';
import { WorkflowRegister } from '@/components/workflows/WorkflowRegister';
import { createRow, currentUserId, listRows, updateRow } from '@/data/workflows/core';

export default function RiskRegisterScreen() {
  const load = useCallback(() => listRows('risks', 'risk.manage'), []);
  const create = useCallback(async (description: string) => createRow('risks', { category: 'Operational', description, rating: 'medium', owner_id: await currentUserId(), status: 'draft' }, 'risk.manage', 'risk'), []);
  const advance = useCallback((row: any) => {
    const flow: Record<string,string> = { draft:'assessed', assessed:'controlled', controlled:'review', review:'closed', closed:'draft' };
    return updateRow('risks', String(row.id), { status: flow[String(row.status)] ?? 'assessed' }, 'risk.manage', 'risk');
  }, []);
  return <WorkflowRegister eyebrow="SAFETY NET CENTRE™" title="Enterprise Risk Register — Real Workflow" subtitle="Tenant-scoped risk records now persist through the active adapter and write audit events. Final risk acceptance remains a human decision." emptyText="No risks recorded for this tenant." inputLabel="Record Risk" inputPlaceholder="Describe the risk in plain language" load={load} create={create} primary={(r)=>String(r.description)} secondary={(r)=>`${r.category} • Rating: ${r.rating}`} status={(r)=>String(r.status)} onAdvance={advance} advanceLabel="Advance risk lifecycle"/>;
}
