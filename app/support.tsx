import { useCallback } from 'react';
import { WorkflowRegister } from '@/components/workflows/WorkflowRegister';
import { createRow, listRows, updateRow, currentUserId } from '@/data/workflows/core';
export default function Support(){
 const load=useCallback(()=>listRows('support_cases','support.manage'),[]);
 const create=useCallback(async(v:string)=>createRow('support_cases',{subject:v,category:'general',priority:'normal',status:'open',opened_by:await currentUserId(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()},'support.manage','support_case'),[]);
 const advance=useCallback(async(r:any)=>updateRow('support_cases',String(r.id),{status:r.status==='open'?'assigned':r.status==='assigned'?'waiting':r.status==='waiting'?'resolved':'closed',updated_at:new Date().toISOString()},'support.manage','support_case'),[]);
 return <WorkflowRegister eyebrow="SUPPORT" title="Support Cases & Escalations" subtitle="Persistent tenant-scoped assistance cases with owner-visible lifecycle and audit records." emptyText="No support cases." inputLabel="Open support case" inputPlaceholder="What needs assistance?" load={load} create={create} primary={(r)=>String(r.subject)} secondary={(r)=>`${r.category} · Priority ${r.priority}`} status={(r)=>String(r.status)} onAdvance={advance} advanceLabel="Advance case"/>;
}
