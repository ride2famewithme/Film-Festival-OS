import { getActiveSeason } from '@/data/session';
import { db } from '@/data/db';
import { getActiveContext } from '@/data/session';
import { can } from '@/data/access';
import { writeAuditEvent } from '@/data/services';
import { queueSubmissionNotification } from '@/data/workflows/festival-core';
import { requireSupabaseClient } from '@/data/supabase-client';

async function manager() {
  const ctx = await getActiveContext();
  if (!ctx) throw new Error('Authentication required');
  if (!can(ctx.role, 'festival.manage') || !can(ctx.role, 'submission.manage')) throw new Error('Permission denied');
  return ctx;
}

export async function listCategories() {
  const c = await manager();
  const season = await getActiveSeason();
  if (!season) return [];

  const r = await db
    .from<any>('festival_categories')
    .select('*')
    .eq('tenant_id', c.tenantId)
    .eq('season_id', String(season.id))
    .order('name');

  if (r.error) throw new Error(r.error.message);
  return r.data ?? [];
}
export async function createCategory(v:{
  name:string;
  currency:string;
  regular_fee:number;
  runtime_max_minutes?:number
}) {
  const c = await manager();
  const season = await getActiveSeason();

  if (!season)
    throw new Error('Create or select a festival season first.');

  const r = await db.from<any>('festival_categories').insert({
    ...v,
    tenant_id: c.tenantId,
    season_id: String(season.id),
    status: 'open',
    rules_version: `${String(season.label)}.1`,
    updated_at: new Date().toISOString(),
  });

  if (r.error) throw new Error(r.error.message);

  const row = (r.data ?? [])[0];
  await writeAuditEvent(
    'category.created',
    'festival_category',
    row?.id,
    { name: v.name, season: String(season.label) }
  );

  return row;
}


export async function updateCategoryStatus(id:string,status:string){const c=await manager();const r=await db.from<any>('festival_categories').update({status,updated_at:new Date().toISOString()}).eq('id',id).eq('tenant_id',c.tenantId);if(r.error)throw new Error(r.error.message);await writeAuditEvent('category.status_changed','festival_category',id,{status});return (r.data??[])[0];}

export async function listBenefits(){
  const c=await manager();
  const season=await getActiveSeason();
  if(!season)return [];
  const r=await db.from<any>('benefit_codes')
    .select('*')
    .eq('tenant_id',c.tenantId)
    .eq('season_id',String(season.id))
    .order('updated_at',{ascending:false});
  if(r.error)throw new Error(r.error.message);
  return r.data??[];
}
export async function createBenefit(v:{
  code:string;
  kind:'percent'|'fixed'|'waiver'|'deadline';
  value:number;
  label?:string;
  starts_at?:string|null;
  expires_at?:string|null;
  deadline_waiver?:boolean;
  one_use_per_submitter?:boolean;
  visibility?:'private'|'public';
  applies_to?:'all'|'selected';
  reason?:string;
  usage_limit?:number;
  category_ids?:string[];
}) {
  const c=await manager();
  const season=await getActiveSeason();
  if(!season)throw new Error('Select a festival season first.');
  const seasonId=String(season.id);
  const code=v.code.trim().toUpperCase();

  const r=await db.from<any>('benefit_codes').insert({
    code,
    kind:v.kind,
    value:v.value,
    label:v.label?.trim()||null,
    starts_at:v.starts_at||null,
    expires_at:v.expires_at||null,
    deadline_waiver:!!v.deadline_waiver,
    one_use_per_submitter:!!v.one_use_per_submitter,
    visibility:v.visibility||'private',
    applies_to:v.applies_to||'all',
    reason:v.reason?.trim()||null,
    usage_limit:v.usage_limit||null,
    tenant_id:c.tenantId,
    season_id:seasonId,
    issued_by:c.userId,
    status:'active',
    uses_count:0,
    updated_at:new Date().toISOString()
  });

  if(r.error)throw new Error(r.error.message);

  const qr=await db.from<any>('benefit_codes')
    .select('*')
    .eq('tenant_id',c.tenantId)
    .eq('code',code);

  if(qr.error)throw new Error(qr.error.message);

  const row=(qr.data??[])[0];

  if(
    row?.id &&
    v.applies_to==='selected' &&
    (v.category_ids??[]).length
  ){
    const links=(v.category_ids??[]).map(category_id=>({
      tenant_id:c.tenantId,
      benefit_code_id:row.id,
      category_id
    }));

    const lr=await db.from<any>('benefit_code_categories').insert(links);
    if(lr.error)throw new Error(lr.error.message);
  }

  await writeAuditEvent(
    'benefit.created',
    'benefit_code',
    row?.id,
    {
      code,
      kind:v.kind,
      visibility:v.visibility||'private',
      appliesTo:v.applies_to||'all'
    }
  );

  return row;
}

export async function toggleBenefit(id:string,current:string){const c=await manager();const status=current==='active'?'paused':'active';const r=await db.from<any>('benefit_codes').update({status,updated_at:new Date().toISOString()}).eq('id',id).eq('tenant_id',c.tenantId);if(r.error)throw new Error(r.error.message);await writeAuditEvent('benefit.status_changed','benefit_code',id,{status});return (r.data??[])[0];}

export async function listSubmissionPayments(){
  const c=await manager();
  const season=await getActiveSeason();
  if(!season)throw new Error('Select a festival season first.');
  const seasonId=String(season.id);

  const r=await db.from<any>('submission_payments')
    .select('*')
    .eq('tenant_id',c.tenantId)
    .eq('season_id',seasonId)
    .order('updated_at',{ascending:false});

  if(r.error)throw new Error(r.error.message);
  return r.data??[];
}
export async function assessSubmission(submissionId:string,categoryId:string,benefitCode?:string){const c=await manager();const season=await getActiveSeason();if(!season)throw new Error('Select a festival season first.');const seasonId=String(season.id);const cats=await db.from<any>('festival_categories').select('*').eq('id',categoryId).eq('tenant_id',c.tenantId).eq('season_id',seasonId);if(cats.error)throw new Error(cats.error.message);const cat=(cats.data??[])[0];if(!cat)throw new Error('Category not found');let discount=0;let code='';if(benefitCode?.trim()){const br=await db.from<any>('benefit_codes').select('*').eq('code',benefitCode.trim().toUpperCase()).eq('tenant_id',c.tenantId).eq('season_id',seasonId);if(br.error)throw new Error(br.error.message);const b=(br.data??[])[0];if(!b||b.status!=='active')throw new Error('Benefit code is not active');code=b.code;if(b.kind==='waiver')discount=Number(cat.regular_fee);else if(b.kind==='percent')discount=Number(cat.regular_fee)*(Number(b.value)/100);else discount=Math.min(Number(cat.regular_fee),Number(b.value));}
const submissionCheck=await db.from<any>('submissions')
  .select('id')
  .eq('id',submissionId)
  .eq('tenant_id',c.tenantId)
  .eq('season_id',seasonId);

if(submissionCheck.error)throw new Error(submissionCheck.error.message);
if(!(submissionCheck.data??[]).length)
  throw new Error('Submission not found in active festival season.');

const due=Math.max(0,Number(cat.regular_fee)-discount);
const now=new Date().toISOString();

const old=await db.from<any>('submission_payments')
  .select('*')
  .eq('submission_id',submissionId)
  .eq('tenant_id',c.tenantId)
  .eq('season_id',seasonId);

if(old.error)throw new Error(old.error.message);

let row;

if((old.data??[])[0]){
  const id=(old.data??[])[0].id;

  const ur=await db.from<any>('submission_payments')
    .update({
      season_id:seasonId,
      category_id:categoryId,
      base_amount:Number(cat.regular_fee),
      discount_amount:discount,
      amount_due:due,
      currency:cat.currency,
      benefit_code:code||undefined,
      eligibility_status:'eligible',
      payment_status:due===0?'waived':'pending',
      updated_at:now
    })
    .eq('id',id)
    .eq('tenant_id',c.tenantId)
    .eq('season_id',seasonId);

  if(ur.error)throw new Error(ur.error.message);
  row=(ur.data??[])[0];

}else{
  const ir=await db.from<any>('submission_payments').insert({
    tenant_id:c.tenantId,
    season_id:seasonId,
    submission_id:submissionId,
    category_id:categoryId,
    base_amount:Number(cat.regular_fee),
    discount_amount:discount,
    amount_due:due,
    currency:cat.currency,
    benefit_code:code||undefined,
    eligibility_status:'eligible',
    payment_status:due===0?'waived':'pending',
    updated_at:now
  });

  if(ir.error)throw new Error(ir.error.message);
  row=(ir.data??[])[0];
}
await db.from<any>('submissions').update({category:cat.name,status:due===0?'payment_cleared':'payment_pending'}).eq('id',submissionId).eq('tenant_id',c.tenantId);await writeAuditEvent('submission.assessed','submission',submissionId,{categoryId,amountDue:due,currency:cat.currency,benefitCode:code||null});return row;}
export async function markPaymentStatus(paymentId:string,submissionId:string,status:'paid'|'refunded'){
  const c=await manager();
  const season=await getActiveSeason();
  if(!season)throw new Error('Select a festival season first.');
  const seasonId=String(season.id);

  const r=await db.from<any>('submission_payments')
    .update({payment_status:status,updated_at:new Date().toISOString()})
    .eq('id',paymentId)
    .eq('tenant_id',c.tenantId)
    .eq('season_id',seasonId);

  if(r.error)throw new Error(r.error.message);

  await db.from<any>('submissions')
    .update({status:status==='paid'?'payment_cleared':'refund_recorded'})
    .eq('id',submissionId)
    .eq('tenant_id',c.tenantId)
    .eq('season_id',seasonId);

  await writeAuditEvent(
    `payment.${status}`,
    'submission_payment',
    paymentId,
    {submissionId,seasonId}
  );

  return (r.data??[])[0];
}

export async function listAwards(){
  const c=await manager();
  const season=await getActiveSeason();
  if(!season)throw new Error('Select a festival season first.');
  const seasonId=String(season.id);

  const r=await db.from<any>('awards')
    .select('*')
    .eq('tenant_id',c.tenantId)
    .eq('season_id',seasonId)
    .order('updated_at',{ascending:false});

  if(r.error)throw new Error(r.error.message);
  return r.data??[];
}
export async function createAward(submissionId:string,awardName:string,resultStatus:string){
  const c=await manager();
  const season=await getActiveSeason();
  if(!season)throw new Error('Select a festival season first.');
  const seasonId=String(season.id);

  const sr=await db.from<any>('submissions')
    .select('id')
    .eq('id',submissionId)
    .eq('tenant_id',c.tenantId)
    .eq('season_id',seasonId);

  if(sr.error)throw new Error(sr.error.message);
  if(!(sr.data??[]).length)
    throw new Error('Submission not found in active festival season.');

  const now=new Date().toISOString();

  const r=await db.from<any>('awards').insert({
    tenant_id:c.tenantId,
    season_id:seasonId,
    submission_id:submissionId,
    award_name:awardName,
    result_status:resultStatus,
    publication_status:'draft',
    decided_at:now,
    updated_at:now
  });

  if(r.error)throw new Error(r.error.message);

  const row=(r.data??[])[0];

  await writeAuditEvent(
    'award.decision_recorded',
    'award',
    row?.id,
    {submissionId,awardName,resultStatus,seasonId}
  );

  return row;
}
export async function publishAward(awardId:string,submissionId:string){
  const c=await manager();
  const season=await getActiveSeason();
  if(!season)throw new Error('Select a festival season first.');
  const seasonId=String(season.id);
  const now=new Date().toISOString();

  const r=await db.from<any>('awards')
    .update({
      publication_status:'published',
      published_at:now,
      updated_at:now
    })
    .eq('id',awardId)
    .eq('tenant_id',c.tenantId)
    .eq('season_id',seasonId);

  if(r.error)throw new Error(r.error.message);

  await db.from<any>('submissions')
    .update({status:'decision_published'})
    .eq('id',submissionId)
    .eq('tenant_id',c.tenantId)
    .eq('season_id',seasonId);

  await writeAuditEvent(
    'award.published',
    'award',
    awardId,
    {submissionId,seasonId}
  );

  return (r.data??[])[0];
}
export async function queueDecisionNotification(submissionId:string,subject:string,body:string){
  const c=await manager();

  const sr=await db.from<any>('submissions')
    .select('*')
    .eq('id',submissionId)
    .eq('tenant_id',c.tenantId);

  if(sr.error)throw new Error(sr.error.message);

  const s=(sr.data??[])[0];

  if(!s?.email)
    throw new Error('Submission has no email address');

  const existing=await db.from<any>('notifications')
    .select('*')
    .eq('tenant_id',c.tenantId)
    .eq('submission_id',submissionId)
    .eq('template_key','decision')
    .eq('subject',subject)
    .order('queued_at',{ascending:false});

  if(existing.error)
    throw new Error(existing.error.message);

  const duplicate=(existing.data??[]).find(
    (x:any)=>x.status==='queued'||x.status==='sent'
  );

  if(duplicate)
    return {...duplicate,alreadyQueued:true};

  const created=await queueSubmissionNotification(
    submissionId,
    s.email,
    'decision',
    subject,
    body
  );

  return {...created,alreadyQueued:false};
}


// ============================================================
// JURY RESULT -> HUMAN AWARD DECISION CONTROL
// ============================================================

export async function listAwardDecisionCandidates() {
  const c = await manager();

  const rr = await db.from<any>('jury_submission_results')
    .select('*')
    .eq('tenant_id', c.tenantId);

  if (rr.error) throw new Error(rr.error.message);

  const sr = await db.from<any>('submissions')
    .select('*')
    .eq('tenant_id', c.tenantId);

  if (sr.error) throw new Error(sr.error.message);

  const ar = await db.from<any>('awards')
    .select('*')
    .eq('tenant_id', c.tenantId);

  if (ar.error) throw new Error(ar.error.message);

  const submissions = sr.data ?? [];
  const awards = ar.data ?? [];

  return (rr.data ?? [])
    .filter((x:any) => Number(x.review_count || 0) > 0)
    .map((result:any) => ({
      ...result,
      submission: submissions.find(
        (s:any) => s.id === result.submission_id
      ) || null,
      awards: awards.filter(
        (a:any) => a.submission_id === result.submission_id
      ),
    }))
    .sort(
      (a:any,b:any) =>
        Number(b.weighted_score || 0) -
        Number(a.weighted_score || 0)
    );
}


export async function lockJurySubmissionResult(
  submissionId:string
) {
  const c = await manager();
  const client = requireSupabaseClient();

  const { data, error } = await client.rpc(
    'lock_jury_submission_result',
    { p_submission_id: submissionId }
  );

  if (error) throw new Error(error.message);

  const row = Array.isArray(data)
    ? data[0]
    : data;

  await writeAuditEvent(
    'jury.result_locked',
    'jury_submission_result',
    submissionId,
    {
      submissionId,
      weightedScore: row?.weighted_score ?? null,
      lockedBy: c.userId,
    }
  );

  return row;
}


export async function createAwardSafe(
  submissionId:string,
  awardName:string,
  resultStatus:string
) {
  const c = await manager();

  const cleanName = awardName.trim();
  const cleanStatus = resultStatus.trim();

  if (!cleanName)
    throw new Error('Award name is required');

  if (!cleanStatus)
    throw new Error('Result status is required');

  const existing = await db.from<any>('awards')
    .select('*')
    .eq('tenant_id', c.tenantId)
    .eq('season_id', String((await getActiveSeason())?.id ?? ''))
    .eq('submission_id', submissionId)
    .eq('award_name', cleanName);

  if (existing.error)
    throw new Error(existing.error.message);

  const row = (existing.data ?? [])[0];

  if (row)
    return {...row, alreadyExists:true};

  const created = await createAward(
    submissionId,
    cleanName,
    cleanStatus
  );

  return {...created, alreadyExists:false};
}


export async function updateCategoryAwardControls(
  id: string,
  values: {
    award_enabled?: boolean;
    nft_award_enabled?: boolean;
    nft_value_override_enabled?: boolean;
    winner_enabled?: boolean;
    second_place_enabled?: boolean;
    third_place_enabled?: boolean;
    jury_choice_enabled?: boolean;
    audience_choice_enabled?: boolean;
    special_recognition_enabled?: boolean;
    winner_reference_eth?: number;
    second_place_reference_eth?: number;
    third_place_reference_eth?: number;
    jury_choice_reference_eth?: number;
    audience_choice_reference_eth?: number;
    special_recognition_reference_eth?: number;
  }
) {
  const c = await manager();

  const patch: any = {
    ...values,
    updated_at: new Date().toISOString(),
  };

  const r = await db
    .from<any>('festival_categories')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', c.tenantId);

  if (r.error)
    throw new Error(r.error.message);

  await writeAuditEvent(
    'category.award_controls_changed',
    'festival_category',
    id,
    values
  );

  return (r.data ?? [])[0];
}

export async function updateAllCategoryAwardControls(
  values: {
    award_enabled?: boolean;
    nft_award_enabled?: boolean;
  }
) {
  const c = await manager();
  const season = await getActiveSeason();

  if (!season)
    throw new Error('Select a festival season first.');

  const patch: any = {
    ...values,
    updated_at: new Date().toISOString(),
  };

  const r = await db
    .from<any>('festival_categories')
    .update(patch)
    .eq('tenant_id', c.tenantId)
    .eq('season_id', String(season.id));

  if (r.error)
    throw new Error(r.error.message);

  await writeAuditEvent(
    'category.award_controls_bulk_changed',
    'festival_category',
    c.tenantId,
    {
      ...values,
      seasonId: String(season.id),
    }
  );

  return true;
}
