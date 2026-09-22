import { requireSupabaseClient } from '@/data/supabase-client';
import { can } from '@/data/access';
import { getActiveContext } from '@/data/session';

const client = requireSupabaseClient();

export async function verifyGlobalMasterAuthority() {
  const ctx = await getActiveContext();

  if (!ctx)
    throw new Error('Authentication required.');

  if (
    ctx.role !== 'platform_admin' ||
    !can(ctx.role, 'platform.configure')
  ) {
    throw new Error('Global Master authority required.');
  }

  return ctx;
}

export async function verifyGlobalMasterPassword(password: string) {
  await verifyGlobalMasterAuthority();

  if (!password.trim())
    throw new Error('Enter your Global Master password.');

  const { data: sessionData, error: sessionError } =
    await client.auth.getSession();

  if (sessionError)
    throw new Error(sessionError.message);

  const email = sessionData.session?.user?.email;

  if (!email)
    throw new Error('No authenticated email address is available.');

  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error)
    throw new Error('Password verification failed.');

  return true;
}

export async function getVerifiedGlobalMasterTotpFactor() {
  await verifyGlobalMasterAuthority();

  const { data, error } =
    await client.auth.mfa.listFactors();

  if (error)
    throw new Error(error.message);

  const factor = (data?.totp ?? []).find(
    (item: any) => item.status === 'verified'
  );

  if (!factor)
    throw new Error(
      'Verified authenticator MFA is required. Open Security Centre to enrol MFA.'
    );

  return factor;
}

export async function verifyGlobalMasterTotp(code: string) {
  await verifyGlobalMasterAuthority();

  if (code.trim().length !== 6)
    throw new Error('Enter the 6-digit authenticator code.');

  const factor = await getVerifiedGlobalMasterTotpFactor();

  const challenge =
    await client.auth.mfa.challenge({
      factorId: factor.id,
    });

  if (challenge.error || !challenge.data)
    throw new Error(
      challenge.error?.message ??
      'MFA challenge could not be created.'
    );

  const verification =
    await client.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.data.id,
      code: code.trim(),
    });

  if (verification.error)
    throw new Error('MFA verification failed.');

  return {
    verified: true,
    factorId: factor.id,
    verifiedAt: new Date().toISOString(),
  };
}
