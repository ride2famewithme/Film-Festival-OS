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
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import {
  createJuryIntegrityEvent,
  listJuryIntegrityEvents,
  resolveJuryIntegrityEvent,
  type JuryIntegrityEventType,
  type JuryIntegritySeverity,
} from '@/data/workflows/jury-integrity';

const eventTypes: Array<[JuryIntegrityEventType, string]> = [
  ['conflict_declared', 'Conflict'],
  ['recusal', 'Recusal'],
  ['contact_attempt', 'Contact Attempt'],
  ['canvassing_attempt', 'Canvassing'],
  ['gift_or_inducement', 'Gift / Inducement'],
  ['pressure_or_lobbying', 'Pressure / Lobbying'],
  ['score_disclosure', 'Score Disclosure'],
  ['manual_review', 'Manual Review'],
];

const severities: JuryIntegritySeverity[] = [
  'low',
  'medium',
  'high',
  'critical',
];

export default function JuryIntegrity() {
  const i = useSafeAreaInsets();

  const [rows, setRows] = useState<any[]>([]);
  const [eventType, setEventType] =
    useState<JuryIntegrityEventType>('contact_attempt');
  const [severity, setSeverity] =
    useState<JuryIntegritySeverity>('medium');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setRows(await listJuryIntegrityEvents());
    } catch (e: any) {
      Alert.alert('Jury Integrity', e.message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    if (!note.trim()) {
      return Alert.alert('Required', 'Describe the integrity event.');
    }

    setBusy(true);

    try {
      await createJuryIntegrityEvent({
        event_type: eventType,
        severity,
        note,
      });

      setNote('');
      await load();
    } catch (e: any) {
      Alert.alert('Could not record event', e.message);
    } finally {
      setBusy(false);
    }
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
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft color={THEME.accent} size={19} />
        </Pressable>

        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
          JURY GOVERNANCE
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          Jury Integrity & Interference Register™
        </Text>

        <Text className="text-subhead text-muted-foreground mt-2 mb-5">
          Record conflicts, contact attempts, canvassing, inducements,
          lobbying, score disclosure and other jury-integrity incidents.
        </Text>

        <View className="rounded-3xl border border-border bg-card p-4 gap-4">
          <Text className="text-headline font-semibold text-card-foreground">
            Record Integrity Event
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {eventTypes.map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setEventType(value)}
                className={`rounded-full border px-3 py-2 ${
                  eventType === value
                    ? 'border-primary bg-primary'
                    : 'border-border bg-background'
                }`}
              >
                <Text
                  className={
                    eventType === value
                      ? 'text-primary-foreground'
                      : 'text-foreground'
                  }
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-footnote font-semibold text-card-foreground">
            Severity
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {severities.map((value) => (
              <Pressable
                key={value}
                onPress={() => setSeverity(value)}
                className={`rounded-full border px-3 py-2 ${
                  severity === value
                    ? 'border-primary bg-primary'
                    : 'border-border bg-background'
                }`}
              >
                <Text
                  className={
                    severity === value
                      ? 'text-primary-foreground'
                      : 'text-foreground'
                  }
                >
                  {value.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Describe what happened..."
            placeholderTextColor={THEME.muted}
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground min-h-24"
          />

          <Pressable
            onPress={() => void add()}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-3 flex-row justify-center items-center gap-2"
            style={{ opacity: busy ? 0.5 : 1 }}
          >
            <Plus size={17} color={THEME.primaryFg} />
            <Text className="font-bold text-primary-foreground">
              {busy ? 'Saving…' : 'Record Integrity Event'}
            </Text>
          </Pressable>
        </View>

        <View className="flex-row justify-between items-center mt-6 mb-3">
          <Text className="text-title3 font-semibold text-foreground">
            Integrity Register
          </Text>

          <Pressable onPress={() => void load()}>
            <RefreshCw size={19} color={THEME.accent} />
          </Pressable>
        </View>

        {rows.length === 0 ? (
          <Text className="text-muted-foreground">
            No jury-integrity events recorded.
          </Text>
        ) : null}

        {rows.map((r) => (
          <View
            key={String(r.id)}
            className="rounded-2xl border border-border bg-card p-4 mb-3"
          >
            <View className="flex-row justify-between gap-3">
              <Text className="text-headline font-semibold text-card-foreground flex-1">
                {String(r.event_type).replace(/_/g, ' ')}
              </Text>

              <Text className="text-caption font-bold text-primary uppercase">
                {r.resolved ? 'RESOLVED' : 'OPEN'}
              </Text>
            </View>

            <Text className="text-footnote text-muted-foreground mt-1">
              Severity: {String(r.severity).toUpperCase()}
            </Text>

            <Text className="text-subhead text-foreground mt-2">
              {r.note || 'No note recorded.'}
            </Text>

            {!r.resolved ? (
              <Pressable
                onPress={async () => {
                  try {
                    await resolveJuryIntegrityEvent(String(r.id));
                    await load();
                  } catch (e: any) {
                    Alert.alert('Could not resolve event', e.message);
                  }
                }}
                className="self-start rounded-full border border-primary px-3 py-2 mt-3"
              >
                <Text className="text-footnote font-semibold text-primary">
                  Mark Resolved
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
