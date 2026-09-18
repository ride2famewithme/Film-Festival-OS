import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { db } from '@/data/db';

type Mode = 'all' | 'in_person' | 'online' | 'hybrid';

export default function FestivalDirectoryScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [mode, setMode] = useState<Mode>('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await db.from<any>('festival_profiles')
          .select('*')
          .order('festival_name');
        if (r.error) throw new Error(r.error.message);

        setRows(
          (r.data ?? []).filter(
            (x:any) => x.status === 'published' && x.directory_public === true
          )
        );
      } catch (error:any) {
        setMessage(error?.message ?? 'Unable to load festival directory.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible = useMemo(
    () => rows.filter((x:any) => mode === 'all' || x.delivery_mode === mode),
    [rows, mode]
  );

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.eyebrow}>PUBLIC DISCOVERY</Text>
      <Text style={styles.title}>Film Festival OS™ Directory</Text>
      <Text style={styles.subtitle}>
        One directory for in-person, online-only and hybrid festivals.
      </Text>

      <View style={styles.filters}>
        {(['all','in_person','online','hybrid'] as Mode[]).map((x) => (
          <Pressable
            key={x}
            style={[styles.filter, mode === x && styles.filterActive]}
            onPress={() => setMode(x)}
          >
            <Text style={styles.filterText}>{x.replace('_',' ').toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <ActivityIndicator /> : (
        <View style={styles.list}>
          {visible.map((festival:any) => (
            <View key={festival.id} style={styles.card}>
              <Text style={styles.name}>{festival.festival_name}</Text>
              <Text style={styles.meta}>
                {festival.country || 'Location TBA'} · {String(festival.delivery_mode || 'in_person').replace('_',' ')}
              </Text>
              {!!festival.directory_slug && (
                <Text style={styles.slug}>/{festival.directory_slug}</Text>
              )}
            </View>
          ))}
          {!visible.length && (
            <Text style={styles.empty}>No published festivals match this filter yet.</Text>
          )}
        </View>
      )}

      {!!message && <Text style={styles.message}>{message}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    gap: 14,
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 30, fontWeight: '800' },
  subtitle: { fontSize: 15, opacity: 0.72 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  filterActive: { borderWidth: 2 },
  filterText: { fontSize: 12, fontWeight: '800' },
  list: { gap: 10 },
  card: {
    borderWidth: 1,
    borderColor: '#d8d8d8',
    borderRadius: 16,
    padding: 17,
  },
  name: { fontSize: 18, fontWeight: '800' },
  meta: { fontSize: 13, opacity: 0.72, marginTop: 4 },
  slug: { fontSize: 12, opacity: 0.55, marginTop: 5 },
  empty: { opacity: 0.66, paddingVertical: 18 },
  message: { fontWeight: '700' },
});
