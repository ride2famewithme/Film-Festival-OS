import { db } from '@/data/db';
import { getActiveContext, getActiveSeason } from '@/data/session';
import { can } from '@/data/access';
import { writeAuditEvent } from '@/data/services';
import { requireSupabaseClient } from '@/data/supabase-client';

async function ctxFor(permission: 'submission.manage'|'jury.review'|'jury.manage') {
  const ctx = await getActiveContext();
  if (!ctx) throw new Error('Authentication required');
  if (!can(ctx.role, permission)) throw new Error('Permission denied');
  return ctx;
}

export async function listSubmissions() {
  const ctx = await ctxFor('submission.manage');
  const season = await getActiveSeason();
  if (!season) throw new Error('Select a festival season first.');

  const r = await db
    .from<any>('submissions')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('season_id', String(season.id))
    .order('submitted_at',{ascending:false});

  if (r.error) throw new Error(r.error.message);
  return r.data ?? [];
}
export async function createSubmission(values:{title:string;filmmaker_name:string;email?:string;country?:string;category?:string}) {
  const ctx = await ctxFor('submission.manage');
  const season = await getActiveSeason();
  if (!season) throw new Error('Select a festival season first.');

  const r = await db.from<any>('submissions').insert({
    ...values,
    tenant_id: ctx.tenantId,
    season_id: String(season.id),
    owner_id: ctx.userId,
    status: 'received',
    submitted_at: new Date().toISOString()
  });

  if (r.error) throw new Error(r.error.message);
  const row=(r.data??[])[0];

  await writeAuditEvent(
    'submission.received',
    'submission',
    row?.id,
    {title:values.title, seasonId:String(season.id)}
  );

  return row;
}
export async function updateSubmissionStatus(id:string,status:string) {
  const ctx=await ctxFor('submission.manage');
  const r=await db.from<any>('submissions').update({status}).eq('id',id).eq('tenant_id',ctx.tenantId);
  if(r.error) throw new Error(r.error.message); await writeAuditEvent('submission.status_changed','submission',id,{status}); return (r.data??[])[0];
}
export async function assignJuror(submissionId:string,jurorUserId:string) {
  const ctx=await ctxFor('jury.manage');
  const season=await getActiveSeason();
  if(!season) throw new Error('Select a festival season first.');
  const seasonId=String(season.id);

  const sr=await db.from<any>('submissions')
    .select('id')
    .eq('id',submissionId)
    .eq('tenant_id',ctx.tenantId)
    .eq('season_id',seasonId);

  if(sr.error) throw new Error(sr.error.message);
  if(!(sr.data??[]).length)
    throw new Error('Submission not found in active festival season.');

  const r=await db.from<any>('jury_assignments').insert({
    tenant_id:ctx.tenantId,
    season_id:seasonId,
    submission_id:submissionId,
    juror_user_id:jurorUserId,
    status:'assigned',
    assigned_at:new Date().toISOString()
  });

  if(r.error) throw new Error(r.error.message);
  const row=(r.data??[])[0];
  await writeAuditEvent(
    'jury.assignment_created',
    'jury_assignment',
    row?.id,
    {submissionId,seasonId}
  );
  return row;
}

export async function assignJurorWithScoringForm(
  submissionId: string,
  jurorUserId: string,
  scoringFormId: string
) {
  const ctx = await ctxFor('jury.manage');
  const season = await getActiveSeason();
  if (!season) throw new Error('Select a festival season first.');
  const seasonId = String(season.id);

  const submission = await db
    .from<any>('submissions')
    .select('id')
    .eq('id', submissionId)
    .eq('tenant_id', ctx.tenantId)
    .eq('season_id', seasonId);

  if (submission.error) throw new Error(submission.error.message);

  if (!(submission.data ?? []).length) {
    throw new Error('Submission not found in active festival workspace.');
  }

  const form = await db
    .from<any>('jury_scoring_forms')
    .select('id,status')
    .eq('id', scoringFormId)
    .eq('tenant_id', ctx.tenantId);

  if (form.error) throw new Error(form.error.message);

  const formRow = (form.data ?? [])[0];

  if (!formRow) {
    throw new Error('Scoring form not found in active festival workspace.');
  }

  if (formRow.status !== 'active') {
    throw new Error('Only an active scoring form may be assigned.');
  }

  const r = await db.from<any>('jury_assignments').insert({
    tenant_id: ctx.tenantId,
    season_id: seasonId,
    submission_id: submissionId,
    juror_user_id: jurorUserId,
    scoring_form_id: scoringFormId,
    status: 'assigned',
    assigned_at: new Date().toISOString(),
  });

  if (r.error) throw new Error(r.error.message);

  const row = (r.data ?? [])[0];

  await writeAuditEvent(
    'jury.assignment_created',
    'jury_assignment',
    row?.id,
    {
      submissionId,
      jurorUserId,
      scoringFormId,
      workflow: 'criterion_scoring',
    }
  );

  return row;
}

export async function listMyJuryAssignments() {
  const ctx=await ctxFor('jury.review');
  const season=await getActiveSeason();
  if(!season) throw new Error('Select a festival season first.');

  const r=await db
    .from<any>('jury_assignments')
    .select('*')
    .eq('tenant_id',ctx.tenantId)
    .eq('season_id',String(season.id))
    .eq('juror_user_id',ctx.userId)
    .eq('status','assigned')
    .eq('conflict_status','clear')
    .order('assigned_at',{ascending:true});
  if(r.error) throw new Error(r.error.message);
  return r.data??[];
}
export async function submitJuryReview(assignmentId:string,submissionId:string,score:number,recommendation:string,notes:string) {
  const ctx=await ctxFor('jury.review');
  const season=await getActiveSeason();
  if(!season) throw new Error('Select a festival season first.');
  const seasonId=String(season.id);

  const r=await db.from<any>('jury_reviews').insert({
    tenant_id:ctx.tenantId,
    season_id:seasonId,
    assignment_id:assignmentId,
    submission_id:submissionId,
    juror_user_id:ctx.userId,
    score,
    recommendation,
    notes,
    status:'submitted',
    submitted_at:new Date().toISOString()
  });

  if(r.error) throw new Error(r.error.message);

  await db.from<any>('jury_assignments')
    .update({status:'completed'})
    .eq('id',assignmentId)
    .eq('tenant_id',ctx.tenantId)
    .eq('season_id',seasonId)
    .eq('juror_user_id',ctx.userId);

  const row=(r.data??[])[0];
  await writeAuditEvent(
    'jury.review_submitted',
    'jury_review',
    row?.id,
    {submissionId,score,recommendation,seasonId}
  );
  return row;
}
export async function queueSubmissionNotification(submissionId:string,recipientEmail:string,templateKey:string,subject:string,body:string) {
  const ctx=await ctxFor('submission.manage');
  const r=await db.from<any>('notifications').insert({tenant_id:ctx.tenantId,submission_id:submissionId,recipient_email:recipientEmail,template_key:templateKey,subject,body,status:'queued',queued_at:new Date().toISOString()});
  if(r.error) throw new Error(r.error.message); const row=(r.data??[])[0]; await writeAuditEvent('notification.queued','notification',row?.id,{submissionId,templateKey}); return row;
}
export async function listNotifications() {
  const ctx=await ctxFor('submission.manage');
  const r=await db.from<any>('notifications').select('*').eq('tenant_id',ctx.tenantId).order('queued_at',{ascending:false});
  if(r.error) throw new Error(r.error.message); return r.data??[];
}

// ============================================================
// JURY CRITERION SCORING
// ============================================================

export async function getOrCreateDraftJuryReview(
  assignmentId: string,
  submissionId: string
) {
  const ctx = await ctxFor('jury.review');
  const season = await getActiveSeason();
  if (!season) throw new Error('Select a festival season first.');
  const seasonId = String(season.id);

  const assignment = await db
    .from<any>('jury_assignments')
    .select('id')
    .eq('id', assignmentId)
    .eq('submission_id', submissionId)
    .eq('tenant_id', ctx.tenantId)
    .eq('season_id', seasonId)
    .eq('juror_user_id', ctx.userId);

  if (assignment.error) throw new Error(assignment.error.message);

  if (!(assignment.data ?? []).length) {
    throw new Error('Jury assignment not found in active festival season.');
  }

  const existing = await db
    .from<any>('jury_reviews')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('tenant_id', ctx.tenantId)
    .eq('juror_user_id', ctx.userId);

  if (existing.error) throw new Error(existing.error.message);

  if ((existing.data ?? []).length > 0) {
    return (existing.data ?? [])[0];
  }

  const created = await db.from<any>('jury_reviews').insert({
    tenant_id: ctx.tenantId,
    season_id: seasonId,
    assignment_id: assignmentId,
    submission_id: submissionId,
    juror_user_id: ctx.userId,
    status: 'draft',
    recommendation: null,
    notes: null,
    submitted_at: null,
  });

  if (created.error) throw new Error(created.error.message);

  const row = (created.data ?? [])[0];

  await writeAuditEvent(
    'jury.review_draft_created',
    'jury_review',
    row?.id,
    { assignmentId, submissionId, seasonId }
  );

  return row;
}


export async function listCriterionScores(reviewId: string) {
  const ctx = await ctxFor('jury.review');

  const r = await db
    .from<any>('jury_review_criterion_scores')
    .select('*')
    .eq('review_id', reviewId)
    .eq('tenant_id', ctx.tenantId)
    .eq('juror_user_id', ctx.userId);

  if (r.error) throw new Error(r.error.message);

  return r.data ?? [];
}


export async function saveCriterionScore(values: {
  reviewId: string;
  assignmentId: string;
  scoringFormId: string;
  criterionId: string;
  rawScore: number;
  comment?: string;
}) {
  const ctx = await ctxFor('jury.review');

  const existing = await db
    .from<any>('jury_review_criterion_scores')
    .select('*')
    .eq('review_id', values.reviewId)
    .eq('criterion_id', values.criterionId)
    .eq('tenant_id', ctx.tenantId)
    .eq('juror_user_id', ctx.userId);

  if (existing.error) throw new Error(existing.error.message);

  const current = (existing.data ?? [])[0];

  let r;

  if (current) {
    r = await db
      .from<any>('jury_review_criterion_scores')
      .update({
        raw_score: values.rawScore,
        criterion_comment: values.comment?.trim() || null,
      })
      .eq('id', current.id)
      .eq('tenant_id', ctx.tenantId)
      .eq('juror_user_id', ctx.userId);
  } else {
    r = await db.from<any>('jury_review_criterion_scores').insert({
      tenant_id: ctx.tenantId,
      review_id: values.reviewId,
      assignment_id: values.assignmentId,
      scoring_form_id: values.scoringFormId,
      criterion_id: values.criterionId,
      juror_user_id: ctx.userId,

      // Authoritative snapshot values are overwritten by the DB trigger.
      score_min_snapshot: 0,
      score_max_snapshot: 100,
      weight_percent_snapshot: 1,

      raw_score: values.rawScore,
      criterion_comment: values.comment?.trim() || null,
    });
  }

  if (r.error) throw new Error(r.error.message);

  return (r.data ?? [])[0];
}

// ============================================================
// JUROR-SAFE ASSIGNED SCORING FORM READER
// ============================================================

export async function getAssignedScoringForm(
  assignmentId: string
) {
  const ctx = await ctxFor('jury.review');
  const season = await getActiveSeason();
  if (!season) throw new Error('Select a festival season first.');
  const seasonId = String(season.id);

  const assignmentResult = await db
    .from<any>('jury_assignments')
    .select('*')
    .eq('id', assignmentId)
    .eq('tenant_id', ctx.tenantId)
    .eq('season_id', seasonId)
    .eq('juror_user_id', ctx.userId);

  if (assignmentResult.error) {
    throw new Error(assignmentResult.error.message);
  }

  const assignment = (assignmentResult.data ?? [])[0];

  if (!assignment) {
    throw new Error('Jury assignment not found.');
  }

  if (
    assignment.status !== 'assigned' ||
    assignment.conflict_status !== 'clear'
  ) {
    throw new Error(
      'This jury assignment is no longer available for review.'
    );
  }

  if (
    !assignment.panel_member_id ||
    Number(assignment.weight_percent_snapshot || 0) <= 0
  ) {
    throw new Error(
      'Jury governance link is incomplete. Contact the Festival Owner.'
    );
  }

  if (!assignment.scoring_form_id) {
    throw new Error(
      'No scoring form has been assigned to this jury assignment.'
    );
  }

  const formResult = await db
    .from<any>('jury_scoring_forms')
    .select('*')
    .eq('id', assignment.scoring_form_id)
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'active');

  if (formResult.error) {
    throw new Error(formResult.error.message);
  }

  const form = (formResult.data ?? [])[0];

  if (!form) {
    throw new Error(
      'Assigned scoring form is not active or is unavailable.'
    );
  }

  const criteriaResult = await db
    .from<any>('jury_scoring_criteria')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('form_id', form.id)
    .order('sort_order', { ascending: true });

  if (criteriaResult.error) {
    throw new Error(criteriaResult.error.message);
  }

  const criteria = criteriaResult.data ?? [];

  if (criteria.length === 0) {
    throw new Error(
      'Assigned scoring form has no available criteria.'
    );
  }

  return {
    assignment,
    form,
    criteria,
  };
}


// ============================================================
// FINAL CRITERION JURY REVIEW SUBMISSION
// ============================================================

export async function submitCriterionJuryReview(
  reviewId: string,
  recommendation: string,
  notes: string
) {
  const ctx = await ctxFor('jury.review');

  const client = requireSupabaseClient();

  const { data, error } = await client.rpc(
    'submit_criterion_jury_review',
    {
      p_review_id: reviewId,
      p_recommendation: recommendation.trim() || null,
      p_notes: notes.trim() || null,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  await writeAuditEvent(
    'jury.criterion_review_submitted',
    'jury_review',
    reviewId,
    {
      recommendation: recommendation.trim() || null,
    }
  );

  return data;
}
