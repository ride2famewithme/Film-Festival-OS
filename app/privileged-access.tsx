import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UserCog,
} from 'lucide-react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import { getActiveContext } from '@/data/session';
import { requireSupabaseClient } from '@/data/supabase-client';

type PrivilegedRow = {
  membership_id: string;
  user_id: string;
  email?: string | null;
  role: string;
  membership_status: string;
  is_self: boolean;
};

type ReviewResult = {
  privileged_memberships?: number;
  active_or_invited?: number;
  suspended?: number;
  actor_aal?: string;
};

function roleLabel(role: string) {
  if (role === 'platform_admin') return 'Platform Admin';
  if (role === 'festival_owner') return 'Festival Owner / Operator';
  return role;
}

function statusLabel(status: string) {
  if (!status) return 'UNKNOWN';
  return status.replaceAll('_',' ').toUpperCase();
}

export default function PrivilegedAccessScreen() {
  const insets = useSafeAreaInsets();

  const [rows,setRows] = useState<PrivilegedRow[]>([]);
  const [tenantName,setTenantName] = useState('');
  const [tenantId,setTenantId] = useState('');
  const [activeRole,setActiveRole] = useState('');
  const [totpVerified,setTotpVerified] = useState(false);
  const [verifiedFactorId,setVerifiedFactorId] = useState('');
  const [currentAal,setCurrentAal] = useState('unknown');
  const [mfaCode,setMfaCode] = useState('');
  const [steppingUp,setSteppingUp] = useState(false);
  const [loading,setLoading] = useState(false);
  const [reviewing,setReviewing] = useState(false);
  const [message,setMessage] = useState('');
  const [reviewResult,setReviewResult] =
    useState<ReviewResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const ctx = await getActiveContext();

      if (!ctx) {
        throw new Error('Authentication required');
      }

      if (
        ctx.role !== 'platform_admin' &&
        ctx.role !== 'festival_owner'
      ) {
        throw new Error(
          'Permission denied: privileged access role required.'
        );
      }

      setTenantId(ctx.tenantId);
      setActiveRole(ctx.role);

      const client = requireSupabaseClient();

      const tenantResult = await client
        .from('tenants')
        .select('name')
        .eq('id',ctx.tenantId)
        .limit(1);

      if (!tenantResult.error) {
        setTenantName(
          String(
            tenantResult.data?.[0]?.name ??
            ctx.tenantId
          )
        );
      } else {
        setTenantName(ctx.tenantId);
      }

      const registerResult = await client.rpc(
        'privileged_access_register',
        {
          p_tenant_id:ctx.tenantId,
        }
      );

      if (registerResult.error) {
        throw new Error(registerResult.error.message);
      }

      setRows(
        (registerResult.data ?? []) as PrivilegedRow[]
      );

      const factorResult =
        await client.auth.mfa.listFactors();

      if (factorResult.error) {
        throw new Error(factorResult.error.message);
      }

      const verifiedFactor = [
        ...(factorResult.data?.totp ?? []),
      ].find(
        factor => factor.status === 'verified'
      );

      setTotpVerified(Boolean(verifiedFactor));
      setVerifiedFactorId(
        verifiedFactor?.id ?? ''
      );

      const aalResult =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalResult.error) {
        throw new Error(aalResult.error.message);
      }

      setCurrentAal(
        String(
          aalResult.data?.currentLevel ??
          'unknown'
        )
      );
    } catch(e:any) {
      setMessage(
        e.message ??
        'Unable to load privileged access control centre.'
      );
    } finally {
      setLoading(false);
    }
  },[]);

  useEffect(() => {
    void load();
  },[load]);

  const totals = useMemo(() => {
    const total = rows.length;

    const activeOrInvited = rows.filter(
      row =>
        row.membership_status === 'active' ||
        row.membership_status === 'invited'
    ).length;

    const suspended = rows.filter(
      row => row.membership_status === 'suspended'
    ).length;

    return {
      total,
      activeOrInvited,
      suspended,
    };
  },[rows]);

  const recordReview = async () => {
    if (currentAal !== 'aal2') {
      setMessage(
        'MFA step-up required: verify your authenticator code before recording a privileged access review.'
      );
      return;
    }

    setReviewing(true);
    setMessage('');
    setReviewResult(null);

    try {
      const ctx = await getActiveContext();

      if (!ctx) {
        throw new Error('Authentication required');
      }

      const client = requireSupabaseClient();

      const { data,error } = await client.rpc(
        'record_privileged_access_control_review',
        {
          p_tenant_id:ctx.tenantId,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const result =
        (data ?? {}) as ReviewResult;

      setReviewResult(result);

      setMessage(
        `Privileged access control review recorded. ` +
        `Current reviewer assurance: ${
          result.actor_aal ?? 'unknown'
        }.`
      );

      await load();
    } catch(e:any) {
      setMessage(
        e.message ??
        'Unable to record privileged access review.'
      );
    } finally {
      setReviewing(false);
    }
  };

  const stepUpMfa = async () => {
    if (!verifiedFactorId) {
      setMessage(
        'No verified authenticator factor is available for MFA step-up.'
      );
      return;
    }

    if (mfaCode.trim().length !== 6) {
      setMessage(
        'Enter the 6-digit code from your authenticator app.'
      );
      return;
    }

    setSteppingUp(true);
    setMessage('');

    try {
      const client = requireSupabaseClient();

      const { error } =
        await client.auth.mfa.challengeAndVerify({
          factorId:verifiedFactorId,
          code:mfaCode.trim(),
        });

      if (error) {
        throw new Error(error.message);
      }

      const aalResult =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalResult.error) {
        throw new Error(aalResult.error.message);
      }

      const level = String(
        aalResult.data?.currentLevel ??
        'unknown'
      );

      setCurrentAal(level);
      setMfaCode('');

      if (level === 'aal2') {
        setMessage(
          'MFA step-up verified. Current session assurance is now AAL2.'
        );
      } else {
        setMessage(
          `MFA verification completed, but current session assurance is ${level}.`
        );
      }
    } catch(e:any) {
      setMessage(
        e.message ??
        'Unable to complete MFA step-up.'
      );
    } finally {
      setSteppingUp(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop:insets.top+12,
          paddingBottom:insets.bottom+48,
          paddingHorizontal:20,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to Access and Role Governance"
          onPress={() =>
            router.replace('/access-governance')
          }
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft
            size={19}
            color={THEME.accent}
          />
        </Pressable>

        <Text className="text-caption font-bold uppercase tracking-widest text-primary">
          PRIVILEGED ACCESS
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-2">
          Privileged Access Control Centre™
        </Text>

        <Text className="text-body text-muted-foreground mt-2">
          High-authority membership visibility, current-account MFA
          posture and auditable privileged-access review.
        </Text>

        <View className="rounded-2xl border border-primary bg-card p-4 mt-5">
          <View className="flex-row items-start gap-3">
            <ShieldCheck
              size={21}
              color={THEME.accent}
            />

            <View className="flex-1">
              <Text className="text-headline font-semibold text-primary">
                High-authority control
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                This screen is read-only for membership authority.
                Suspension, periodic review and role changes remain
                separate controlled workflows.
              </Text>
            </View>
          </View>
        </View>

        <View className="rounded-2xl border border-border bg-card p-4 mt-4">
          <Text className="text-footnote text-muted-foreground">
            Active tenant
          </Text>

          <Text className="text-body font-semibold text-card-foreground mt-1">
            {tenantName || tenantId || 'Loading…'}
          </Text>

          {tenantId ? (
            <Text className="text-caption text-muted-foreground mt-1">
              Tenant ID: {tenantId}
            </Text>
          ) : null}

          <Text className="text-footnote text-muted-foreground mt-3">
            Your active authority
          </Text>

          <Text className="text-body font-semibold text-primary mt-1">
            {roleLabel(activeRole)}
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-card p-4 mt-4">
          <View className="flex-row items-center gap-3">
            <KeyRound
              size={21}
              color={THEME.accent}
            />

            <View className="flex-1">
              <Text className="text-headline font-semibold text-card-foreground">
                Current account MFA posture
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                This result applies only to the currently signed-in
                account. FFOS does not infer another user’s MFA state.
              </Text>
            </View>

            {totpVerified ? (
              <CheckCircle2
                size={22}
                color="#22c55e"
              />
            ) : null}
          </View>

          <Text className="text-body font-semibold text-primary mt-4">
            {totpVerified
              ? 'Verified authenticator factor present'
              : 'No verified authenticator factor detected'}
          </Text>

          <Text className="text-footnote text-muted-foreground mt-2">
            Current session assurance: {currentAal.toUpperCase()}
          </Text>

          {totpVerified && currentAal !== 'aal2' ? (
            <View className="mt-4">
              <Text className="text-footnote font-semibold text-card-foreground">
                MFA step-up required for privileged actions
              </Text>

              <TextInput
                value={mfaCode}
                onChangeText={setMfaCode}
                placeholder="6-digit authenticator code"
                placeholderTextColor={THEME.muted}
                keyboardType="number-pad"
                maxLength={6}
                className="min-h-12 rounded-xl border border-border bg-background px-4 text-body text-foreground mt-3"
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Verify MFA for privileged actions"
                onPress={() => void stepUpMfa()}
                disabled={steppingUp}
                className="min-h-12 rounded-xl bg-primary items-center justify-center mt-3"
              >
                <Text className="text-footnote font-bold text-primary-foreground">
                  {steppingUp
                    ? 'VERIFYING…'
                    : 'VERIFY MFA FOR PRIVILEGED ACTIONS'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {currentAal === 'aal2' ? (
            <View className="rounded-xl border border-border bg-background p-3 mt-4">
              <Text className="text-footnote font-bold text-primary">
                AAL2 VERIFIED — PRIVILEGED SESSION READY
              </Text>
            </View>
          ) : null}

          {activeRole === 'platform_admin' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Platform Admin Security Centre"
              onPress={() =>
                router.push('/security-centre' as never)
              }
              className="min-h-12 rounded-xl border border-border bg-background items-center justify-center mt-4"
            >
              <Text className="text-footnote font-bold text-foreground">
                OPEN PLATFORM ADMIN SECURITY CENTRE
              </Text>
            </Pressable>
          ) : (
            <Text className="text-footnote text-muted-foreground mt-3">
              Platform Admin MFA changes are managed from Global HQ
              Security Centre. This tenant screen does not elevate or
              change your session.
            </Text>
          )}
        </View>

        <View className="flex-row justify-between items-center mt-6 mb-3">
          <View className="flex-row items-center gap-2">
            <UserCog
              size={20}
              color={THEME.accent}
            />

            <Text className="text-headline font-semibold text-foreground">
              Privileged Membership Register
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh privileged access register"
            onPress={() => void load()}
            className="p-2"
          >
            <RefreshCw
              size={18}
              color={THEME.accent}
            />
          </Pressable>
        </View>

        <View className="rounded-2xl border border-border bg-card p-4 mb-4">
          <Text className="text-footnote text-muted-foreground">
            Visible privileged memberships
          </Text>

          <Text className="text-title2 font-bold text-foreground mt-1">
            {totals.total}
          </Text>

          <Text className="text-footnote text-muted-foreground mt-2">
            Active / invited {totals.activeOrInvited}
            {' · '}
            Suspended {totals.suspended}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            color={THEME.accent}
          />
        ) : null}

        {!loading && !rows.length && !message ? (
          <View className="rounded-2xl border border-border bg-card p-4">
            <Text className="text-footnote text-muted-foreground">
              No privileged memberships are visible in this tenant scope.
            </Text>
          </View>
        ) : null}

        <View className="gap-3">
          {rows.map(row => (
            <View
              key={row.membership_id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <View className="flex-row items-start gap-3">
                <View className="w-10 h-10 rounded-xl border border-border bg-background items-center justify-center">
                  <LockKeyhole
                    size={19}
                    color={THEME.accent}
                  />
                </View>

                <View className="flex-1">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-headline font-semibold text-card-foreground">
                      {row.email || row.user_id}
                    </Text>

                    {row.is_self ? (
                      <Text className="text-caption font-bold text-primary">
                        YOU
                      </Text>
                    ) : null}
                  </View>

                  <Text className="text-footnote font-semibold text-primary mt-1">
                    {roleLabel(row.role)}
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-2">
                    Status: {statusLabel(row.membership_status)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View className="rounded-2xl border border-border bg-card p-4 mt-5">
          <Text className="text-headline font-semibold text-card-foreground">
            Sensitive-action rule
          </Text>

          <Text className="text-footnote text-muted-foreground mt-2">
            Privileged membership changes must use the dedicated access
            review, emergency suspension or controlled administration
            workflow. This register never grants or elevates authority.
          </Text>

          <Text className="text-headline font-semibold text-card-foreground mt-4">
            Re-authentication rule
          </Text>

          <Text className="text-footnote text-muted-foreground mt-2">
            High-risk administration should be performed only from the
            correct privileged workspace and with the required MFA
            assurance. Recording a review captures the current reviewer
            session assurance level for audit evidence.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Record privileged access control review"
          onPress={() => void recordReview()}
          disabled={reviewing}
          className="min-h-12 rounded-xl bg-primary items-center justify-center mt-5"
        >
          <Text className="text-footnote font-bold text-primary-foreground">
            {reviewing
              ? 'RECORDING…'
              : 'RECORD CONTROL REVIEW'}
          </Text>
        </Pressable>

        {reviewResult ? (
          <View className="rounded-2xl border border-border bg-card p-4 mt-4">
            <Text className="text-headline font-semibold text-card-foreground">
              Latest review evidence
            </Text>

            <Text className="text-footnote text-muted-foreground mt-2">
              Privileged memberships: {
                reviewResult.privileged_memberships ?? 0
              }
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Active / invited: {
                reviewResult.active_or_invited ?? 0
              }
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Suspended: {
                reviewResult.suspended ?? 0
              }
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Reviewer assurance: {
                reviewResult.actor_aal ?? 'unknown'
              }
            </Text>
          </View>
        ) : null}

        {message ? (
          <View className="rounded-2xl border border-border bg-card p-4 mt-4">
            <Text className="text-footnote text-muted-foreground">
              {message}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
