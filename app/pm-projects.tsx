import { useCallback } from 'react';
import { WorkflowRegister } from '@/components/workflows/WorkflowRegister';
import { createRow, currentUserId, listRows, updateRow } from '@/data/workflows/core';

export default function PMProjectsScreen() {
  const load = useCallback(() => listRows('projects', 'project.manage'), []);
  const create = useCallback(async (name: string) => createRow('projects', { owner_id: await currentUserId(), name, status: 'active', priority: 'medium' }, 'project.manage', 'project'), []);
  const advance = useCallback((row: any) => updateRow('projects', String(row.id), { status: row.status === 'active' ? 'completed' : 'active' }, 'project.manage', 'project'), []);
  return <WorkflowRegister eyebrow="PROJECT MANAGEMENT" title="Projects — Real Workflow" subtitle="Tenant-scoped project records now read and write through the active data adapter. Supabase RLS remains the production security boundary." emptyText="No projects yet for this tenant." inputLabel="New Project" inputPlaceholder="e.g. 2027 Festival Launch" load={load} create={create} primary={(r)=>String(r.name)} secondary={(r)=>`Priority: ${r.priority ?? 'not set'}${r.due_date ? ` • Due: ${String(r.due_date).slice(0,10)}` : ''}`} status={(r)=>String(r.status)} onAdvance={advance} advanceLabel="Toggle active/completed"/>;
}
