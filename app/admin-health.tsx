import { useCallback } from 'react';
import { WorkflowRegister } from '@/components/workflows/WorkflowRegister';
import { createRow, listRows, updateRow, currentUserId } from '@/data/workflows/core';
export default function Screen(){
 const load=useCallback(()=>listRows('service_health_checks','health.manage'),[]);
 const create=useCallback(async(v:string)=>createRow('service_health_checks',{service_name:v,status:'unknown',detail:'Manual pre-test check',checked_by:await currentUserId(),checked_at:new Date().toISOString()},'health.manage','service_health'),[]);
 const advance=useCallback(async(r:any)=>updateRow('service_health_checks',String(r.id),{status:r.status==='unknown'?'checking':r.status==='checking'?'healthy':r.status==='healthy'?'degraded':'unknown',checked_by:await currentUserId(),checked_at:new Date().toISOString()},'health.manage','service_health'),[]);
 return <WorkflowRegister eyebrow="GLOBAL HQ" title="System Health & Release Readiness" subtitle="Evidence register for service checks. A manual status record is not a production uptime monitor or release certification." emptyText="No service checks recorded." inputLabel="Add service/check" inputPlaceholder="Authentication, submissions, storage..." load={load} create={create} primary={(r)=>String(r.service_name)} secondary={(r)=>String(r.detail??'Health check')} status={(r)=>String(r.status)} onAdvance={advance} advanceLabel="Advance check state"/>;
}
