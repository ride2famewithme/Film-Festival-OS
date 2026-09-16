import { db } from '@/data/db';
import { getActiveContext } from '@/data/session';
import { can } from '@/data/access';
import { writeAuditEvent } from '@/data/services';

async function manager() {
  const ctx = await getActiveContext();

  if (!ctx) throw new Error('Authentication required');
  if (!can(ctx.role, 'jury.manage')) throw new Error('Permission denied');

  return ctx;
}

export async function listScoringForms() {
  const ctx = await manager();

  const r = await db
    .from<any>('jury_scoring_forms')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false });

  if (r.error) throw new Error(r.error.message);

  return r.data ?? [];
}

export async function listScoringCriteria(formId: string) {
  const ctx = await manager();

  const r = await db
    .from<any>('jury_scoring_criteria')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('form_id', formId)
    .order('sort_order', { ascending: true });

  if (r.error) throw new Error(r.error.message);

  return r.data ?? [];
}

export type ScoringTemplateFamily =
  | 'general_film'
  | 'documentary'
  | 'ai_film'
  | 'drone_film'
  | 'screenplay'
  | 'animation_2d'
  | 'animation_3d'
  | 'original_score'
  | 'music_video'
  | 'sound_sfx'
  | 'custom';

export async function createScoringForm(
  name: string,
  options?: {
    templateFamily?: ScoringTemplateFamily;
    divisionKey?: string;
    description?: string;
    isMasterTemplate?: boolean;
  }
) {
  const ctx = await manager();
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error('Scoring form name is required');
  }

  const templateFamily = options?.templateFamily ?? 'general_film';
  const divisionKey =
    options?.divisionKey?.trim().toLowerCase().replace(/\s+/g, '_') || 'open';
  const description = options?.description?.trim() || null;
  const isMasterTemplate = options?.isMasterTemplate ?? false;

  const r = await db.from<any>('jury_scoring_forms').insert({
    tenant_id: ctx.tenantId,
    name: cleanName,
    version: 1,
    status: 'draft',
    score_min: 0,
    score_max: 100,
    recommendation_required: true,
    overall_comment_required: false,
    template_family: templateFamily,
    division_key: divisionKey,
    description,
    is_master_template: isMasterTemplate,
    created_by: ctx.userId,
  });

  if (r.error) throw new Error(r.error.message);

  const row = (r.data ?? [])[0];

  await writeAuditEvent(
    'jury.scoring_form_created',
    'jury_scoring_form',
    row?.id,
    {
      name: cleanName,
      templateFamily,
      divisionKey,
      isMasterTemplate,
    }
  );

  return row;
}

export async function addScoringCriterion(values: {
  formId: string;
  label: string;
  weightPercent: number;
  commentRequired?: boolean;
  sortOrder?: number;
}) {
  const ctx = await manager();

  const label = values.label.trim();

  if (!label) throw new Error('Criterion name is required');

  if (
    !Number.isFinite(values.weightPercent) ||
    values.weightPercent <= 0 ||
    values.weightPercent > 100
  ) {
    throw new Error('Criterion weight must be between 1 and 100');
  }

  const r = await db.from<any>('jury_scoring_criteria').insert({
    tenant_id: ctx.tenantId,
    form_id: values.formId,
    label,
    weight_percent: values.weightPercent,
    score_min: 0,
    score_max: 100,
    comment_required: values.commentRequired ?? false,
    sort_order: values.sortOrder ?? 0,
  });

  if (r.error) throw new Error(r.error.message);

  const row = (r.data ?? [])[0];

  await writeAuditEvent(
    'jury.scoring_criterion_created',
    'jury_scoring_criterion',
    row?.id,
    {
      formId: values.formId,
      label,
      weightPercent: values.weightPercent,
    }
  );

  return row;
}

export async function activateScoringForm(id: string) {
  const ctx = await manager();

  const r = await db
    .from<any>('jury_scoring_forms')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);

  if (r.error) throw new Error(r.error.message);

  await writeAuditEvent(
    'jury.scoring_form_activated',
    'jury_scoring_form',
    id,
    {}
  );

  return (r.data ?? [])[0];
}

export async function updateScoringCriterion(
  id: string,
  values: {
    label: string;
    weightPercent: number;
    commentRequired: boolean;
  }
) {
  const ctx = await manager();
  const label = values.label.trim();

  if (!label) throw new Error('Criterion name is required');

  if (
    !Number.isFinite(values.weightPercent) ||
    values.weightPercent <= 0 ||
    values.weightPercent > 100
  ) {
    throw new Error('Criterion weight must be between 1 and 100');
  }

  const r = await db
    .from<any>('jury_scoring_criteria')
    .update({
      label,
      weight_percent: values.weightPercent,
      comment_required: values.commentRequired,
    })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);

  if (r.error) throw new Error(r.error.message);

  await writeAuditEvent(
    'jury.scoring_criterion_updated',
    'jury_scoring_criterion',
    id,
    {
      label,
      weightPercent: values.weightPercent,
      commentRequired: values.commentRequired,
    }
  );

  return (r.data ?? [])[0];
}

export async function deleteScoringCriterion(id: string) {
  const ctx = await manager();

  const r = await db
    .from<any>('jury_scoring_criteria')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);

  if (r.error) throw new Error(r.error.message);

  await writeAuditEvent(
    'jury.scoring_criterion_deleted',
    'jury_scoring_criterion',
    id,
    {}
  );

  return true;
}
