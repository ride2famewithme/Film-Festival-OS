import { db } from '@/data/db';
import { getActiveContext } from '@/data/session';
import { can, type Permission } from '@/data/access';
import { writeAuditEvent } from '@/data/services';

async function ctx(permission: Permission) {
  const c = await getActiveContext();
  if (!c) throw new Error('Authentication required');
  if (!can(c.role, permission)) throw new Error('Permission denied');
  return c;
}

export async function listCommunicationTemplates() {
  const c = await ctx('submission.manage');
  const r = await db.from<any>('communication_templates').select('*').eq('tenant_id', c.tenantId).order('updated_at', { ascending: false });
  if (r.error) throw new Error(r.error.message); return r.data ?? [];
}
export async function createCommunicationTemplate(values:{name:string;template_key:string;subject:string;body:string}) {
  const c = await ctx('submission.manage'); const now = new Date().toISOString();
  const r = await db.from<any>('communication_templates').insert({...values,tenant_id:c.tenantId,status:'active',updated_at:now});
  if (r.error) throw new Error(r.error.message); const row=(r.data??[])[0];
  await writeAuditEvent('communication_template.created','communication_template',row?.id,{templateKey:values.template_key}); return row;
}
export async function toggleCommunicationTemplate(id:string,current:string) {
  const c=await ctx('submission.manage'); const status=current==='active'?'paused':'active';
  const r=await db.from<any>('communication_templates').update({status,updated_at:new Date().toISOString()}).eq('id',id).eq('tenant_id',c.tenantId);
  if(r.error) throw new Error(r.error.message); await writeAuditEvent('communication_template.status_changed','communication_template',id,{status}); return (r.data??[])[0];
}

export async function listExportJobs() {
  const c=await ctx('tenant.read'); const r=await db.from<any>('export_jobs').select('*').eq('tenant_id',c.tenantId).order('requested_at',{ascending:false});
  if(r.error) throw new Error(r.error.message); return r.data??[];
}
export async function requestExport(reportType:string,format:'csv'|'xlsx'|'json') {
  const c=await ctx('tenant.read'); const now=new Date().toISOString();
  const r=await db.from<any>('export_jobs').insert({tenant_id:c.tenantId,requested_by:c.userId,report_type:reportType,format,status:'queued',requested_at:now,expires_at:null,file_path:null});
  if(r.error) throw new Error(r.error.message); const row=(r.data??[])[0];
  await writeAuditEvent('export.requested','export_job',row?.id,{reportType,format}); return row;
}
export async function advanceExportJob(id:string,current:string) {
  const c=await ctx('tenant.read'); const next=current==='queued'?'generated':current==='generated'?'expired':'queued';
  const patch:any={status:next}; if(next==='generated'){patch.generated_at=new Date().toISOString();patch.file_path=`exports/${id}.placeholder`;patch.expires_at=new Date(Date.now()+7*86400000).toISOString();}
  const r=await db.from<any>('export_jobs').update(patch).eq('id',id).eq('tenant_id',c.tenantId); if(r.error)throw new Error(r.error.message);
  await writeAuditEvent('export.status_changed','export_job',id,{status:next}); return (r.data??[])[0];
}

export async function listAuditEvents(limit=100) {
  const c=await ctx('audit.read'); const r=await db.from<any>('audit_events').select('*').eq('tenant_id',c.tenantId).order('created_at',{ascending:false}).limit(limit);
  if(r.error)throw new Error(r.error.message); return r.data??[];
}

export async function getOperationalSnapshot() {
  const c=await ctx('tenant.read');
  const tables=['submissions','jury_assignments','jury_reviews','notifications','submission_payments','awards','projects','tasks','risks'];
  const out:Record<string,any[]>={};
  for(const table of tables){const r=await db.from<any>(table).select('*').eq('tenant_id',c.tenantId);if(r.error)throw new Error(r.error.message);out[table]=r.data??[];}
  return {
    submissions:out.submissions.length,
    submissionsPending:out.submissions.filter((x:any)=>!['decision_published','closed'].includes(x.status)).length,
    juryAssigned:out.jury_assignments.length,
    juryCompleted:out.jury_assignments.filter((x:any)=>x.status==='completed').length,
    notificationsQueued:out.notifications.filter((x:any)=>x.status==='queued').length,
    paymentsPending:out.submission_payments.filter((x:any)=>x.payment_status==='pending').length,
    awardsDraft:out.awards.filter((x:any)=>x.publication_status==='draft').length,
    projectsActive:out.projects.filter((x:any)=>x.status==='active').length,
    tasksOpen:out.tasks.filter((x:any)=>x.status!=='done').length,
    risksOpen:out.risks.filter((x:any)=>x.status!=='closed').length,
  };
}

export async function listHqTenants() {
  await ctx('platform.configure'); const r=await db.from<any>('tenants').select('*').order('name'); if(r.error)throw new Error(r.error.message); return r.data??[];
}
export async function setTenantStatus(id:string,status:'active'|'suspended'|'incubating') {
  await ctx('platform.configure'); const r=await db.from<any>('tenants').update({status}).eq('id',id); if(r.error)throw new Error(r.error.message);
  await writeAuditEvent('tenant.status_changed','tenant',id,{status}); return (r.data??[])[0];
}
