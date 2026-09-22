import {
  requireSupabaseClient,
} from '@/data/supabase-client';


export type PublicAwardVerification = {
  award_id: string;
  verified: boolean;
  festival_name: string;
  project_title: string;
  creator_name: string | null;
  award_name: string;
  result_status: string;
  placement: string | null;
  design_style: string | null;
  award_year: number;
  verification_code: string | null;
  asset_url: string | null;
  nft_url: string | null;
  marketplace_url: string | null;
  published_at: string | null;
};


export async function getPublicAwardVerification(
  awardId: string
): Promise<PublicAwardVerification | null> {

  if (!awardId)
    return null;

  const client =
    requireSupabaseClient();

  const { data, error } =
    await client.rpc(
      'get_public_award_verification',
      {
        p_award_id: awardId,
      }
    );

  if (error)
    throw new Error(
      error.message
    );

  return (
    Array.isArray(data)
      ? data[0]
      : null
  ) ?? null;
}
