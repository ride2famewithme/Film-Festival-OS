import { useCallback } from 'react';
import { WorkflowRegister } from '@/components/workflows/WorkflowRegister';
import { createRow, listRows, updateRow, currentUserId } from '@/data/workflows/core';
export default function Screen(){
 const load=useCallback(()=>listRows('platform_settings','platform.configure'),[]);
 const create=useCallback(async(v:string)=>createRow('platform_settings',{setting_key:v.toLowerCase().replace(/[^a-z0-9]+/g,'_'),setting_value:'off',status:'draft',updated_by:await currentUserId(),updated_at:new Date().toISOString()},'platform.configure','platform_setting'),[]);
 const advance=useCallback(async(r:any)=>updateRow('platform_settings',String(r.id),{status:r.status==='draft'?'active':'draft',setting_value:r.setting_value==='off'?'on':'off',updated_by:await currentUserId(),updated_at:new Date().toISOString()},'platform.configure','platform_setting'),[]);
 return <WorkflowRegister eyebrow="GLOBAL HQ" title="Platform Configuration" subtitle="Audited global settings and feature controls. Sensitive production changes still require server-side authority and release procedure." emptyText="No settings for this tenant." inputLabel="Create configuration key" inputPlaceholder="e.g. submissions_v2" load={load} create={create} primary={(r)=>String(r.setting_key)} secondary={(r)=>`Value: ${r.setting_value}`} status={(r)=>String(r.status)} onAdvance={advance} advanceLabel="Toggle draft/active"/>;
}
