import { requireSupabaseClient } from '@/data/supabase-client';

export type SeasonRolloverResult = {
  newSeasonId: string;
  newLabel: string;
  categoriesCopied: number;
  jurorsInvited: number;
  benefitsCopied: number;
};

export async function rolloverFestivalSeason(
  sourceSeasonId: string,
  newLabel: string
): Promise<SeasonRolloverResult> {
  const client = requireSupabaseClient();

  const result = await client.rpc(
    'rollover_festival_season',
    {
      p_source_season_id: sourceSeasonId,
      p_new_label: newLabel.trim(),
    }
  );

  if (result.error)
    throw new Error(result.error.message);

  return result.data as SeasonRolloverResult;
}
