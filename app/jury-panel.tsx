import { goWorkspaceHome } from '@/lib/navigation';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import {
  createJuryPanelMember,
  getJuryGovernanceSettings,
  inviteJurorAccount,
  linkJuryPanelMemberAccount,
  listJurorCandidates,
  listJuryPanelMembers,
  recuseJuryPanelMember,
} from '@/data/workflows/jury-governance';

import {
  assignJurorWithScoringForm,
  listSubmissions,
} from '@/data/workflows/festival-core';

import { listScoringForms } from '@/data/workflows/jury-scoring-forms';

type Kind = 'independent' | 'vip_guest' | 'sponsor' | 'ai';

export default function JuryPanel() {
  const i = useSafeAreaInsets();

  const [rows, setRows] = useState<any[]>([]);
  const [cfg, setCfg] = useState<any>(null);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<Kind>('independent');
  const [weight, setWeight] = useState('10');
  const [jurorEmail, setJurorEmail] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('');
  const [selectedPanelMemberId, setSelectedPanelMemberId] = useState('');
  const [selectedFormId, setSelectedFormId] = useState('');
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignStatus, setAssignStatus] = useState('');

  const load = async () => {
    try {
      const [
        members,
        settings,
        jurors,
        submissionRows,
        scoringForms,
      ] = await Promise.all([
        listJuryPanelMembers(),
        getJuryGovernanceSettings(),
        listJurorCandidates(),
        listSubmissions(),
        listScoringForms(),
      ]);
      setRows(members);
      setCfg(settings);
      setCandidates(jurors);
      setSubmissions(submissionRows);
      setForms(
        scoringForms.filter((f: any) => f.status === 'active')
      );
    } catch (e: any) {
      Alert.alert('Jury Panel', e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    const n = Number(weight);

    if (!label.trim())
      return Alert.alert('Required', 'Juror label is required.');

    if (!Number.isFinite(n) || n <= 0)
      return Alert.alert('Weight', 'Enter a valid percentage.');

    setBusy(true);

    try {
      await createJuryPanelMember({
        display_label: label,
        juror_kind: kind,
        weight_percent: n,
      });

      setLabel('');
      await load();
    } catch (e: any) {
      Alert.alert('Could not add juror', e.message);
    } finally {
      setBusy(false);
    }
  };

  const inviteJuror = async () => {
    const email = jurorEmail.trim().toLowerCase();

    if (!email || !email.includes('@'))
      return Alert.alert('Juror email', 'Enter a valid email address.');

    setInviteBusy(true);

    try {
      await inviteJurorAccount(email);
      setJurorEmail('');
      await load();
      Alert.alert('Juror invited', 'Juror account invitation created.');
    } catch (e: any) {
      Alert.alert('Could not invite juror', e.message);
    } finally {
      setInviteBusy(false);
    }
  };

  const assignFilm = async () => {
    setAssignStatus('CHECKING: Assign Film clicked.');

    if (!selectedSubmissionId) {
      setAssignStatus('STOP: select a film submission first.');
      return Alert.alert('Assignment', 'Select a film submission.');
    }

    if (!selectedPanelMemberId) {
      setAssignStatus('STOP: select a linked juror.');
      return Alert.alert('Assignment', 'Select a linked juror.');
    }

    if (!selectedFormId) {
      setAssignStatus('STOP: select an active scoring form.');
      return Alert.alert('Assignment', 'Select an active scoring form.');
    }

    const member = rows.find(
      (r) => r.id === selectedPanelMemberId
    );

    if (!member?.auth_user_id) {
      setAssignStatus('STOP: selected juror account is not linked.');
      return Alert.alert(
        'Assignment',
        'Selected panel member does not have a linked juror account.'
      );
    }

    setAssignBusy(true);
    setAssignStatus('WORKING: creating jury assignment…');

    try {
      await assignJurorWithScoringForm(
        selectedSubmissionId,
        member.auth_user_id,
        selectedFormId
      );

      setAssignStatus('SUCCESS: jury assignment created.');

      Alert.alert(
        'Assignment created',
        'The film has been assigned to the juror.'
      );

      setSelectedSubmissionId('');
      setSelectedPanelMemberId('');
      await load();
    } catch (e: any) {
      const message = e?.message || String(e);
      console.error('JURY ASSIGNMENT ERROR:', e);
      setAssignStatus(`ERROR: ${message}`);
      Alert.alert('Could not create assignment', message);
    } finally {
      setAssignBusy(false);
    }
  };

  const confirmJurorLink = async (panelMember: any, candidate: any) => {
    const performLink = async () => {
      try {
        await linkJuryPanelMemberAccount(
          panelMember.id,
          candidate.user_id
        );
        await load();
      } catch (e: any) {
        Alert.alert(
          'Could not link account',
          e?.message || String(e)
        );
      }
    };

    const message =
      `${panelMember.auth_user_id ? 'Change' : 'Link'} ` +
      `${panelMember.display_label} to ${candidate.email}?`;

    if (Platform.OS === 'web') {
      const confirmFn = (globalThis as any).confirm;
      const approved =
        typeof confirmFn === 'function'
          ? confirmFn(message)
          : true;

      if (approved) {
        await performLink();
      }
      return;
    }

    Alert.alert(
      panelMember.auth_user_id
        ? 'Change juror account'
        : 'Link juror account',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: panelMember.auth_user_id ? 'Change' : 'Link',
          onPress: () => {
            void performLink();
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingTop: i.top + 12,
          paddingBottom: i.bottom + 40,
          paddingHorizontal: 20,
        }}
      >
        <Pressable
          onPress={() => void goWorkspaceHome()}
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft color={THEME.accent} size={19} />
        </Pressable>

        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
          PRIVATE JURY
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          Jury Panel & Weight Set™
        </Text>

        <Text className="text-subhead text-muted-foreground mt-1 mb-4">
          Juror identities remain confidential during active judging.
          Weighted voting is controlled by governance limits.
        </Text>

        {cfg && (
          <View className="rounded-2xl border border-border bg-card p-4 mb-4">
            <Text className="font-semibold text-card-foreground">
              Governance limits
            </Text>
            <Text className="text-footnote text-muted-foreground mt-1">
              Sponsor single seat: max {cfg.sponsor_single_cap_percent}%
            </Text>
            <Text className="text-footnote text-muted-foreground">
              Combined sponsors: max {cfg.sponsor_total_cap_percent}%
            </Text>
            <Text className="text-footnote text-muted-foreground">
              Any single juror: max {cfg.max_single_juror_percent}%
            </Text>
            <Text className="text-footnote text-muted-foreground">
              AI juror: max {cfg.ai_cap_percent}%
            </Text>
          </View>
        )}

        <View className="rounded-3xl border border-border bg-card p-4 gap-3 mb-4">
          <Text className="text-headline font-semibold text-card-foreground">
            Invite Juror Account
          </Text>

          <TextInput
            value={jurorEmail}
            onChangeText={setJurorEmail}
            placeholder="juror@example.com"
            placeholderTextColor={THEME.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
          />

          <Pressable
            onPress={inviteJuror}
            disabled={inviteBusy}
            className="rounded-xl border border-primary px-4 py-3"
          >
            <Text className="font-semibold text-primary text-center">
              {inviteBusy ? 'Inviting…' : 'Invite Juror'}
            </Text>
          </Pressable>
        </View>

        <View className="rounded-3xl border border-border bg-card p-4 gap-3">
          <Text className="text-headline font-semibold text-card-foreground">
            Add confidential panel member
          </Text>

          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Internal juror label — e.g. Independent Juror A"
            placeholderTextColor={THEME.muted}
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
          />

          <View className="flex-row flex-wrap gap-2">
            {(
              [
                ['independent', 'Independent'],
                ['vip_guest', 'VIP / Guest'],
                ['sponsor', 'Sponsor'],
                ['ai', 'AI Juror'],
              ] as const
            ).map(([k, text]) => (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                className={`rounded-full border px-3 py-2 ${
                  kind === k
                    ? 'border-primary bg-primary'
                    : 'border-border bg-background'
                }`}
              >
                <Text
                  className={
                    kind === k
                      ? 'text-primary-foreground'
                      : 'text-foreground'
                  }
                >
                  {text}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="Voting weight %"
            placeholderTextColor={THEME.muted}
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
          />

          <Pressable
            onPress={add}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-3 flex-row justify-center items-center gap-2"
          >
            <Plus size={17} color={THEME.primaryFg} />
            <Text className="font-bold text-primary-foreground">
              {busy ? 'Saving…' : 'Add Panel Member'}
            </Text>
          </Pressable>
        </View>


        <View className="rounded-3xl border border-border bg-card p-4 gap-3 mt-4">
          <Text className="text-headline font-semibold text-card-foreground">
            Assign film to juror
          </Text>

          <Text className="text-footnote text-muted-foreground">
            1. Select film
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {submissions.map((submission) => (
              <Pressable
                key={submission.id}
                onPress={() => setSelectedSubmissionId(submission.id)}
                className={`rounded-full border px-3 py-2 ${
                  selectedSubmissionId === submission.id
                    ? 'border-primary bg-primary'
                    : 'border-border bg-background'
                }`}
              >
                <Text
                  className={
                    selectedSubmissionId === submission.id
                      ? 'text-primary-foreground'
                      : 'text-foreground'
                  }
                >
                  {submission.title || 'Untitled submission'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-footnote text-muted-foreground mt-2">
            2. Select linked juror
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {rows
              .filter(
                (r) =>
                  r.auth_user_id &&
                  r.status !== 'recused' &&
                  r.conflict_status === 'clear'
              )
              .map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setSelectedPanelMemberId(r.id)}
                  className={`rounded-full border px-3 py-2 ${
                    selectedPanelMemberId === r.id
                      ? 'border-primary bg-primary'
                      : 'border-border bg-background'
                  }`}
                >
                  <Text
                    className={
                      selectedPanelMemberId === r.id
                        ? 'text-primary-foreground'
                        : 'text-foreground'
                    }
                  >
                    {r.display_label}
                  </Text>
                </Pressable>
              ))}
          </View>

          <Text className="text-footnote text-muted-foreground mt-2">
            3. Select active scoring form
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {forms.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setSelectedFormId(f.id)}
                className={`rounded-full border px-3 py-2 ${
                  selectedFormId === f.id
                    ? 'border-primary bg-primary'
                    : 'border-border bg-background'
                }`}
              >
                <Text
                  className={
                    selectedFormId === f.id
                      ? 'text-primary-foreground'
                      : 'text-foreground'
                  }
                >
                  {f.name} v{f.version}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={assignFilm}
            disabled={assignBusy}
            className="rounded-xl bg-primary px-4 py-3 mt-2"
          >
            <Text className="font-bold text-primary-foreground text-center">
              {assignBusy ? 'Assigning…' : 'Assign Film'}
            </Text>
          </Pressable>

          {!!assignStatus && (
            <Text className="text-footnote text-muted-foreground mt-2">
              {assignStatus}
            </Text>
          )}
        </View>

        <View className="flex-row justify-between items-center mt-6 mb-3">
          <Text className="text-title3 font-semibold text-foreground">
            Confidential panel
          </Text>
          <Pressable onPress={load}>
            <RefreshCw size={19} color={THEME.accent} />
          </Pressable>
        </View>

        {rows.map((r) => (
          <View
            key={r.id}
            className="rounded-2xl border border-border bg-card p-4 mb-3"
          >
            <Text className="text-headline font-semibold text-card-foreground">
              {r.display_label}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              {r.juror_kind} · weight {r.weight_percent}% · {r.status}
            </Text>

            <Text className="text-footnote text-muted-foreground">
              Identity: {r.identity_visibility} · Conflict: {r.conflict_status}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Account: {r.auth_user_id ? 'LINKED' : 'NOT LINKED'}
            </Text>

            {r.status !== 'recused' &&
              candidates
                .filter(
                  (c) =>
                    !rows.some(
                      (x) =>
                        x.auth_user_id &&
                        x.auth_user_id === c.user_id
                    )
                )
                .map((c) => (
                  <Pressable
                    key={c.user_id}
                    onPress={() => {
                      void confirmJurorLink(r, c);
                    }}
                    className="self-start rounded-full border border-primary px-3 py-2 mt-2"
                  >
                    <Text className="text-footnote text-primary">
                      {r.auth_user_id ? `Change to ${c.email}` : `Link ${c.email}`}
                    </Text>
                  </Pressable>
                ))}

            {r.status !== 'recused' && (
              <Pressable
                onPress={async () => {
                  await recuseJuryPanelMember(r.id);
                  await load();
                }}
                className="self-start rounded-full border border-border px-3 py-2 mt-3"
              >
                <Text className="text-footnote text-foreground">
                  Recuse
                </Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
