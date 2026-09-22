import { db } from '@/data/db';
import { getActiveContext, getActiveSeason } from '@/data/session';
import { can } from '@/data/access';
import { writeAuditEvent } from '@/data/services';
import { queueSubmissionNotification } from '@/data/workflows/festival-core';
import { getLaurelPackage } from '@/data/workflows/laurel-generator';
import { resolveNftSuggestedValue } from '@/data/workflows/nft-award-policy';

async function manager() {
  const ctx = await getActiveContext();

  if (!ctx)
    throw new Error('Authentication required');

  if (!can(ctx.role, 'festival.manage'))
    throw new Error('Permission denied');

  return ctx;
}

export async function getDigitalAwardPackage(
  awardId: string
) {
  return getLaurelPackage(awardId);
}

export async function updateDigitalAwardControls(
  outputId: string,
  values: {
    award_enabled: boolean;
    nft_enabled: boolean;
    placement: string;
    design_style: string;
    asset_url?: string;
    nft_url?: string;
    marketplace_url?: string;
  }
) {
  const ctx = await manager();
  const season = await getActiveSeason();

  if (!season)
    throw new Error('Select a festival season first.');

  const seasonId = String(season.id);

  const designStyle =
    values.placement === 'winner'
      ? 'golden'
      : values.design_style;

  const r = await db
    .from<any>('laurel_outputs')
    .update({
      award_enabled:
        values.award_enabled,
      nft_enabled:
        values.nft_enabled,
      placement:
        values.placement,
      design_style:
        designStyle,
      asset_url:
        values.asset_url?.trim() || null,
      nft_url:
        values.nft_url?.trim() || null,
      marketplace_url:
        values.marketplace_url?.trim() || null,
      updated_at:
        new Date().toISOString(),
    })
    .eq('id', outputId)
    .eq('tenant_id', ctx.tenantId)
    .eq('season_id', seasonId);

  if (r.error)
    throw new Error(r.error.message);

  await writeAuditEvent(
    'digital_award.controls_updated',
    'laurel_output',
    outputId,
    {
      awardEnabled:
        values.award_enabled,
      nftEnabled:
        values.nft_enabled,
      placement:
        values.placement,
      designStyle,
      seasonId,
    }
  );

  return (r.data ?? [])[0];
}


const PLACEMENT_LABELS: Record<string, string> = {
  winner: 'Winner / 1st Place',
  second_place: '2nd Place',
  third_place: '3rd Place',
  jury_choice: "Jury's Choice",
  audience_choice: 'Audience / Public Choice',
  special_recognition: 'Special Recognition',
};

const REFERENCE_FIELDS: Record<string, string> = {
  winner: 'winner_reference_eth',
  second_place: 'second_place_reference_eth',
  third_place: 'third_place_reference_eth',
  jury_choice: 'jury_choice_reference_eth',
  audience_choice: 'audience_choice_reference_eth',
  special_recognition: 'special_recognition_reference_eth',
};

const DEFAULT_REFERENCE_ETH: Record<string, number> = {
  winner: 0.003,
  second_place: 0.0005,
  third_place: 0.00025,
  jury_choice: 0.0002,
  audience_choice: 0.0002,
  special_recognition: 0.0001,
};

export async function getDigitalAwardRecipientNotice(
  awardId: string
) {
  const ctx = await manager();
  const pkg = await getLaurelPackage(awardId);

  const placement =
    String(pkg.output?.placement || 'winner');

  const placementLabel =
    PLACEMENT_LABELS[placement] ||
    placement;

  const designStyle =
    placement === 'winner'
      ? 'golden'
      : String(
          pkg.output?.design_style ||
          'special'
        );

  let category: any = null;

  const packageSeasonId = String(
    pkg.output?.season_id ||
    pkg.submission?.season_id ||
    ''
  );

  if (!packageSeasonId)
    throw new Error('Digital Award package has no festival season.');

  const payments = await db
    .from<any>('submission_payments')
    .select('*')
    .eq('submission_id', pkg.submission.id)
    .eq('tenant_id', ctx.tenantId)
    .eq('season_id', packageSeasonId);

  if (payments.error)
    throw new Error(payments.error.message);

  const payment =
    (payments.data ?? [])[0];

  if (payment?.category_id) {
    const cr = await db
      .from<any>('festival_categories')
      .select('*')
      .eq('id', payment.category_id)
      .eq('tenant_id', ctx.tenantId)
      .eq('season_id', packageSeasonId);

    if (cr.error)
      throw new Error(cr.error.message);

    category =
      (cr.data ?? [])[0] ?? null;
  }

  if (
    !category &&
    pkg.submission?.category
  ) {
    const cr = await db
      .from<any>('festival_categories')
      .select('*')
      .eq(
        'name',
        String(pkg.submission.category)
      )
      .eq('tenant_id', ctx.tenantId)
      .eq('season_id', packageSeasonId);

    if (!cr.error) {
      category =
        (cr.data ?? [])[0] ?? null;
    }
  }

  const referenceField =
    REFERENCE_FIELDS[placement];

  const inherited =
    await resolveNftSuggestedValue(
      placement as any
    );

  const localOverrideEnabled =
    category?.nft_value_override_enabled === true;

  const inheritedLocked =
    inherited?.override_locked === true;

  const useLocalOverride =
    localOverrideEnabled &&
    !inheritedLocked;

  const suggestedEth =
    useLocalOverride
      ? Number(
          category?.[referenceField] ??
          DEFAULT_REFERENCE_ETH[placement] ??
          0
        )
      : Number(
          inherited?.suggested_eth ??
          DEFAULT_REFERENCE_ETH[placement] ??
          0
        );

  const valueSource =
    useLocalOverride
      ? 'FESTIVAL / EVENT CATEGORY OVERRIDE'
      : String(
          inherited?.source_kind ||
          'SYSTEM DEFAULT'
        );

  const valueSourceName =
    useLocalOverride
      ? String(
          pkg.festivalName
        )
      : String(
          inherited?.source_tenant_name ||
          'Film Festival OS™'
        );

  const nftUrl =
    String(pkg.output?.nft_url || '');

  const marketplaceUrl =
    String(
      pkg.output?.marketplace_url || ''
    );

  const verificationUrl =
    `https://filmfestivalos.com/award/${awardId}`;

  const subject =
    `${pkg.festivalName} — Your NFT Award: ${pkg.award.award_name}`;

  const body = [
    `Congratulations.`,
    ``,
    `Your submission "${pkg.submission.title}" has received:`,
    `${pkg.award.award_name}`,
    ``,
    `Placement: ${placementLabel}`,
    `Digital Award Design: ${designStyle.toUpperCase()}`,
    `Suggested Resale / Fundraising Value: ${suggestedEth} ETH`,
    ``,
    `NFT Award: ${nftUrl || 'NFT link will be supplied by festival management.'}`,
    `FFOS Verification: ${verificationUrl}`,
    marketplaceUrl
      ? `Marketplace: ${marketplaceUrl}`
      : '',
    ``,
    `IMPORTANT: The suggested ETH amount is not prepaid cryptocurrency and Film Festival OS™ does not transfer that ETH amount with the NFT.`,
    ``,
    `After the NFT is transferred to you, you may keep it as a collectors item, transfer it, use the suggested amount as a fundraising target for a future project, or set your own resale/listing price on a compatible marketplace.`,
    ``,
    `The suggested resale/fundraising value is not a guaranteed market value.`,
    ``,
    `${pkg.festivalName}`,
    `Powered by Film Festival OS™`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    ...pkg,
    placement,
    placementLabel,
    designStyle,
    suggestedEth,
    valueSource,
    valueSourceName,
    valueOverrideLocked:
      inheritedLocked,
    nftUrl,
    marketplaceUrl,
    verificationUrl,
    subject,
    body,
  };
}


export async function queueDigitalAwardRecipientNotice(
  awardId: string
) {
  const ctx = await manager();

  const notice =
    await getDigitalAwardRecipientNotice(
      awardId
    );

  if (
    notice.output?.award_enabled === false
  ) {
    throw new Error(
      'This award is currently disabled.'
    );
  }

  if (
    notice.output?.nft_enabled === false
  ) {
    throw new Error(
      'NFT / Digital Award is currently disabled.'
    );
  }

  if (!notice.submission?.email) {
    throw new Error(
      'Submission has no recipient email address.'
    );
  }

  if (!notice.nftUrl) {
    throw new Error(
      'Save the NFT / token URL before queueing the recipient notice.'
    );
  }

  const existing = await db
    .from<any>('notifications')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq(
      'submission_id',
      notice.submission.id
    )
    .eq(
      'template_key',
      'nft_award'
    )
    .eq(
      'subject',
      notice.subject
    )
    .order(
      'queued_at',
      { ascending: false }
    );

  if (existing.error)
    throw new Error(
      existing.error.message
    );

  const duplicate =
    (existing.data ?? []).find(
      (x: any) =>
        x.status === 'queued' ||
        x.status === 'sent'
    );

  if (duplicate) {
    return {
      ...duplicate,
      alreadyQueued: true,
    };
  }

  const created =
    await queueSubmissionNotification(
      notice.submission.id,
      notice.submission.email,
      'nft_award',
      notice.subject,
      notice.body
    );

  await writeAuditEvent(
    'digital_award.recipient_notice_queued',
    'award',
    awardId,
    {
      submissionId:
        notice.submission.id,
      placement:
        notice.placement,
      suggestedEth:
        notice.suggestedEth,
      nftUrl:
        notice.nftUrl,
    }
  );

  return {
    ...created,
    alreadyQueued: false,
  };
}
