import { useCallback } from 'react';
import { WorkflowRegister } from '@/components/workflows/WorkflowRegister';
import { createRow, currentUserId, listRows, updateRow } from '@/data/workflows/core';

export default function PMTasksScreen() {
  const load = useCallback(() => listRows('tasks', 'project.manage'), []);
  const create = useCallback(async (title: string) => {
    const projects = await listRows('projects', 'project.manage');
    if (!projects.length) throw new Error('Create a project first. Tasks must belong to a project.');
    return createRow('tasks', { project_id: projects[0].id, owner_id: await currentUserId(), title, status: 'todo', priority: 'medium' }, 'project.manage', 'task');
  }, []);
  const advance = useCallback((row: any) => {
    const next = row.status === 'todo' ? 'in_progress' : row.status === 'in_progress' ? 'done' : 'todo';
    return updateRow('tasks', String(row.id), { status: next }, 'project.manage', 'task');
  }, []);
  return <WorkflowRegister eyebrow="PROJECT MANAGEMENT" title="Tasks & Actions — Real Workflow" subtitle="Create persistent tenant-scoped tasks, attach them to the active tenant’s first project, and move them through a simple work lifecycle." emptyText="No tasks yet for this tenant." inputLabel="New Task / Action" inputPlaceholder="e.g. Confirm jury briefing" load={load} create={create} primary={(r)=>String(r.title)} secondary={(r)=>`Project: ${String(r.project_id)} • Priority: ${r.priority ?? 'not set'}`} status={(r)=>String(r.status)} onAdvance={advance} advanceLabel="Advance workflow"/>;
}
