import { useCallback,useEffect,useMemo,useState } from 'react';
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
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import { getActiveContext } from '@/data/session';
import { requireSupabaseClient } from '@/data/supabase-client';

type Row = {
  remediation_id:string;
  remediation_tenant_id:string;
  remediation_code:string;
  priority:string;
  remediation_status:string;

  control_id:string;
  control_code:string;
  control_title:string;

  source_assurance_id:string;
  source_test_code:string;
  source_result:string;
  source_reviewed_at?:string|null;
  source_finding?:string|null;
  retest_due?:string|null;

  owner_user_id?:string|null;
  owner_email?:string|null;

  due_date?:string|null;
  corrective_action?:string|null;
  closure_evidence?:string|null;

  closing_assurance_id?:string|null;
  closing_test_code?:string|null;

  closed_by_user_id?:string|null;
  closed_at?:string|null;

  created_at:string;
  updated_at:string;
};

export default function RemediationQueueScreen() {
  const i = useSafeAreaInsets();

  const [rows,setRows] = useState<Row[]>([]);
  const [tenantName,setTenantName] = useState('');
  const [activeRole,setActiveRole] = useState('');

  const [activeId,setActiveId] = useState('');
  const [priority,setPriority] = useState('high');
  const [dueDate,setDueDate] = useState('');
  const [correctiveAction,setCorrectiveAction] = useState('');
  const [closureEvidence,setClosureEvidence] = useState('');

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
          'Permission denied: remediation administration role required.'
        );
      }

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

      const queueResult = await client.rpc(
        'remediation_queue',
        {
          p_tenant_id:ctx.tenantId,
        }
      );

      if (queueResult.error) {
        throw new Error(queueResult.error.message);
      }

      setRows((queueResult.data ?? []) as Row[]);

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
        'Unable to load Remediation Queue.'
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
    open:rows.filter(r => r.remediation_status === 'open').length,
    progress:rows.filter(r => r.remediation_status === 'in_progress').length,
    retest:rows.filter(r => r.remediation_status === 'ready_for_retest').length,
    closed:rows.filter(r => r.remediation_status === 'closed').length,
  }),[rows]);

  const selectRow = (row:Row) => {
    setActiveId(row.remediation_id);
    setPriority(row.priority || 'medium');
    setDueDate(row.due_date ?? row.retest_due ?? '');
    setCorrectiveAction(row.corrective_action ?? '');
    setClosureEvidence(row.closure_evidence ?? '');
    setMessage('');
  };

  const stepUp = async () => {
    if (!factorId) {
      setMessage(
        'No verified authenticator factor is available.'
      );
      return;
    }

    if (mfaCode.trim().length !== 6) {
      setMessage(
        'Enter the current 6-digit authenticator code.'
      );
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
          ? 'MFA step-up verified. Closure controls are ready.'
          : `Current session assurance is ${level}.`
      );
    } catch(e:any) {
      setMessage(
        e.message ??
        'MFA verification failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const updateRow = async (
    status:'open'|'in_progress'|'ready_for_retest'
  ) => {
    if (!activeId) {
      setMessage('Select a remediation item first.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const client = requireSupabaseClient();

      const { error } = await client.rpc(
        'update_control_remediation',
        {
          p_remediation_id:activeId,
          p_priority:priority,
          p_due_date:dueDate.trim() || null,
          p_corrective_action:
            correctiveAction.trim() || null,
          p_status:status,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      await load();

      setMessage(
        status === 'ready_for_retest'
          ? 'Remediation marked READY FOR RETEST.'
          : status === 'in_progress'
            ? 'Remediation moved to IN PROGRESS.'
            : 'Remediation updated.'
      );
    } catch(e:any) {
      setMessage(
        e.message ??
        'Unable to update remediation.'
      );
    } finally {
      setBusy(false);
    }
  };

  const closeRow = async () => {
    if (!activeId) {
      setMessage('Select a remediation item first.');
      return;
    }

    if (currentAal !== 'aal2') {
      setMessage(
        'MFA step-up required before remediation closure.'
      );
      return;
    }

    if (!closureEvidence.trim()) {
      setMessage(
        'Closure evidence is required.'
      );
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const client = requireSupabaseClient();

      const { error } = await client.rpc(
        'close_control_remediation',
        {
          p_remediation_id:activeId,
          p_closure_evidence:
            closureEvidence.trim(),
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      setActiveId('');
      setClosureEvidence('');

      await load();

      setMessage(
        'Remediation CLOSED after verified PASSED retest.'
      );
    } catch(e:any) {
      setMessage(
        e.message ??
        'Unable to close remediation.'
      );
    } finally {
      setBusy(false);
    }
  };

  const activeRow =
    rows.find(r => r.remediation_id === activeId);

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingTop:i.top+12,
          paddingBottom:i.bottom+48,
          paddingHorizontal:20,
        }}
      >
        <Pressable
          onPress={() =>
            router.replace('/policies-controls')
          }
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft
            size={19}
            color={THEME.accent}
          />
        </Pressable>

        <Text className="text-caption font-bold uppercase tracking-widest text-primary">
          POLICIES • CONTROLS • ASSURANCE
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-2">
          Remediation Queue™
        </Text>

        <Text className="text-body text-muted-foreground mt-2">
          Correct failed or exception controls, record action evidence and require a later PASSED assurance retest before closure.
        </Text>

        <View className="rounded-2xl border border-border bg-card p-4 mt-5">
          <Text className="text-footnote text-muted-foreground">
            Active tenant
          </Text>

          <Text className="text-body font-semibold text-card-foreground mt-1">
            {tenantName || 'Loading…'}
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
            <ShieldCheck
              size={21}
              color={THEME.accent}
            />

            <View className="flex-1">
              <Text className="text-headline font-semibold text-card-foreground">
                Closure protection
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                Final closure requires corrective action, closure evidence, a later PASSED assurance retest and an AAL2 session.
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
                  VERIFY MFA FOR CLOSURE
                </Text>
              </Pressable>
            </>
          ) : null}

          {currentAal === 'aal2' ? (
            <Text className="text-footnote font-bold text-primary mt-3">
              AAL2 VERIFIED — CLOSURE SECURITY READY
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center justify-between mt-6 mb-3">
          <View className="flex-1">
            <Text className="text-headline font-semibold text-foreground">
              Remediation Register
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Total {counts.total} · Open {counts.open} · In Progress {counts.progress} · Ready for Retest {counts.retest} · Closed {counts.closed}
            </Text>
          </View>

          <Pressable
            onPress={() => void load()}
            className="p-2"
          >
            <RefreshCw
              size={18}
              color={THEME.accent}
            />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator
            color={THEME.accent}
          />
        ) : null}

        {!loading && rows.length === 0 ? (
          <View className="rounded-2xl border border-border bg-card p-4">
            <CheckCircle2
              size={22}
              color={THEME.accent}
            />

            <Text className="text-headline font-semibold text-card-foreground mt-2">
              No remediation items
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Failed or exception assurance results will automatically enter this queue.
            </Text>
          </View>
        ) : null}

        <View className="gap-3">
          {rows.map(row => (
            <View
              key={row.remediation_id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <View className="flex-row items-start gap-3">
                {row.remediation_status === 'closed' ? (
                  <CheckCircle2
                    size={20}
                    color={THEME.accent}
                  />
                ) : (
                  <TriangleAlert
                    size={20}
                    color={THEME.accent}
                  />
                )}

                <View className="flex-1">
                  <Text className="text-headline font-semibold text-card-foreground">
                    {row.control_title}
                  </Text>

                  <Text className="text-footnote font-bold text-primary mt-1">
                    {row.remediation_code} · {row.control_code}
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-2">
                    Status: {row.remediation_status.replaceAll('_',' ').toUpperCase()}
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-1">
                    Priority: {row.priority.toUpperCase()}
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-1">
                    Source: {row.source_test_code} · {row.source_result.toUpperCase()}
                  </Text>

                  {row.source_finding ? (
                    <Text className="text-footnote text-muted-foreground mt-2">
                      Finding: {row.source_finding}
                    </Text>
                  ) : null}

                  {row.due_date ? (
                    <Text className="text-footnote text-muted-foreground mt-1">
                      Due: {row.due_date}
                    </Text>
                  ) : null}

                  {row.corrective_action ? (
                    <Text className="text-footnote text-muted-foreground mt-2">
                      Corrective action: {row.corrective_action}
                    </Text>
                  ) : null}

                  {row.closing_test_code ? (
                    <Text className="text-footnote font-semibold text-primary mt-2">
                      Closed by retest: {row.closing_test_code}
                    </Text>
                  ) : null}

                  {row.remediation_status !== 'closed' ? (
                    <Pressable
                      onPress={() => selectRow(row)}
                      className="min-h-11 rounded-xl border border-primary items-center justify-center mt-3"
                    >
                      <Text className="text-footnote font-bold text-primary">
                        OPEN REMEDIATION
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </View>

        {activeRow ? (
          <View className="rounded-2xl border border-primary bg-card p-4 mt-4">
            <Text className="text-headline font-semibold text-card-foreground">
              Remediation Action
            </Text>

            <Text className="text-footnote font-bold text-primary mt-2">
              {activeRow.remediation_code}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Priority: LOW / MEDIUM / HIGH / CRITICAL
            </Text>

            <TextInput
              value={priority}
              onChangeText={value =>
                setPriority(value.trim().toLowerCase())
              }
              placeholder="high"
              placeholderTextColor={THEME.muted}
              className="min-h-12 rounded-xl border border-border bg-background px-4 text-body text-foreground mt-3"
            />

            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="Due / retest date YYYY-MM-DD"
              placeholderTextColor={THEME.muted}
              className="min-h-12 rounded-xl border border-border bg-background px-4 text-body text-foreground mt-3"
            />

            <TextInput
              value={correctiveAction}
              onChangeText={setCorrectiveAction}
              placeholder="Corrective action"
              placeholderTextColor={THEME.muted}
              multiline
              className="min-h-24 rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground mt-3"
            />

            <View className="flex-row flex-wrap gap-2 mt-3">
              <Pressable
                onPress={() =>
                  void updateRow('in_progress')
                }
                disabled={busy}
                className="rounded-xl border border-border px-4 py-3"
              >
                <Text className="text-footnote font-bold text-card-foreground">
                  MARK IN PROGRESS
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  void updateRow('ready_for_retest')
                }
                disabled={busy}
                className="rounded-xl border border-primary px-4 py-3"
              >
                <Text className="text-footnote font-bold text-primary">
                  READY FOR RETEST
                </Text>
              </Pressable>
            </View>

            {activeRow.remediation_status === 'ready_for_retest' ? (
              <>
                <TextInput
                  value={closureEvidence}
                  onChangeText={setClosureEvidence}
                  placeholder="Closure evidence"
                  placeholderTextColor={THEME.muted}
                  multiline
                  className="min-h-20 rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground mt-4"
                />

                <Pressable
                  onPress={() => void closeRow()}
                  disabled={busy}
                  className="min-h-12 rounded-xl bg-primary items-center justify-center mt-3"
                >
                  <Text className="text-footnote font-bold text-primary-foreground">
                    CLOSE AFTER PASSED RETEST
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}

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
