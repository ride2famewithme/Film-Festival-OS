import { useCallback } from 'react';
import { WorkflowRegister } from '@/components/workflows/WorkflowRegister';
import { createRow, listRows, updateRow, currentUserId } from '@/data/workflows/core';
export default function Screen(){
 const load=useCallback(()=>listRows('refund_requests','finance.manage'),[]);
 const create=useCallback(async(v:string)=>createRow('refund_requests',{reference:v,amount:0,currency:'USD',reason:'Manual review required',status:'requested',requested_by:await currentUserId(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()},'finance.manage','refund_request'),[]);
 const advance=useCallback(async(r:any)=>updateRow('refund_requests',String(r.id),{status:r.status==='requested'?'review':r.status==='review'?'approved':r.status==='approved'?'provider_pending':'closed',updated_at:new Date().toISOString()},'finance.manage','refund_request'),[]);
 return <WorkflowRegister eyebrow="GLOBAL HQ" title="Finance Oversight & Refunds" subtitle="Controlled refund oversight without storing card data or pretending to replace the payment provider." emptyText="No refund requests." inputLabel="Create refund review" inputPlaceholder="Payment/submission/provider reference" load={load} create={create} primary={(r)=>String(r.reference)} secondary={(r)=>`${r.currency} ${Number(r.amount??0).toFixed(2)} · ${r.reason}`} status={(r)=>String(r.status)} onAdvance={advance} advanceLabel="Advance review"/>;
}
