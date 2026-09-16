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

function csvCell(value:any) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows:any[]) {
  if (!rows.length) return '';
  const headers = Array.from(new Set(rows.flatMap((row:any) => Object.keys(row))));
  return [
    headers.map(csvCell).join(','),
    ...rows.map((row:any) => headers.map((h:string) => csvCell(row[h])).join(','))
  ].join('\n');
}

export async function generateExportFile(
  reportType:'submissions'|'operations',
  format:'csv'|'json'
) {
  const c = await ctx('tenant.read');
  const requestedAt = new Date().toISOString();

  const jobResult = await db.from<any>('export_jobs').insert({
    tenant_id:c.tenantId,
    requested_by:c.userId,
    report_type:reportType,
    format,
    status:'queued',
    requested_at:requestedAt,
    expires_at:null,
    file_path:null
  });

  if (jobResult.error) throw new Error(jobResult.error.message);

  const job = (jobResult.data ?? [])[0];
  if (!job?.id) throw new Error('Export job could not be created.');

  try {
    let data:any;

    if (reportType === 'submissions') {
      const result = await db.from<any>('submissions')
        .select('*')
        .eq('tenant_id', c.tenantId);

      if (result.error) throw new Error(result.error.message);
      data = result.data ?? [];
    } else {
      data = await getOperationalSnapshot();
    }

    const stamp = new Date().toISOString()
      .slice(0,19)
      .replace(/[T:]/g,'-');

    const filename =
      `ffos-${reportType}-${stamp}.${format}`;

    const content =
      format === 'json'
        ? JSON.stringify(data, null, 2)
        : rowsToCsv(Array.isArray(data) ? data : [data]);

    const generatedAt = new Date().toISOString();

    const update = await db.from<any>('export_jobs').update({
      status:'generated',
      generated_at:generatedAt,
      expires_at:new Date(Date.now()+7*86400000).toISOString(),
      file_path:filename
    }).eq('id',job.id).eq('tenant_id',c.tenantId);

    if (update.error) throw new Error(update.error.message);

    await writeAuditEvent(
      'export.generated',
      'export_job',
      job.id,
      {reportType,format,filename}
    );

    return {
      id:job.id,
      filename,
      content,
      mime:format === 'json'
        ? 'application/json'
        : 'text/csv;charset=utf-8'
    };

  } catch (error:any) {
    await db.from<any>('export_jobs')
      .update({status:'failed'})
      .eq('id',job.id)
      .eq('tenant_id',c.tenantId);

    throw error;
  }
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
