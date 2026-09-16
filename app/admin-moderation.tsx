import { useCallback } from 'react';
import { WorkflowRegister } from '@/components/workflows/WorkflowRegister';
import { createRow, listRows, updateRow, currentUserId } from '@/data/workflows/core';
export default function Screen(){
 const load=useCallback(()=>listRows('moderation_cases','moderation.manage'),[]);
 const create=useCallback(async(v:string)=>createRow('moderation_cases',{title:v,case_type:'report',status:'open',priority:'normal',created_by:await currentUserId(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()},'moderation.manage','moderation_case'),[]);
 const advance=useCallback(async(r:any)=>updateRow('moderation_cases',String(r.id),{status:r.status==='open'?'under_review':r.status==='under_review'?'decided':r.status==='decided'?'appeal':'closed',updated_at:new Date().toISOString()},'moderation.manage','moderation_case'),[]);
 return <WorkflowRegister eyebrow="GLOBAL HQ" title="Moderation, Complaints & Appeals" subtitle="Reasoned case lifecycle with preserved records: open → review → decision → appeal → closure." emptyText="No moderation cases." inputLabel="Open case" inputPlaceholder="Report, complaint or appeal summary" load={load} create={create} primary={(r)=>String(r.title)} secondary={(r)=>`${r.case_type} · Priority ${r.priority}`} status={(r)=>String(r.status)} onAdvance={advance} advanceLabel="Advance case"/>;
}
