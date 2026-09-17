import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
  FileCheck2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import { getActiveContext } from '@/data/session';
import { requireSupabaseClient } from '@/data/supabase-client';

type PolicyRow = {
  id: string;
  tenant_id: string;
  policy_code: string;
  title: string;
  summary?: string | null;
  version: string;
  status: string;
  owner_user_id: string;
  approved_by_user_id?: string | null;
  approved_at?: string | null;
  effective_date?: string | null;
  next_review_due?: string | null;
  applicable_entities: string;
  created_at: string;
  updated_at: string;
};

function statusLabel(value: string) {
  return value.replaceAll('_',' ').toUpperCase();
}

export default function PolicyRegisterScreen() {
  const insets = useSafeAreaInsets();

  const [rows,setRows] = useState<PolicyRow[]>([]);
  const [tenantName,setTenantName] = useState('');
  const [tenantId,setTenantId] = useState('');
  const [activeRole,setActiveRole] = useState('');

  const [title,setTitle] = useState('');
  const [summary,setSummary] = useState('');
  const [version,setVersion] = useState('1.0');
  const [entities,setEntities] = useState('Current tenant');

  const [currentAal,setCurrentAal] = useState('unknown');
  const [factorId,setFactorId] = useState('');
  const [mfaCode,setMfaCode] = useState('');

  const [loading,setLoading] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const ctx = await getActiveContext();

      if (!ctx) {
        throw new Error('Authentication required.');
      }

      if (
        ctx.role !== 'platform_admin' &&
        ctx.role !== 'festival_owner'
      ) {
        throw new Error(
          'Permission denied: policy administration role required.'
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

      setTenantName(
        String(
          tenantResult.data?.[0]?.name ??
          ctx.tenantId
        )
      );

      const registerResult = await client.rpc(
        'policy_register',
        {
          p_tenant_id:ctx.tenantId,
        }
      );

      if (registerResult.error) {
        throw new Error(registerResult.error.message);
      }

      setRows(
        (registerResult.data ?? []) as PolicyRow[]
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

      const factorResult =
        await client.auth.mfa.listFactors();

      if (factorResult.error) {
        throw new Error(factorResult.error.message);
      }

      const factor = [
        ...(factorResult.data?.totp ?? []),
      ].find(item => item.status === 'verified');

      setFactorId(factor?.id ?? '');
    } catch(e:any) {
      setMessage(
        e.message ??
        'Unable to load Policy Register.'
      );
    } finally {
      setLoading(false);
    }
  },[]);

  useEffect(() => {
    void load();
  },[load]);

  const counts = useMemo(() => ({
    total:rows.length,
    draft:rows.filter(r => r.status === 'draft').length,
    approved:rows.filter(r => r.status === 'approved').length,
    retired:rows.filter(r => r.status === 'retired').length,
  }),[rows]);

  const stepUp = async () => {
    if (!factorId) {
      setMessage('No verified authenticator factor is available.');
      return;
    }

    if (mfaCode.trim().length !== 6) {
      setMessage('Enter the current 6-digit authenticator code.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const client = requireSupabaseClient();

      const { error } =
        await client.auth.mfa.challengeAndVerify({
          factorId,
          code:mfaCode.trim(),
        });

      if (error) {
        throw new Error(error.message);
      }

      setMfaCode('');

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

      setMessage(
        level === 'aal2'
          ? 'MFA step-up verified. Policy approval controls are ready.'
          : `Current session assurance is ${level}.`
      );
    } catch(e:any) {
      setMessage(e.message ?? 'MFA verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const createPolicy = async () => {
    if (!title.trim()) {
      setMessage('Policy title is required.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const ctx = await getActiveContext();

      if (!ctx) {
        throw new Error('Authentication required.');
      }

      const client = requireSupabaseClient();

      const { error } = await client.rpc(
        'create_governance_policy',
        {
          p_tenant_id:ctx.tenantId,
          p_title:title.trim(),
          p_summary:summary.trim() || null,
          p_version:version.trim() || '1.0',
          p_applicable_entities:
            entities.trim() || 'Current tenant',
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      setTitle('');
      setSummary('');
      setVersion('1.0');
      setEntities('Current tenant');
      setMessage('Policy draft created.');

      await load();
    } catch(e:any) {
      setMessage(e.message ?? 'Unable to create policy.');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (
    policyId:string,
    status:'approved'|'retired'
  ) => {
    if (currentAal !== 'aal2') {
      setMessage(
        'MFA step-up required before approving or retiring a policy.'
      );
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const client = requireSupabaseClient();

      const { error } = await client.rpc(
        'set_governance_policy_status',
        {
          p_policy_id:policyId,
          p_status:status,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      setMessage(
        status === 'approved'
          ? 'Policy approved.'
          : 'Policy retired.'
      );

      await load();
    } catch(e:any) {
      setMessage(e.message ?? 'Unable to update policy.');
    } finally {
      setBusy(false);
    }
  };

  const createNewVersion = async (row:PolicyRow) => {
    const current = Number.parseFloat(row.version);
    const next =
      Number.isFinite(current)
        ? (current + 1).toFixed(1)
        : `${row.version}-NEXT`;

    setBusy(true);
    setMessage('');

    try {
      const client = requireSupabaseClient();

      const { error } = await client.rpc(
        'create_governance_policy_version',
        {
          p_source_policy_id:row.id,
          p_new_version:next,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      setMessage(
        `New draft version ${next} created.`
      );

      await load();
    } catch(e:any) {
      setMessage(
        e.message ??
        'Unable to create new policy version.'
      );
    } finally {
      setBusy(false);
    }
  };


  const deletePolicyDraft = async (row:PolicyRow) => {
    if (currentAal !== 'aal2') {
      setMessage(
        'MFA step-up required before deleting a policy draft.'
      );
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const client = requireSupabaseClient();

      const { error } = await client.rpc(
        'delete_governance_policy_draft',
        {
          p_policy_id:row.id,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      await load();

      setMessage(
        `Draft ${row.policy_code} · Version ${row.version} deleted.`
      );
    } catch(e:any) {
      setMessage(
        e.message ??
        'Unable to delete policy draft.'
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteDraft = (row:PolicyRow) => {
    const text =
      `${row.policy_code} · Version ${row.version}\n\n` +
      `${row.title}\n\n` +
      `Only this DRAFT record will be deleted.`;

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(`Delete Policy Draft?\n\n${text}`)
          : false;

      if (confirmed) {
        void deletePolicyDraft(row);
      }

      return;
    }

    Alert.alert(
      'Delete Policy Draft?',
      text,
      [
        {
          text:'Cancel',
          style:'cancel',
        },
        {
          text:'Delete Draft',
          style:'destructive',
          onPress:() => void deletePolicyDraft(row),
        },
      ]
    );
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
          onPress={() =>
            router.replace('/policies-controls')
          }
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft size={19} color={THEME.accent}/>
        </Pressable>

        <Text className="text-caption font-bold uppercase tracking-widest text-primary">
          POLICIES • CONTROLS • ASSURANCE
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-2">
          Policy Register™
        </Text>

        <Text className="text-body text-muted-foreground mt-2">
          Version, approve, review and retire tenant governance policies with audit evidence.
        </Text>

        <View className="rounded-2xl border border-border bg-card p-4 mt-5">
          <Text className="text-footnote text-muted-foreground">
            Active tenant
          </Text>

          <Text className="text-body font-semibold text-card-foreground mt-1">
            {tenantName || tenantId || 'Loading…'}
          </Text>

          <Text className="text-caption text-muted-foreground mt-1">
            {tenantId}
          </Text>

          <Text className="text-footnote text-muted-foreground mt-3">
            Active authority
          </Text>

          <Text className="text-body font-semibold text-primary mt-1">
            {activeRole.replaceAll('_',' ').toUpperCase()}
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-card p-4 mt-4">
          <View className="flex-row items-center gap-3">
            <ShieldCheck size={21} color={THEME.accent}/>

            <View className="flex-1">
              <Text className="text-headline font-semibold text-card-foreground">
                Approval assurance
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                Policy approval and retirement require an AAL2-authenticated session.
              </Text>
            </View>
          </View>

          <Text className="text-body font-semibold text-primary mt-3">
            Current session: {currentAal.toUpperCase()}
          </Text>

          {currentAal !== 'aal2' && factorId ? (
            <>
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
                onPress={() => void stepUp()}
                disabled={busy}
                className="min-h-12 rounded-xl bg-primary items-center justify-center mt-3"
              >
                <Text className="text-footnote font-bold text-primary-foreground">
                  VERIFY MFA FOR POLICY APPROVAL
                </Text>
              </Pressable>
            </>
          ) : null}

          {currentAal === 'aal2' ? (
            <View className="rounded-xl border border-border bg-background p-3 mt-3">
              <Text className="text-footnote font-bold text-primary">
                AAL2 VERIFIED — APPROVAL CONTROLS READY
              </Text>
            </View>
          ) : null}
        </View>

        <View className="rounded-2xl border border-border bg-card p-4 mt-4">
          <Text className="text-headline font-semibold text-card-foreground">
            New Policy Draft
          </Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Policy title"
            placeholderTextColor={THEME.muted}
            className="min-h-12 rounded-xl border border-border bg-background px-4 text-body text-foreground mt-3"
          />

          <TextInput
            value={summary}
            onChangeText={setSummary}
            placeholder="Short policy purpose / summary"
            placeholderTextColor={THEME.muted}
            multiline
            className="min-h-20 rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground mt-3"
          />

          <TextInput
            value={version}
            onChangeText={setVersion}
            placeholder="Version e.g. 1.0"
            placeholderTextColor={THEME.muted}
            className="min-h-12 rounded-xl border border-border bg-background px-4 text-body text-foreground mt-3"
          />

          <TextInput
            value={entities}
            onChangeText={setEntities}
            placeholder="Applicable entities"
            placeholderTextColor={THEME.muted}
            className="min-h-12 rounded-xl border border-border bg-background px-4 text-body text-foreground mt-3"
          />

          <Pressable
            onPress={() => void createPolicy()}
            disabled={busy}
            className="min-h-12 rounded-xl bg-primary items-center justify-center mt-4"
          >
            <Text className="text-footnote font-bold text-primary-foreground">
              CREATE POLICY DRAFT
            </Text>
          </Pressable>
        </View>

        <View className="flex-row items-center justify-between mt-6 mb-3">
          <View>
            <Text className="text-headline font-semibold text-foreground">
              Policy Register
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Total {counts.total} · Draft {counts.draft} · Approved {counts.approved} · Retired {counts.retired}
            </Text>
          </View>

          <Pressable
            onPress={() => void load()}
            className="p-2"
          >
            <RefreshCw size={18} color={THEME.accent}/>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={THEME.accent}/>
        ) : null}

        {!loading && rows.length === 0 ? (
          <View className="rounded-2xl border border-border bg-card p-4">
            <Text className="text-footnote text-muted-foreground">
              No policies recorded for this tenant.
            </Text>
          </View>
        ) : null}

        <View className="gap-3">
          {rows.map(row => (
            <View
              key={row.id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <View className="flex-row items-start gap-3">
                <FileCheck2 size={20} color={THEME.accent}/>

                <View className="flex-1">
                  <Text className="text-headline font-semibold text-card-foreground">
                    {row.title}
                  </Text>

                  <Text className="text-footnote font-semibold text-primary mt-1">
                    {row.policy_code} · Version {row.version}
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-2">
                    Status: {statusLabel(row.status)}
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-1">
                    Applies to: {row.applicable_entities}
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-1">
                    Next review: {row.next_review_due ?? 'Not set'}
                  </Text>

                  {row.summary ? (
                    <Text className="text-footnote text-muted-foreground mt-2">
                      {row.summary}
                    </Text>
                  ) : null}

                  {row.status === 'draft' ? (
                    <>
                      <Pressable
                        onPress={() =>
                          void setStatus(row.id,'approved')
                        }
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-border bg-background items-center justify-center mt-3"
                      >
                        <Text className="text-footnote font-bold text-foreground">
                          APPROVE POLICY
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          confirmDeleteDraft(row)
                        }
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-border bg-background items-center justify-center mt-2"
                      >
                        <Text className="text-footnote font-bold text-muted-foreground">
                          DELETE DRAFT
                        </Text>
                      </Pressable>
                    </>
                  ) : null}

                  {row.status === 'approved' ? (
                    <>
                      <Pressable
                        onPress={() =>
                          void createNewVersion(row)
                        }
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-border bg-background items-center justify-center mt-3"
                      >
                        <Text className="text-footnote font-bold text-foreground">
                          CREATE NEW VERSION
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          void setStatus(row.id,'retired')
                        }
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-border bg-background items-center justify-center mt-2"
                      >
                        <Text className="text-footnote font-bold text-muted-foreground">
                          RETIRE POLICY
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>

                {row.status === 'approved' ? (
                  <CheckCircle2
                    size={20}
                    color="#22c55e"
                  />
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {message ? (
          <View className="rounded-2xl border border-border bg-card p-4 mt-5">
            <Text className="text-footnote text-muted-foreground">
              {message}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
