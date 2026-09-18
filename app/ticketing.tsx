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

import QuickGuideHelp from '@/components/QuickGuideHelp';

import {
  createTicketedEvent,
  createVenue,
  getTicketingSnapshot,
  listTicketedEvents,
  listVenues,
} from '@/data/workflows/ticketing';

type DeliveryMode = 'in_person' | 'online' | 'hybrid';

export default function TicketingScreen() {
  const [venues, setVenues] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [venueName, setVenueName] = useState('');
  const [safeCapacity, setSafeCapacity] = useState('');
  const [capacitySource, setCapacitySource] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('in_person');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      const [v, e, s] = await Promise.all([
        listVenues(),
        listTicketedEvents(),
        getTicketingSnapshot(),
      ]);
      setVenues(v);
      setEvents(e);
      setSnapshot(s);
    } catch (error:any) {
      setMessage(error?.message ?? 'Unable to load ticketing data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addVenue = async () => {
    try {
      setSaving(true);
      setMessage('');
      await createVenue({
        name: venueName,
        venue_type: 'cinema',
        declared_safe_capacity: safeCapacity.trim()
          ? Number(safeCapacity)
          : null,
        capacity_source: capacitySource || null,
      });
      setVenueName('');
      setSafeCapacity('');
      setCapacitySource('');
      await load();
      setMessage('Venue saved.');
    } catch (error:any) {
      setMessage(error?.message ?? 'Venue save failed.');
    } finally {
      setSaving(false);
    }
  };

  const addEvent = async () => {
    try {
      setSaving(true);
      setMessage('');
      const firstVenue = venues[0]?.id ? String(venues[0].id) : null;

      if ((deliveryMode === 'in_person' || deliveryMode === 'hybrid') && !firstVenue) {
        throw new Error('Create a venue first for in-person or hybrid events.');
      }

      await createTicketedEvent({
        title: eventTitle,
        delivery_mode: deliveryMode,
        venue_id:
          deliveryMode === 'online'
            ? null
            : firstVenue,
        external_provider: 'native',
      });

      setEventTitle('');
      await load();
      setMessage('Ticketed event saved as DRAFT.');
    } catch (error:any) {
      setMessage(error?.message ?? 'Event save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.eyebrow}>TICKETING & VENUES</Text>
      <Text style={styles.title}>Box Office Control Centre™</Text>
      <Text style={styles.subtitle}>
        Native event inventory first; Ticketebo/Eventbrite remain optional adapters.
        Declared safe venue capacity is stored and enforced — never invented by the app.
      </Text>

      <QuickGuideHelp
        purpose="Create venues and ticketed events for physical, online or hybrid festival delivery."
        steps={[
          'Create or confirm the venue when physical attendance is involved.',
          'Create the event and choose IN PERSON, ONLINE or HYBRID.',
          'Save as DRAFT first; ticket pricing, inventory and checkout follow in later controls.',
        ]}
        terms={[
          { label: 'IN PERSON', description: 'Guests attend at a physical venue.' },
          { label: 'ONLINE', description: 'Guests attend remotely using approved online access.' },
          { label: 'HYBRID', description: 'Physical attendance and online access operate together, with separate capacity controls.' },
          { label: 'NATIVE', description: 'Film Festival OS™ manages the ticketing record directly rather than through an external provider.' },
        ]}
        flow={['VENUE', 'EVENT', 'TICKET TYPE', 'SALE', 'CHECK-IN / VIEW']}
      />

      {loading ? <ActivityIndicator /> : (
        <>
          <View style={styles.metrics}>
            {[
              ['Venues', snapshot?.venues ?? 0],
              ['Events', snapshot?.events ?? 0],
              ['On sale', snapshot?.onSale ?? 0],
              ['Orders', snapshot?.orders ?? 0],
              ['Tickets', snapshot?.tickets ?? 0],
            ].map(([label, value]) => (
              <View key={String(label)} style={styles.metric}>
                <Text style={styles.metricValue}>{String(value)}</Text>
                <Text style={styles.metricLabel}>{String(label)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>1. Add venue / location</Text>
            <TextInput
              style={styles.input}
              value={venueName}
              onChangeText={setVenueName}
              placeholder="Venue name"
            />
            <TextInput
              style={styles.input}
              value={safeCapacity}
              onChangeText={setSafeCapacity}
              placeholder="Declared safe capacity (optional)"
              keyboardType="number-pad"
            />
            <TextInput
              style={styles.input}
              value={capacitySource}
              onChangeText={setCapacitySource}
              placeholder="Capacity source / approval reference"
            />
            <Pressable style={styles.primary} onPress={addVenue} disabled={saving}>
              <Text style={styles.primaryText}>SAVE VENUE</Text>
            </Pressable>
            {venues.map((v:any) => (
              <Text key={v.id} style={styles.rowText}>
                • {v.name} · safe cap {v.declared_safe_capacity ?? 'not set'}
              </Text>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>2. Add ticketed event</Text>
            <TextInput
              style={styles.input}
              value={eventTitle}
              onChangeText={setEventTitle}
              placeholder="Screening / concert / ceremony title"
            />

            <Text style={styles.label}>Delivery mode</Text>
            <View style={styles.choiceRow}>
              {(['in_person','online','hybrid'] as DeliveryMode[]).map((mode) => (
                <Pressable
                  key={mode}
                  style={[styles.choice, deliveryMode === mode && styles.choiceActive]}
                  onPress={() => setDeliveryMode(mode)}
                >
                  <Text style={styles.choiceText}>{mode.replace('_',' ').toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>WHAT THESE OPTIONS MEAN</Text>
              <Text style={styles.note}>
                IN PERSON — guests attend at a physical venue.
              </Text>
              <Text style={styles.note}>
                ONLINE — guests attend remotely using approved online access.
              </Text>
              <Text style={styles.note}>
                HYBRID — the same event supports both physical attendance and online access.
                Physical venue capacity and online access capacity are managed separately.
              </Text>
            </View>

            <Text style={styles.note}>
              For this first control block, in-person/hybrid events attach to the first saved venue.
              Full venue selection, seat-map editor, ticket pricing and checkout are the next ticketing blocks.
            </Text>

            <Pressable style={styles.primary} onPress={addEvent} disabled={saving}>
              <Text style={styles.primaryText}>SAVE EVENT AS DRAFT</Text>
            </Pressable>

            {events.map((e:any) => (
              <View key={e.id} style={styles.eventRow}>
                <Text style={styles.eventTitle}>{e.title}</Text>
                <Text style={styles.rowText}>
                  {String(e.delivery_mode).replace('_',' ')} · {e.sales_status} · {e.external_provider}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>3. Public discovery</Text>
            <Text style={styles.note}>
              Published festivals can opt into the Film Festival OS™ directory and identify themselves
              as IN-PERSON, ONLINE or HYBRID.
            </Text>
            <Pressable style={styles.secondary} onPress={() => router.push('/festival-directory')}>
              <Text style={styles.secondaryText}>OPEN FESTIVAL DIRECTORY →</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => router.push('/festival-profile')}>
              <Text style={styles.secondaryText}>EDIT FESTIVAL PUBLICATION SETTINGS →</Text>
            </Pressable>
          </View>

          {!!message && <Text style={styles.message}>{message}</Text>}
        </>
      )}
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
  subtitle: { fontSize: 15, opacity: 0.72, lineHeight: 22 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: {
    minWidth: 110,
    borderWidth: 1,
    borderColor: '#d8d8d8',
    borderRadius: 14,
    padding: 14,
  },
  metricValue: { fontSize: 24, fontWeight: '800' },
  metricLabel: { fontSize: 12, opacity: 0.65, marginTop: 2 },
  card: {
    borderWidth: 1,
    borderColor: '#d8d8d8',
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: '#bdbdbd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  choiceActive: { borderWidth: 2 },
  choiceText: { fontWeight: '700', fontSize: 12 },
  primary: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 13,
  },
  primaryText: { color: '#fff', textAlign: 'center', fontWeight: '800' },
  secondary: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 10,
    padding: 12,
  },
  secondaryText: { textAlign: 'center', fontWeight: '700' },
  note: { fontSize: 13, opacity: 0.72, lineHeight: 19 },
  infoBox: {
    borderWidth: 1,
    borderColor: '#d8d8d8',
    borderRadius: 10,
    padding: 12,
    gap: 4,
    backgroundColor: '#F9FAFB',
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  rowText: { fontSize: 13, opacity: 0.72 },
  eventRow: {
    borderTopWidth: 1,
    borderTopColor: '#e4e4e4',
    paddingTop: 9,
  },
  eventTitle: { fontWeight: '800' },
  message: { fontWeight: '700' },
});
