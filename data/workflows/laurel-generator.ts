import { db } from '@/data/db';
import { getActiveContext, getActiveSeason } from '@/data/session';
import { can } from '@/data/access';

async function manager() {
  const ctx = await getActiveContext();

  if (!ctx) throw new Error('Authentication required');

  if (!can(ctx.role, 'festival.manage'))
    throw new Error('Permission denied');

  return ctx;
}

export async function getLaurelPackage(awardId: string) {
  const ctx = await manager();
  const season = await getActiveSeason();

  if (!season)
    throw new Error('Select a festival season first.');

  const seasonId = String(season.id);

  const ar = await db
    .from<any>('awards')
    .select('*')
    .eq('id', awardId)
    .eq('tenant_id', ctx.tenantId)
    .eq('season_id', seasonId);

  if (ar.error) throw new Error(ar.error.message);

  const award = (ar.data ?? [])[0];

  if (!award) throw new Error('Award not found');


  const sr = await db
    .from<any>('submissions')
    .select('*')
    .eq('id', award.submission_id)
    .eq('tenant_id', ctx.tenantId)
    .eq('season_id', seasonId);

  if (sr.error) throw new Error(sr.error.message);

  const submission = (sr.data ?? [])[0];

  if (!submission)
    throw new Error('Submission not found');


  const pr = await db
    .from<any>('festival_profiles')
    .select('*')
    .eq('tenant_id', ctx.tenantId);

  if (pr.error) throw new Error(pr.error.message);

  const profile = (pr.data ?? [])[0] ?? null;


  const tr = await db
    .from<any>('tenants')
    .select('*')
    .eq('id', ctx.tenantId);

  if (tr.error) throw new Error(tr.error.message);

  const tenant = (tr.data ?? [])[0] ?? null;


  let lr = await db
    .from<any>('laurel_outputs')
    .select('*')
    .eq('award_id', awardId)
    .eq('tenant_id', ctx.tenantId)
    .eq('season_id', seasonId);

  if (lr.error) throw new Error(lr.error.message);

  let output = (lr.data ?? [])[0];


  if (!output) {
    const created = await db
      .from<any>('laurel_outputs')
      .insert({
        tenant_id: ctx.tenantId,
        season_id: seasonId,
        award_id: award.id,
        submission_id: submission.id,
        format: 'svg',
        status: 'generated',
        generated_by: ctx.userId,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (created.error)
      throw new Error(created.error.message);


    lr = await db
      .from<any>('laurel_outputs')
      .select('*')
      .eq('award_id', awardId)
      .eq('tenant_id', ctx.tenantId)
      .eq('season_id', seasonId);

    if (lr.error) throw new Error(lr.error.message);

    output = (lr.data ?? [])[0];
  }


  if (!output)
    throw new Error('Laurel output could not be generated');


  const festivalName =
    profile?.festival_name ||
    tenant?.name ||
    'Film Festival OS™';

  const decidedAt =
    award.decided_at ||
    award.published_at ||
    new Date().toISOString();

  const year =
    new Date(decidedAt).getFullYear();


  return {
    award,
    submission,
    output,
    festivalName,
    year,
  };
}
