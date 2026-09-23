import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createRow, listRows, updateRow } from '@/data/workflows/core';
import { getActiveSeason, setActiveSeason } from '@/data/session';
import { rolloverFestivalSeason } from '@/data/workflows/season-rollover';

function dateOnly(value: unknown) {
  const text = String(value ?? '');
  return text ? text.slice(0, 10) : '';
}

function isoDate(value: string) {
  return value.trim() ? `${value.trim()}T00:00:00.000Z` : null;
}

export default function Season() {
  const [id, setId] = useState<string | null>(null);
  const [activeSeasonId, setActiveSeasonId] =
    useState<string | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [label, setLabel] = useState('2026');
  const [status, setStatus] = useState('draft');
  const [opensAt, setOpensAt] = useState('');
  const [notificationAt, setNotificationAt] = useState('');
  const [eventStartAt, setEventStartAt] = useState('');
  const [eventEndAt, setEventEndAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [rolloverLabel, setRolloverLabel] = useState('');
  const [rolloverConfirm, setRolloverConfirm] = useState('');
  const [rollingOver, setRollingOver] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');

      const rows = await listRows('festival_seasons', 'festival.manage');
      setSeasons(rows);

      const active = await getActiveSeason();
      setActiveSeasonId(active ? String(active.id) : null);
      const row = active ?? rows[0];

      if (row) {
        setId(String(row.id));
        setLabel(String(row.label ?? '2026'));
        setStatus(String(row.status ?? 'draft'));
        setOpensAt(dateOnly(row.opens_at));
        setNotificationAt(dateOnly(row.notification_at));
        setEventStartAt(dateOnly(row.event_start_at));
        setEventEndAt(dateOnly(row.event_end_at));
      }
    } catch (error: any) {
      setMessage(error?.message ?? 'Unable to load season.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const chooseSeason = (row: any) => {
    setMessage('');
    setId(String(row.id));
    setLabel(String(row.label ?? ''));
    setStatus(String(row.status ?? 'draft'));
    setOpensAt(dateOnly(row.opens_at));
    setNotificationAt(dateOnly(row.notification_at));
    setEventStartAt(dateOnly(row.event_start_at));
    setEventEndAt(dateOnly(row.event_end_at));
  };
  const makeActiveSeason = async () => {
    if (!id || id === activeSeasonId) return;

    try {
      setMessage('');
      await setActiveSeason(id);
      setActiveSeasonId(id);
      setMessage(
        `${label || 'Selected season'} is now the ACTIVE operational season.`
      );
    } catch (error: any) {
      setMessage(
        error?.message ?? 'Unable to make selected season active.'
      );
    }
  };


  const rolloverPhrase = rolloverLabel.trim()
    ? `ROLL OVER ${rolloverLabel.trim()}`
    : '';

  const rollover = async () => {
    if (!id || !rolloverLabel.trim()) {
      setMessage('Enter the new season / edition.');
      return;
    }

    if (rolloverConfirm.trim() !== rolloverPhrase) {
      setMessage(`Type ${rolloverPhrase} to confirm Roll-Over™.`);
      return;
    }

    try {
      setRollingOver(true);
      setMessage('');

      const result = await rolloverFestivalSeason(
        id,
        rolloverLabel.trim()
      );
      setRolloverLabel('');
      setRolloverConfirm('');
      await load();

      setMessage(
        `Roll-Over complete — ${result.newLabel}. ` +
        `${result.categoriesCopied} categories, ` +
        `${result.jurorsInvited} jurors invited, ` +
        `${result.benefitsCopied} benefits copied.`
      );
    } catch (error: any) {
      setMessage(error?.message ?? 'Roll-Over failed.');
    } finally {
      setRollingOver(false);
    }
  };

  const save = async () => {
    if (!label.trim()) {
      setMessage('Season / edition is required.');
      return;
    }

    if (eventStartAt && eventEndAt && eventEndAt < eventStartAt) {
      setMessage('Event end date cannot be before event start date.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      const values = {
        label: label.trim(),
        status,
        opens_at: isoDate(opensAt),
        notification_at: isoDate(notificationAt),
        event_start_at: isoDate(eventStartAt),
        event_end_at: isoDate(eventEndAt),
        updated_at: new Date().toISOString(),
      };

      if (id) {
        await updateRow(
          'festival_seasons',
          id,
          values,
          'festival.manage',
          'festival_season'
        );
      } else {
        await createRow(
          'festival_seasons',
          values,
          'festival.manage',
          'festival_season'
        );
      }

      await load();
      setMessage('Saved to Supabase.');
    } catch (error: any) {
      setMessage(error?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.eyebrow}>SEASON</Text>
      <Text style={styles.title}>Season Configuration</Text>
      <Text style={styles.subtitle}>
        Dates and season status are stored against the active festival tenant.
      </Text>

      {loading ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Existing seasons</Text>

          <View style={styles.row}>
            {seasons.map((season: any) => (
              <Pressable
                key={String(season.id)}
                style={[
                  styles.choice,
                  String(season.id) === id && styles.choiceActive,
                ]}
                onPress={() => chooseSeason(season)}
              >
                <Text
                  style={[
                    styles.choiceText,
                    String(season.id) === id && styles.choiceActiveText,
                  ]}
                >
                  {String(season.label ?? 'Untitled')} · {String(season.status ?? 'draft').toUpperCase()}
                  {String(season.id) === activeSeasonId ? ' · ACTIVE' : ''}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.subtitle}>
            Highlighted = selected for editing. ACTIVE = season used by
            submissions, jury, awards, payments and operational workflows.
          </Text>

          <Pressable
            style={styles.save}
            onPress={makeActiveSeason}
            disabled={
              !id ||
              id === activeSeasonId ||
              saving ||
              rollingOver
            }
          >
            <Text style={styles.saveText}>
              {id === activeSeasonId
                ? 'SELECTED SEASON IS ACTIVE'
                : 'MAKE SELECTED SEASON ACTIVE'}
            </Text>
          </Pressable>

          <Text style={styles.label}>Season / edition</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="2026"
          />

          <Text style={styles.label}>Opening date</Text>
          <TextInput
            style={styles.input}
            value={opensAt}
            onChangeText={setOpensAt}
            placeholder="YYYY-MM-DD"
          />

          <Text style={styles.label}>Notification date</Text>
          <TextInput
            style={styles.input}
            value={notificationAt}
            onChangeText={setNotificationAt}
            placeholder="YYYY-MM-DD"
          />

          <Text style={styles.label}>Event start date</Text>
          <TextInput
            style={styles.input}
            value={eventStartAt}
            onChangeText={setEventStartAt}
            placeholder="YYYY-MM-DD"
          />

          <Text style={styles.label}>Event end date</Text>
          <TextInput
            style={styles.input}
            value={eventEndAt}
            onChangeText={setEventEndAt}
            placeholder="YYYY-MM-DD"
          />

          <Text style={styles.label}>Season status</Text>
          <View style={styles.row}>
            {['draft', 'open', 'closed'].map((item) => (
              <Pressable
                key={item}
                style={[styles.choice, status === item && styles.choiceActive]}
                onPress={() => setStatus(item)}
              >
                <Text style={styles.choiceText}>{item.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Roll-Over™</Text>
          <Text style={styles.subtitle}>
            FROM: {label || 'Selected season'} → TO: new season / edition
          </Text>

          <TextInput
            style={styles.input}
            value={rolloverLabel}
            onChangeText={(value) => {
              setRolloverLabel(value);
              setRolloverConfirm('');
            }}
            placeholder="e.g. 2027, 2027/28, Season 12"
          />

          <Text style={styles.label}>Roll-Over confirmation</Text>
          <Text style={styles.subtitle}>
            {rolloverPhrase
              ? `Type exactly: ${rolloverPhrase}`
              : 'Enter the new season / edition above first.'}
          </Text>

          <TextInput
            style={styles.input}
            value={rolloverConfirm}
            onChangeText={setRolloverConfirm}
            autoCapitalize="characters"
            placeholder="ROLL OVER 2027"
          />

          <Pressable
            style={styles.save}
            onPress={rollover}
            disabled={
              rollingOver ||
              saving ||
              !id ||
              !rolloverPhrase ||
              rolloverConfirm.trim() !== rolloverPhrase
            }
          >
            <Text style={styles.saveText}>
              {rollingOver
                ? 'ROLLING OVER...'
                : 'ROLL OVER SELECTED SEASON™'}
            </Text>
          </Pressable>

          <Text style={styles.subtitle}>
            Creates a new DRAFT season. Dates remain editable.
          </Text>

          <Pressable style={styles.save} onPress={save} disabled={saving}>
            <Text style={styles.saveText}>
              {saving ? 'SAVING...' : 'SAVE SEASON'}
            </Text>
          </Pressable>

          {!!message && <Text style={styles.message}>{message}</Text>}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    gap: 10,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 30, fontWeight: '800' },
  subtitle: { fontSize: 15, opacity: 0.7, marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderColor: '#d8d8d8',
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  label: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#bdbdbd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  choice: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  choiceActive: { borderWidth: 2, backgroundColor: '#111' },
  choiceText: { fontWeight: '700' },
  choiceActiveText: { color: '#fff' },
  save: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  saveText: { color: '#fff', textAlign: 'center', fontWeight: '800' },
  message: { fontWeight: '700', marginTop: 4 },
});
