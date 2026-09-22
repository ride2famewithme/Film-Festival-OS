import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Gavel,
  Plus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import {
  createRow,
  currentUserId,
  listRows,
  updateRow,
} from '@/data/workflows/core';

const CASE_TYPES = ['report', 'complaint', 'appeal'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export default function ModerationScreen() {
  const i = useSafeAreaInsets();

  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [caseType, setCaseType] =
    useState<(typeof CASE_TYPES)[number]>('report');
  const [priority, setPriority] =
    useState<(typeof PRIORITIES)[number]>('normal');

  const [reasons, setReasons] =
    useState<Record<string, string>>({});

  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const data =
        await listRows(
          'moderation_cases',
          'moderation.manage'
        );

      setRows(
        [...(data ?? [])].sort(
          (a: any, b: any) =>
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime()
        )
      );
    } catch (e: any) {
      Alert.alert(
        'Moderation',
        e?.message ?? 'Unable to load cases.'
      );
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createCase = async () => {
    if (!title.trim()) {
      Alert.alert(
        'Case required',
        'Enter a report, complaint or appeal summary.'
      );
      return;
    }

    try {
      setBusy(true);

      const now = new Date().toISOString();

      await createRow(
        'moderation_cases',
        {
          title: title.trim(),
          case_type: caseType,
          status: 'open',
          priority,
          decision_reason: null,
          created_by: await currentUserId(),
          created_at: now,
          updated_at: now,
        },
        'moderation.manage',
        'moderation_case'
      );

      setTitle('');
      setCaseType('report');
      setPriority('normal');

      await load();

      Alert.alert(
        'Case opened',
        'The moderation case has been recorded.'
      );
    } catch (e: any) {
      Alert.alert(
        'Moderation',
        e?.message ?? 'Unable to create case.'
      );
    } finally {
      setBusy(false);
    }
  };

  const advanceCase = async (row: any) => {
    const current = String(row.status);
    let next = '';
    const patch: any = {
      updated_at: new Date().toISOString(),
    };

    if (current === 'open') {
      next = 'under_review';
    } else if (current === 'under_review') {
      const reason =
        String(
          reasons[String(row.id)] ??
          row.decision_reason ??
          ''
        ).trim();

      if (!reason) {
        Alert.alert(
          'Decision reason required',
          'Record the reason before completing the decision.'
        );
        return;
      }

      patch.decision_reason = reason;
      next = 'decided';
    } else if (current === 'decided') {
      next = 'appeal';
    } else if (current === 'appeal') {
      next = 'closed';
    } else {
      return;
    }

    patch.status = next;

    try {
      setBusy(true);

      await updateRow(
        'moderation_cases',
        String(row.id),
        patch,
        'moderation.manage',
        'moderation_case'
      );

      await load();
    } catch (e: any) {
      Alert.alert(
        'Moderation',
        e?.message ?? 'Unable to update case.'
      );
    } finally {
      setBusy(false);
    }
  };

  const actionLabel = (status: string) => {
    if (status === 'open') return 'START REVIEW';
    if (status === 'under_review') return 'RECORD DECISION';
    if (status === 'decided') return 'OPEN APPEAL';
    if (status === 'appeal') return 'CLOSE CASE';
    return '';
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingTop: i.top + 12,
          paddingBottom: i.bottom + 50,
          paddingHorizontal: 20,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft
            size={19}
            color={THEME.accent}
          />
        </Pressable>

        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
          GLOBAL HQ · GOVERNANCE
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          Moderation, Complaints & Appeals
        </Text>

        <Text className="text-subhead text-muted-foreground mt-1 mb-5">
          Controlled case lifecycle with preserved decisions,
          reasons and audit history.
        </Text>

        <View className="rounded-2xl border border-border bg-card p-4 mb-5">
          <View className="flex-row items-center gap-2 mb-3">
            <ShieldAlert
              size={18}
              color={THEME.accent}
            />
            <Text className="text-headline font-bold text-card-foreground">
              Open Case
            </Text>
          </View>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Report, complaint or appeal summary"
            placeholderTextColor={THEME.mutedForeground}
            multiline
            className="border border-border rounded-xl px-3 py-3 text-foreground bg-background min-h-20"
          />

          <Text className="text-footnote font-semibold text-foreground mt-4 mb-2">
            Case type
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {CASE_TYPES.map((v) => (
              <Pressable
                key={v}
                onPress={() => setCaseType(v)}
                className="rounded-xl border border-border px-3 py-2"
              >
                <Text className="text-foreground font-semibold">
                  {caseType === v ? '✓ ' : ''}
                  {v.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-footnote font-semibold text-foreground mt-4 mb-2">
            Priority
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {PRIORITIES.map((v) => (
              <Pressable
                key={v}
                onPress={() => setPriority(v)}
                className="rounded-xl border border-border px-3 py-2"
              >
                <Text className="text-foreground font-semibold">
                  {priority === v ? '✓ ' : ''}
                  {v.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            disabled={busy}
            onPress={() => void createCase()}
            className="mt-4 rounded-xl bg-primary px-4 py-3 flex-row items-center justify-center gap-2"
          >
            <Plus size={17} color="black" />
            <Text className="font-bold text-primary-foreground">
              OPEN CASE
            </Text>
          </Pressable>
        </View>

        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-title3 font-bold text-foreground">
            Case Register
          </Text>

          <Pressable onPress={() => void load()}>
            <RefreshCw
              size={19}
              color={THEME.accent}
            />
          </Pressable>
        </View>

        {rows.length === 0 && (
          <View className="rounded-2xl border border-border bg-card p-4">
            <Text className="text-muted-foreground">
              No moderation cases recorded.
            </Text>
          </View>
        )}

        {rows.map((r: any) => {
          const status = String(r.status);

          return (
            <View
              key={r.id}
              className="rounded-2xl border border-border bg-card p-4 mb-3"
            >
              <View className="flex-row items-center gap-2">
                <Gavel
                  size={18}
                  color={THEME.accent}
                />

                <Text className="text-headline font-bold text-card-foreground flex-1">
                  {r.title}
                </Text>
              </View>

              <Text className="text-footnote text-muted-foreground mt-2">
                {String(r.case_type).toUpperCase()}
                {' · '}
                Priority {String(r.priority).toUpperCase()}
                {' · '}
                {status.replace(/_/g, ' ').toUpperCase()}
              </Text>

              <Text className="text-caption text-muted-foreground mt-1">
                Case {String(r.id).slice(0, 8).toUpperCase()}
                {' · '}
                Updated{' '}
                {new Date(r.updated_at).toLocaleString()}
              </Text>

              {!!r.decision_reason && (
                <View className="rounded-xl border border-border p-3 mt-3">
                  <Text className="text-footnote font-semibold text-foreground">
                    Decision reason
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-1">
                    {r.decision_reason}
                  </Text>
                </View>
              )}

              {status === 'under_review' && (
                <TextInput
                  value={
                    reasons[String(r.id)] ??
                    r.decision_reason ??
                    ''
                  }
                  onChangeText={(value) =>
                    setReasons((old) => ({
                      ...old,
                      [String(r.id)]: value,
                    }))
                  }
                  placeholder="Decision reason — required before decision"
                  placeholderTextColor={THEME.mutedForeground}
                  multiline
                  className="mt-3 border border-border rounded-xl px-3 py-3 text-foreground bg-background min-h-20"
                />
              )}

              {!!actionLabel(status) && (
                <Pressable
                  disabled={busy}
                  onPress={() =>
                    void advanceCase(r)
                  }
                  className="mt-3 rounded-xl border border-primary px-4 py-3 items-center"
                >
                  <Text className="font-bold text-primary">
                    {actionLabel(status)}
                  </Text>
                </Pressable>
              )}

              {status === 'closed' && (
                <Text className="text-footnote font-semibold text-muted-foreground mt-3">
                  CLOSED · RECORD PRESERVED
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
