import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  MailCheck,
  RefreshCw,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import { listNotifications } from '@/data/workflows/festival-core';
import { getActiveContext } from '@/data/session';

function deliveryLabel(row: any) {
  if (row.delivered_at) return 'DELIVERED';

  const status = String(row.status ?? '').toLowerCase();

  if (status === 'processing') return 'PROCESSING';
  if (status === 'sent') return 'SENT';
  if (status === 'failed') return 'FAILED';
  if (status === 'held') return 'HELD';

  return 'QUEUED';
}

function displayDate(value: any) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

export default function NotificationQueue() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    try {
      setRows(await listNotifications());
    } catch (error: any) {
      Alert.alert(
        'Notifications',
        error.message,
      );
    }
  };

  useEffect(() => {
    load();
  }, []);

  const goBack = async () => {
    try {
      const context = await getActiveContext();

      if (context?.role === 'platform_admin') {
        router.replace('/global-hq');
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } catch {
      router.replace('/(tabs)/dashboard');
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 20,
        }}
      >
        <Pressable
          onPress={goBack}
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft
            color={THEME.accent}
            size={19}
          />
        </Pressable>

        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
          DELIVERY CONTROL
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          Notification Queue
        </Text>

        <Text className="text-subhead text-muted-foreground mt-1 mb-5">
          Live delivery records from queue through provider delivery confirmation.
        </Text>

        <Pressable
          onPress={load}
          className="self-end mb-3"
        >
          <RefreshCw
            size={19}
            color={THEME.accent}
          />
        </Pressable>

        {rows.map((row) => {
          const label = deliveryLabel(row);

          return (
            <View
              key={row.id}
              className="rounded-2xl border border-border bg-card p-4 mb-3"
            >
              <View className="flex-row gap-2 items-center">
                <MailCheck
                  size={17}
                  color={THEME.accent}
                />

                <Text className="text-headline font-semibold text-card-foreground flex-1">
                  {row.subject}
                </Text>
              </View>

              <Text className="text-footnote font-semibold text-primary mt-2">
                {label}
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                {row.recipient_email}
              </Text>

              <Text className="text-footnote text-foreground mt-3">
                {row.body}
              </Text>

              <View className="border-t border-border mt-4 pt-3">
                <Text className="text-footnote text-muted-foreground">
                  Provider: {row.provider ?? '—'}
                </Text>

                <Text className="text-footnote text-muted-foreground mt-1">
                  Attempts: {row.attempt_count ?? 0}
                </Text>

                <Text className="text-footnote text-muted-foreground mt-1">
                  Queued: {displayDate(row.queued_at)}
                </Text>

                <Text className="text-footnote text-muted-foreground mt-1">
                  Sent: {displayDate(row.sent_at)}
                </Text>

                <Text className="text-footnote text-muted-foreground mt-1">
                  Delivered: {displayDate(row.delivered_at)}
                </Text>

                {row.provider_message_id ? (
                  <Text className="text-footnote text-muted-foreground mt-1">
                    Provider ID: {row.provider_message_id}
                  </Text>
                ) : null}

                {row.last_error ? (
                  label === 'HELD' ? (
                    <Text className="text-footnote text-muted-foreground mt-2">
                      Hold reason: {row.last_error}
                    </Text>
                  ) : (
                    <Text className="text-footnote text-destructive mt-2">
                      Error: {row.last_error}
                    </Text>
                  )
                ) : null}
              </View>
            </View>
          );
        })}

        {rows.length === 0 ? (
          <Text className="text-muted-foreground">
            No notification records yet.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
