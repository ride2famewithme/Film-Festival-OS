import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createGovernanceControl,
  getControlLibrarySummary,
  listGovernanceControls,
  listGovernanceControlAudit,
  setGovernanceControlStatus,
  type ControlAuditEvent,
  type GovernanceControl,
  type GovernanceControlStatus,
} from '@/data/workflows/control-library';

type Summary = {
  total: number;
  designed: number;
  implemented: number;
  tested: number;
  failed: number;
  remediationRequired: number;
  closed: number;
  reviewDue: number;
};

function prettyStatus(status: string) {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusColours(status: string) {
  switch (status) {
    case 'implemented':
      return {
        background: '#E0F2FE',
        text: '#075985',
      };

    case 'tested':
      return {
        background: '#DCFCE7',
        text: '#166534',
      };

    case 'failed':
      return {
        background: '#FEE2E2',
        text: '#991B1B',
      };

    case 'remediation_required':
      return {
        background: '#FFEDD5',
        text: '#9A3412',
      };

    case 'closed':
      return {
        background: '#E5E7EB',
        text: '#374151',
      };

    case 'designed':
      return {
        background: '#DBEAFE',
        text: '#1D4ED8',
      };

    case 'retired':
      return {
        background: '#E5E7EB',
        text: '#4B5563',
      };

    default:
      return {
        background: '#FEF3C7',
        text: '#92400E',
      };
  }
}

export default function ControlLibraryScreen() {
  const insets = useSafeAreaInsets();

  const [controls, setControls] =
    useState<GovernanceControl[]>([]);

  const [summary, setSummary] =
    useState<Summary>({
      total: 0,
      designed: 0,
      implemented: 0,
      tested: 0,
      failed: 0,
      remediationRequired: 0,
      closed: 0,
      reviewDue: 0,
    });

  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [creating, setCreating] = useState(false);

  const [changingControlId, setChangingControlId] =
    useState<string | null>(null);

  const [notesByControl, setNotesByControl] =
    useState<Record<string, string>>({});

  const [auditByControl, setAuditByControl] =
    useState<Record<string, ControlAuditEvent[]>>({});

  const [auditLoadingId, setAuditLoadingId] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [rows, totals] = await Promise.all([
        listGovernanceControls(),
        getControlLibrarySummary(),
      ]);

      setControls(rows);
      setSummary(totals);
    } catch (e: any) {
      Alert.alert(
        'Control Library™',
        e?.message || 'Unable to load controls.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(
    control: GovernanceControl,
    status: GovernanceControlStatus
  ) {
    setChangingControlId(control.id);

    try {
      const updated = await setGovernanceControlStatus(
        control.id,
        status,
        notesByControl[control.id] || undefined
      );

      setNotesByControl((current) => ({
        ...current,
        [control.id]: '',
      }));

      await load();

      Alert.alert(
        'Control Lifecycle™',
        `${updated.control_code} is now ${prettyStatus(
          updated.status
        )}.`
      );
    } catch (e: any) {
      Alert.alert(
        'Control Lifecycle™',
        e?.message || 'Control status could not be changed.'
      );
    } finally {
      setChangingControlId(null);
    }
  }

  async function loadAudit(control: GovernanceControl) {
    setAuditLoadingId(control.id);

    try {
      const rows = await listGovernanceControlAudit(
        control.id
      );

      setAuditByControl((current) => ({
        ...current,
        [control.id]: rows,
      }));
    } catch (e: any) {
      Alert.alert(
        'Control Audit Trail™',
        e?.message || 'Audit trail could not be loaded.'
      );
    } finally {
      setAuditLoadingId(null);
    }
  }

  async function createControl() {
    if (!title.trim() || !purpose.trim()) {
      Alert.alert(
        'Create Control™',
        'Enter both a control title and purpose.'
      );
      return;
    }

    setCreating(true);

    try {
      const created = await createGovernanceControl({
        title,
        purpose,
      });

      setTitle('');
      setPurpose('');

      await load();

      Alert.alert(
        'Control Created',
        `${created.control_code} created in DESIGNED status.`
      );
    } catch (e: any) {
      Alert.alert(
        'Create Control™',
        e?.message || 'Control could not be created.'
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 36,
          },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft size={20} color="#111827" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Pressable
            onPress={() => void load()}
            style={styles.refreshButton}
          >
            <RefreshCw size={18} color="#FFFFFF" />
            <Text style={styles.refreshText}>
              Refresh
            </Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <ShieldCheck
              size={30}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>
              FILM FESTIVAL OS™
            </Text>

            <Text style={styles.title}>
              Control Library™
            </Text>

            <Text style={styles.subtitle}>
              Governance, operational and assurance
              controls for the active festival workspace.
            </Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {summary.total}
            </Text>
            <Text style={styles.summaryLabel}>
              Total Controls
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {summary.designed}
            </Text>
            <Text style={styles.summaryLabel}>
              Designed
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {summary.implemented}
            </Text>
            <Text style={styles.summaryLabel}>
              Implemented
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {summary.tested}
            </Text>
            <Text style={styles.summaryLabel}>
              Tested
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {summary.failed}
            </Text>
            <Text style={styles.summaryLabel}>
              Failed
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {summary.remediationRequired}
            </Text>
            <Text style={styles.summaryLabel}>
              Remediation
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {summary.closed}
            </Text>
            <Text style={styles.summaryLabel}>
              Closed
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {summary.reviewDue}
            </Text>
            <Text style={styles.summaryLabel}>
              Review Due
            </Text>
          </View>
        </View>

        <View style={styles.createCard}>
          <Text style={styles.createTitle}>
            CREATE CONTROL™
          </Text>

          <Text style={styles.createHelp}>
            New controls begin in DESIGNED status.
          </Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Control title"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />

          <TextInput
            value={purpose}
            onChangeText={setPurpose}
            placeholder="Control purpose"
            placeholderTextColor="#9CA3AF"
            multiline
            style={[styles.input, styles.purposeInput]}
          />

          <Pressable
            disabled={creating}
            onPress={() => void createControl()}
            style={[
              styles.createButton,
              creating && styles.createButtonDisabled,
            ]}
          >
            {creating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.createButtonText}>
                Create Control
              </Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>
          CONTROL REGISTER
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>
              Loading Control Library™...
            </Text>
          </View>
        ) : controls.length === 0 ? (
          <View style={styles.emptyBox}>
            <ShieldCheck
              size={32}
              color="#6B7280"
            />

            <Text style={styles.emptyTitle}>
              Control Library is ready
            </Text>

            <Text style={styles.emptyText}>
              No governance controls have been
              registered for this workspace yet.
            </Text>
          </View>
        ) : (
          controls.map((control) => {
            const colours =
              statusColours(control.status);

            return (
              <View
                key={control.id}
                style={styles.controlCard}
              >
                <View style={styles.controlHeader}>
                  <View style={styles.controlHeading}>
                    <Text style={styles.controlCode}>
                      {control.control_code}
                    </Text>

                    <Text style={styles.controlTitle}>
                      {control.title}
                    </Text>

                    <Text style={styles.controlPurpose}>
                      {control.purpose}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          colours.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: colours.text,
                        },
                      ]}
                    >
                      {prettyStatus(control.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    Owner
                  </Text>

                  <Text style={styles.detailValue}>
                    {control.owner_user_id}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    Next Review
                  </Text>

                  <Text style={styles.detailValue}>
                    {control.next_review_due ||
                      'Not scheduled'}
                  </Text>
                </View>

                {control.implementation_notes ? (
                  <View style={styles.notesDisplay}>
                    <Text style={styles.notesDisplayLabel}>
                      CURRENT ASSURANCE NOTES
                    </Text>

                    <Text style={styles.notesDisplayText}>
                      {control.implementation_notes}
                    </Text>
                  </View>
                ) : null}

                {control.status !== 'closed' ? (
                  <TextInput
                    value={
                      notesByControl[control.id] || ''
                    }
                    onChangeText={(value) =>
                      setNotesByControl((current) => ({
                        ...current,
                        [control.id]: value,
                      }))
                    }
                    placeholder="Assurance / implementation notes (optional)"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    style={[
                      styles.input,
                      styles.lifecycleNotesInput,
                    ]}
                  />
                ) : null}

                {control.status === 'designed' ? (
                  <Pressable
                    disabled={
                      changingControlId === control.id
                    }
                    onPress={() =>
                      void changeStatus(
                        control,
                        'implemented'
                      )
                    }
                    style={[
                      styles.lifecycleButton,
                      changingControlId === control.id &&
                        styles.lifecycleButtonDisabled,
                    ]}
                  >
                    {changingControlId === control.id ? (
                      <ActivityIndicator
                        color="#FFFFFF"
                      />
                    ) : (
                      <Text
                        style={styles.lifecycleButtonText}
                      >
                        Mark Implemented
                      </Text>
                    )}
                  </Pressable>
                ) : null}

                {control.status === 'implemented' ? (
                  <View>
                  <Pressable
                    disabled={
                      changingControlId === control.id
                    }
                    onPress={() =>
                      void changeStatus(
                        control,
                        'tested'
                      )
                    }
                    style={[
                      styles.lifecycleButton,
                      changingControlId === control.id &&
                        styles.lifecycleButtonDisabled,
                    ]}
                  >
                    {changingControlId === control.id ? (
                      <ActivityIndicator
                        color="#FFFFFF"
                      />
                    ) : (
                      <Text
                        style={styles.lifecycleButtonText}
                      >
                        Mark Tested — MFA Protected
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    disabled={
                      changingControlId === control.id
                    }
                    onPress={() =>
                      void changeStatus(
                        control,
                        'failed'
                      )
                    }
                    style={[
                      styles.lifecycleSecondaryButton,
                      styles.lifecycleGroupButton,
                      changingControlId === control.id &&
                        styles.lifecycleButtonDisabled,
                    ]}
                  >
                    <Text
                      style={styles.lifecycleSecondaryText}
                    >
                      Mark Failed — MFA Protected
                    </Text>
                  </Pressable>
                  </View>
                ) : null}

                {control.status === 'tested' ? (
                  <View style={styles.lifecycleGroup}>
                    <Pressable
                      disabled={
                        changingControlId === control.id
                      }
                      onPress={() =>
                        void changeStatus(
                          control,
                          'remediation_required'
                        )
                      }
                      style={[
                        styles.lifecycleSecondaryButton,
                        changingControlId === control.id &&
                          styles.lifecycleButtonDisabled,
                      ]}
                    >
                      <Text
                        style={styles.lifecycleSecondaryText}
                      >
                        Remediation Required — MFA
                      </Text>
                    </Pressable>

                    <Pressable
                      disabled={
                        changingControlId === control.id
                      }
                      onPress={() =>
                        void changeStatus(
                          control,
                          'closed'
                        )
                      }
                      style={[
                        styles.lifecycleButton,
                        styles.lifecycleGroupButton,
                        changingControlId === control.id &&
                          styles.lifecycleButtonDisabled,
                      ]}
                    >
                      <Text
                        style={styles.lifecycleButtonText}
                      >
                        Close Control — MFA
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {control.status === 'failed' ? (
                  <Pressable
                    disabled={
                      changingControlId === control.id
                    }
                    onPress={() =>
                      void changeStatus(
                        control,
                        'remediation_required'
                      )
                    }
                    style={[
                      styles.lifecycleButton,
                      changingControlId === control.id &&
                        styles.lifecycleButtonDisabled,
                    ]}
                  >
                    <Text
                      style={styles.lifecycleButtonText}
                    >
                      Move to Remediation — MFA
                    </Text>
                  </Pressable>
                ) : null}

                {control.status === 'remediation_required' ? (
                  <Pressable
                    disabled={
                      changingControlId === control.id
                    }
                    onPress={() =>
                      void changeStatus(
                        control,
                        'implemented'
                      )
                    }
                    style={[
                      styles.lifecycleButton,
                      changingControlId === control.id &&
                        styles.lifecycleButtonDisabled,
                    ]}
                  >
                    <Text
                      style={styles.lifecycleButtonText}
                    >
                      Return to Implemented
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  disabled={auditLoadingId === control.id}
                  onPress={() =>
                    void loadAudit(control)
                  }
                  style={styles.auditButton}
                >
                  <Text style={styles.auditButtonText}>
                    {auditLoadingId === control.id
                      ? 'Loading Audit Trail...'
                      : 'Load Audit Trail™'}
                  </Text>
                </Pressable>

                {(auditByControl[control.id] ?? []).map(
                  (event) => (
                    <View
                      key={event.id}
                      style={styles.auditEvent}
                    >
                      <Text style={styles.auditAction}>
                        {event.action}
                      </Text>

                      <Text style={styles.auditMeta}>
                        {new Date(
                          event.created_at
                        ).toLocaleString()}
                      </Text>

                      <Text style={styles.auditMeta}>
                        Actor: {event.actor_user_id || '—'}
                      </Text>

                      <Text style={styles.auditDetail}>
                        {JSON.stringify(event.detail)}
                      </Text>
                    </View>
                  )
                )}
              </View>
            );
          })
        )}

        <View style={styles.securityCard}>
          <Text style={styles.securityTitle}>
            CONTROL LIBRARY SECURITY
          </Text>

          <Text style={styles.securityText}>
            Workspace visibility is enforced by
            Supabase Row Level Security. Sensitive
            control status changes remain protected
            by the Control Library RPC and MFA
            step-up rules.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  content: {
    width: '100%',
    maxWidth: 1050,
    alignSelf: 'center',
    paddingHorizontal: 18,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingRight: 14,
  },

  backText: {
    marginLeft: 7,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },

  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  refreshText: {
    marginLeft: 7,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },

  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 15,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },

  heroText: {
    flex: 1,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: '#6B7280',
    marginBottom: 4,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },

  subtitle: {
    marginTop: 7,
    maxWidth: 720,
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
  },

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginBottom: 25,
  },

  summaryCard: {
    minWidth: 145,
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 18,
    margin: 5,
  },

  summaryNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },

  summaryLabel: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },

  createCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 15,
    padding: 18,
    marginBottom: 24,
  },

  createTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#111827',
  },

  createHelp: {
    marginTop: 5,
    marginBottom: 12,
    fontSize: 12,
    color: '#6B7280',
  },

  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111827',
    marginBottom: 10,
  },

  purposeInput: {
    minHeight: 82,
    textAlignVertical: 'top',
  },

  createButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  createButtonDisabled: {
    opacity: 0.6,
  },

  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  sectionTitle: {
    marginBottom: 10,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#6B7280',
  },

  loadingBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 15,
    padding: 28,
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 10,
    color: '#6B7280',
  },

  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 15,
    padding: 28,
    alignItems: 'center',
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },

  emptyText: {
    marginTop: 6,
    textAlign: 'center',
    color: '#6B7280',
    lineHeight: 20,
  },

  controlCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 15,
    padding: 18,
    marginBottom: 11,
  },

  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },

  controlHeading: {
    flex: 1,
    paddingRight: 12,
  },

  controlCode: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#6B7280',
    marginBottom: 4,
  },

  controlTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: '#111827',
  },

  controlPurpose: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },

  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },

  detailRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },

  detailLabel: {
    width: 100,
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },

  detailValue: {
    flex: 1,
    fontSize: 12,
    color: '#374151',
  },

  lifecycleNotesInput: {
    marginTop: 12,
    minHeight: 66,
    textAlignVertical: 'top',
  },

  notesDisplay: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    padding: 11,
  },

  notesDisplayLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#6B7280',
  },

  notesDisplayText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: '#374151',
  },

  lifecycleButton: {
    minHeight: 42,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  lifecycleGroup: {
    marginTop: 12,
  },

  lifecycleGroupButton: {
    marginTop: 8,
  },

  lifecycleSecondaryButton: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D97706',
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  lifecycleSecondaryText: {
    color: '#9A3412',
    fontSize: 12,
    fontWeight: '800',
  },

  lifecycleButtonDisabled: {
    opacity: 0.6,
  },

  lifecycleButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  auditButton: {
    minHeight: 38,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  auditButtonText: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '800',
  },

  auditEvent: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    padding: 10,
  },

  auditAction: {
    fontSize: 11,
    fontWeight: '800',
    color: '#111827',
  },

  auditMeta: {
    marginTop: 3,
    fontSize: 10,
    color: '#6B7280',
  },

  auditDetail: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 15,
    color: '#374151',
  },

  securityCard: {
    marginTop: 14,
    backgroundColor: '#111827',
    borderRadius: 15,
    padding: 18,
  },

  securityTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#FFFFFF',
  },

  securityText: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 19,
    color: '#D1D5DB',
  },
});
