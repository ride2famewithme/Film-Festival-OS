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
import { router } from 'expo-router';

import { createRow, listRows, updateRow } from '@/data/workflows/core';

export default function FestivalProfile() {
  const [id, setId] = useState<string | null>(null);
  const [festivalName, setFestivalName] = useState('');
  const [country, setCountry] = useState('Australia');
  const [status, setStatus] = useState('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');

      const rows = await listRows('festival_profiles', 'festival.manage');
      const row = rows[0];

      if (row) {
        setId(String(row.id));
        setFestivalName(String(row.festival_name ?? ''));
        setCountry(String(row.country ?? 'Australia'));
        setStatus(String(row.status ?? 'draft'));
      }
    } catch (error: any) {
      setMessage(error?.message ?? 'Unable to load festival profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!festivalName.trim()) {
      setMessage('Festival name is required.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      const values = {
        festival_name: festivalName.trim(),
        country: country.trim() || 'Australia',
        status,
        updated_at: new Date().toISOString(),
      };

      if (id) {
        await updateRow(
          'festival_profiles',
          id,
          values,
          'festival.manage',
          'festival_profile'
        );
      } else {
        await createRow(
          'festival_profiles',
          values,
          'festival.manage',
          'festival_profile'
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
      <Text style={styles.eyebrow}>VIEW / EDIT</Text>
      <Text style={styles.title}>Festival Setup</Text>
      <Text style={styles.subtitle}>
        Real tenant-scoped festival profile stored in Supabase.
      </Text>

      {loading ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Festival name</Text>
          <TextInput
            style={styles.input}
            value={festivalName}
            onChangeText={setFestivalName}
            placeholder="Festival name"
          />

          <Text style={styles.label}>Country</Text>
          <TextInput
            style={styles.input}
            value={country}
            onChangeText={setCountry}
            placeholder="Country"
          />

          <Text style={styles.label}>Profile status</Text>
          <View style={styles.row}>
            {['draft', 'published'].map((item) => (
              <Pressable
                key={item}
                style={[styles.choice, status === item && styles.choiceActive]}
                onPress={() => setStatus(item)}
              >
                <Text style={styles.choiceText}>{item.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.save} onPress={save} disabled={saving}>
            <Text style={styles.saveText}>
              {saving ? 'SAVING...' : 'SAVE FESTIVAL PROFILE'}
            </Text>
          </Pressable>

          {!!message && <Text style={styles.message}>{message}</Text>}

          <Pressable
            style={styles.secondary}
            onPress={() => router.push('/season')}
          >
            <Text style={styles.secondaryText}>OPEN SEASON CONFIGURATION →</Text>
          </Pressable>
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
  choiceActive: { borderWidth: 2 },
  choiceText: { fontWeight: '700' },
  save: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  saveText: { color: '#fff', textAlign: 'center', fontWeight: '800' },
  secondary: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 10,
    padding: 13,
    marginTop: 6,
  },
  secondaryText: { textAlign: 'center', fontWeight: '700' },
  message: { fontWeight: '700', marginTop: 4 },
});
