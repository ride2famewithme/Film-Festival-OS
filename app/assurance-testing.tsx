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

type ControlRow = {
  id:string;
  control_code:string;
  title:string;
  status:string;
};

type AssuranceRow = {
  assurance_id:string;
  assurance_tenant_id:string;
  control_id:string;
  control_code:string;
  control_title:string;
  test_code:string;
  test_method:string;
  evidence_summary?:string|null;
  evidence_reference?:string|null;
  result:string;
  reviewer_user_id?:string|null;
  reviewer_email?:string|null;
  reviewed_at?:string|null;
  exception_notes?:string|null;
  retest_due?:string|null;
  created_at:string;
};

export default function AssuranceTestingScreen() {
  const i = useSafeAreaInsets();

  const [rows,setRows] = useState<AssuranceRow[]>([]);
  const [controls,setControls] = useState<ControlRow[]>([]);

  const [tenantName,setTenantName] = useState('');
  const [tenantId,setTenantId] = useState('');
  const [activeRole,setActiveRole] = useState('');

  const [selectedControlId,setSelectedControlId] = useState('');
  const [testMethod,setTestMethod] = useState('');

  const [selectedTestId,setSelectedTestId] = useState('');
  const [evidenceSummary,setEvidenceSummary] = useState('');
  const [evidenceReference,setEvidenceReference] = useState('');
  const [findingNotes,setFindingNotes] = useState('');
  const [retestDue,setRetestDue] = useState('');

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
          'Permission denied: assurance administration role required.'
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

      const controlResult = await client.rpc(
        'control_library_register',
        {
          p_tenant_id:ctx.tenantId,
        }
      );

      if (controlResult.error) {
        throw new Error(controlResult.error.message);
      }

      const loadedControls =
        (controlResult.data ?? []) as ControlRow[];

      setControls(loadedControls);

      if (
        !selectedControlId &&
        loadedControls.length > 0
      ) {
        setSelectedControlId(loadedControls[0].id);
      }

      const assuranceResult = await client.rpc(
        'assurance_test_register',
        {
          p_tenant_id:ctx.tenantId,
        }
      );

      if (assuranceResult.error) {
        throw new Error(assuranceResult.error.message);
      }

      setRows(
        (assuranceResult.data ?? []) as AssuranceRow[]
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
        'Unable to load Assurance & Testing.'
      );
    } finally {
      setLoading(false);
    }
  },[selectedControlId]);

  useEffect(() => {
    void load();
  },[]);

  const counts = useMemo(() => ({
    total:rows.length,
    planned:rows.filter(r => r.result === 'planned').length,
    passed:rows.filter(r => r.result === 'passed').length,
    failed:rows.filter(r => r.result === 'failed').length,
    exception:rows.filter(r => r.result === 'exception').length,
  }),[rows]);

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
          ? 'MFA step-up verified. Assurance result controls are ready.'
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

  const createTest = async () => {
    if (!selectedControlId) {
      setMessage('Select a control to test.');
      return;
    }

    if (!testMethod.trim()) {
      setMessage('Test method is required.');
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
        'create_control_assurance_test',
        {
          p_tenant_id:ctx.tenantId,
          p_control_id:selectedControlId,
          p_test_method:testMethod.trim(),
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      setTestMethod('');
      setMessage(
        'Planned assurance test created and audit event recorded.'
      );

      await load();
    } catch(e:any) {
      setMessage(
        e.message ??
        'Unable to create assurance test.'
      );
    } finally {
      setBusy(false);
    }
  };

  const recordResult = async (
    result:'passed'|'failed'|'exception'
  ) => {
    if (!selectedTestId) {
      setMessage('Select a planned test for review.');
      return;
    }

    if (currentAal !== 'aal2') {
      setMessage(
        'MFA step-up required before recording a final assurance result.'
      );
      return;
    }

    if (!evidenceSummary.trim()) {
      setMessage('Evidence summary is required.');
      return;
    }

    if (
      (result === 'failed' || result === 'exception') &&
      !findingNotes.trim()
    ) {
      setMessage(
        'Finding / exception notes are required.'
      );
      return;
    }

    if (
      (result === 'failed' || result === 'exception') &&
      !retestDue.trim()
    ) {
      setMessage(
        'Retest date is required for failed or exception results.'
      );
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const client = requireSupabaseClient();

      const { error } = await client.rpc(
        'record_control_assurance_result',
        {
          p_assurance_id:selectedTestId,
          p_result:result,
          p_evidence_summary:evidenceSummary.trim(),
          p_evidence_reference:
            evidenceReference.trim() || null,
          p_exception_notes:
            findingNotes.trim() || null,
          p_retest_due:
            retestDue.trim() || null,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      setSelectedTestId('');
      setEvidenceSummary('');
      setEvidenceReference('');
      setFindingNotes('');
      setRetestDue('');

      setMessage(
        result === 'passed'
          ? 'Assurance test PASSED. Evidence and audit event recorded.'
          : result === 'failed'
            ? 'Assurance test FAILED. Finding is ready for Remediation Queue™.'
            : 'Assurance EXCEPTION recorded. Retest follow-up required.'
      );

      await load();
    } catch(e:any) {
      setMessage(
        e.message ??
        'Unable to record assurance result.'
      );
    } finally {
      setBusy(false);
    }
  };

  const selectedTest =
    rows.find(r => r.assurance_id === selectedTestId);

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
          Assurance & Testing™
        </Text>

        <Text className="text-body text-muted-foreground mt-2">
          Test implemented controls, record evidence, findings, reviewer decisions and retest dates.
        </Text>

        <View className="rounded-2xl border border-border bg-card p-4 mt-5">
          <Text className="text-footnote text-muted-foreground">
            Active tenant
          </Text>

          <Text className="text-body font-semibold text-card-foreground mt-1">
            {tenantName || tenantId || 'Loading…'}
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
                Assurance-result security
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                Final PASS / FAIL / EXCEPTION decisions require an AAL2-authenticated session.
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
                  VERIFY MFA FOR ASSURANCE RESULT
                </Text>
              </Pressable>
            </>
          ) : null}

          {currentAal === 'aal2' ? (
            <Text className="text-footnote font-bold text-primary mt-3">
              AAL2 VERIFIED — RESULT CONTROLS READY
            </Text>
          ) : null}
        </View>

        <View className="rounded-2xl border border-border bg-card p-4 mt-4">
          <Text className="text-headline font-semibold text-card-foreground">
            New Assurance Test
          </Text>

          <Text className="text-footnote text-muted-foreground mt-2">
            Select the control to be independently tested.
          </Text>

          <View className="gap-2 mt-3">
            {controls.map(control => (
              <Pressable
                key={control.id}
                onPress={() =>
                  setSelectedControlId(control.id)
                }
                className={
                  selectedControlId === control.id
                    ? 'rounded-xl border border-primary bg-background p-3'
                    : 'rounded-xl border border-border bg-background p-3'
                }
              >
                <Text className="text-footnote font-bold text-primary">
                  {control.control_code}
                </Text>

                <Text className="text-body text-card-foreground mt-1">
                  {control.title}
                </Text>

                <Text className="text-caption text-muted-foreground mt-1">
                  {String(control.status).replaceAll('_',' ').toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={testMethod}
            onChangeText={setTestMethod}
            placeholder="Test method — e.g. inspect evidence, perform sample transaction, verify audit trail"
            placeholderTextColor={THEME.muted}
            multiline
            className="min-h-24 rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground mt-3"
          />

          <Pressable
            onPress={() => void createTest()}
            disabled={busy}
            className="min-h-12 rounded-xl bg-primary items-center justify-center mt-3"
          >
            <Text className="text-footnote font-bold text-primary-foreground">
              CREATE PLANNED TEST
            </Text>
          </Pressable>
        </View>

        {selectedTest ? (
          <View className="rounded-2xl border border-primary bg-card p-4 mt-4">
            <Text className="text-headline font-semibold text-card-foreground">
              Record Assurance Result
            </Text>

            <Text className="text-footnote font-bold text-primary mt-2">
              {selectedTest.test_code} · {selectedTest.control_code}
            </Text>

            <Text className="text-body text-card-foreground mt-1">
              {selectedTest.control_title}
            </Text>

            <TextInput
              value={evidenceSummary}
              onChangeText={setEvidenceSummary}
              placeholder="Evidence summary *"
              placeholderTextColor={THEME.muted}
              multiline
              className="min-h-24 rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground mt-3"
            />

            <TextInput
              value={evidenceReference}
              onChangeText={setEvidenceReference}
              placeholder="Evidence reference / file / ticket / URL"
              placeholderTextColor={THEME.muted}
              className="min-h-12 rounded-xl border border-border bg-background px-4 text-body text-foreground mt-3"
            />

            <TextInput
              value={findingNotes}
              onChangeText={setFindingNotes}
              placeholder="Finding / exception notes — required for FAIL or EXCEPTION"
              placeholderTextColor={THEME.muted}
              multiline
              className="min-h-20 rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground mt-3"
            />

            <TextInput
              value={retestDue}
              onChangeText={setRetestDue}
              placeholder="Retest date YYYY-MM-DD — required for FAIL or EXCEPTION"
              placeholderTextColor={THEME.muted}
              className="min-h-12 rounded-xl border border-border bg-background px-4 text-body text-foreground mt-3"
            />

            <View className="flex-row flex-wrap gap-2 mt-3">
              <Pressable
                onPress={() =>
                  void recordResult('passed')
                }
                disabled={busy}
                className="rounded-xl border border-primary px-4 py-3"
              >
                <Text className="text-footnote font-bold text-primary">
                  RECORD PASS
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  void recordResult('failed')
                }
                disabled={busy}
                className="rounded-xl border border-border px-4 py-3"
              >
                <Text className="text-footnote font-bold text-card-foreground">
                  RECORD FAIL
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  void recordResult('exception')
                }
                disabled={busy}
                className="rounded-xl border border-border px-4 py-3"
              >
                <Text className="text-footnote font-bold text-card-foreground">
                  RECORD EXCEPTION
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View className="flex-row items-center justify-between mt-6 mb-3">
          <View className="flex-1">
            <Text className="text-headline font-semibold text-foreground">
              Assurance Register
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Total {counts.total} · Planned {counts.planned} · Passed {counts.passed} · Failed {counts.failed} · Exceptions {counts.exception}
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
            <Text className="text-footnote text-muted-foreground">
              No assurance tests recorded for this tenant.
            </Text>
          </View>
        ) : null}

        <View className="gap-3">
          {rows.map(row => (
            <View
              key={row.assurance_id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <View className="flex-row items-start gap-3">
                {row.result === 'passed' ? (
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
                    {row.test_code} · {row.control_code}
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-2">
                    Result: {row.result.toUpperCase()}
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-1">
                    Method: {row.test_method}
                  </Text>

                  {row.evidence_summary ? (
                    <Text className="text-footnote text-muted-foreground mt-2">
                      Evidence: {row.evidence_summary}
                    </Text>
                  ) : null}

                  {row.reviewer_email ? (
                    <Text className="text-footnote text-muted-foreground mt-1">
                      Reviewer: {row.reviewer_email}
                    </Text>
                  ) : null}

                  {row.retest_due ? (
                    <Text className="text-footnote text-muted-foreground mt-1">
                      Retest due: {row.retest_due}
                    </Text>
                  ) : null}

                  {row.result === 'planned' ? (
                    <Pressable
                      onPress={() => {
                        setSelectedTestId(row.assurance_id);
                        setEvidenceSummary('');
                        setEvidenceReference('');
                        setFindingNotes('');
                        setRetestDue('');
                      }}
                      className="min-h-11 rounded-xl border border-primary items-center justify-center mt-3"
                    >
                      <Text className="text-footnote font-bold text-primary">
                        SELECT FOR REVIEW
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
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
