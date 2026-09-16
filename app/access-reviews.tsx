import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import { can } from '@/data/access';
import { getActiveContext } from '@/data/session';
import { requireSupabaseClient } from '@/data/supabase-client';

type ReviewRow = {
  membership_id: string;
  user_id: string;
  email: string;
  role: string;
  membership_status: string;
  review_id?: string | null;
  review_outcome?: string | null;
  reviewed_at?: string | null;
  next_review_due?: string | null;
};

export default function AccessReviewsScreen() {
  const i = useSafeAreaInsets();

  const [rows,setRows] = useState<ReviewRow[]>([]);
  const [loading,setLoading] = useState(false);
  const [busyId,setBusyId] = useState<string | null>(null);
  const [reReviewId,setReReviewId] = useState<string | null>(null);
  const [message,setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const ctx = await getActiveContext();

      if (!ctx) throw new Error('Authentication required');

      if (!can(ctx.role,'people.manage')) {
        throw new Error('Permission denied');
      }

      const client = requireSupabaseClient();

      const { data,error } = await client.rpc(
        'access_review_register',
        {
          p_tenant_id:ctx.tenantId,
        }
      );

      if (error) throw new Error(error.message);

      setRows((data ?? []) as ReviewRow[]);
    } catch(e:any) {
      setMessage(e.message ?? 'Unable to load access reviews');
    } finally {
      setLoading(false);
    }
  },[]);

  useEffect(() => {
    void load();
  },[load]);

  function reviewCurrent(row:ReviewRow) {
    if (!row.review_id || !row.next_review_due) {
      return false;
    }

    return new Date(row.next_review_due).getTime() > Date.now();
  }

  async function record(
    row:ReviewRow,
    outcome:'retained'|'action_required',
    allowEarly:boolean
  ) {
    setBusyId(row.membership_id);
    setMessage('');

    try {
      const client = requireSupabaseClient();

      const { error } = await client.rpc(
        'record_access_review',
        {
          p_membership_id:row.membership_id,
          p_outcome:outcome,
          p_note:
            allowEarly
              ? (
                  outcome === 'retained'
                    ? 'Explicit early re-review completed; access retained.'
                    : 'Explicit early re-review completed; follow-up action required.'
                )
              : (
                  outcome === 'retained'
                    ? 'Periodic access review completed.'
                    : 'Periodic access review requires follow-up action.'
                ),
          p_allow_early:allowEarly,
        }
      );

      if (error) throw new Error(error.message);

      setReReviewId(null);

      setMessage(
        allowEarly
          ? (
              outcome === 'retained'
                ? 'Early re-review recorded. Access retained and audit event created.'
                : 'Early re-review recorded as ACTION REQUIRED. Access has NOT been suspended.'
            )
          : (
              outcome === 'retained'
                ? 'Access retained. Review evidence and audit event recorded.'
                : 'Action required recorded. Access has NOT been suspended.'
            )
      );

      await load();
    } catch(e:any) {
      setMessage(e.message ?? 'Access review failed');
    } finally {
      setBusyId(null);
    }
  }

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
          onPress={() => router.replace('/access-governance')}
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft color={THEME.accent} size={19}/>
        </Pressable>

        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
          SECURITY & ACCESS
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          Periodic Access Reviews
        </Text>

        <Text className="text-subhead text-muted-foreground mt-2 mb-5">
          Review tenant memberships, retain justified access, or flag accounts requiring follow-up.
        </Text>

        <View className="rounded-2xl border border-primary bg-card p-4 mb-5">
          <Text className="text-headline font-semibold text-primary">
            Duplicate-review protection
          </Text>

          <Text className="text-footnote text-muted-foreground mt-1">
            A current review cannot be accidentally submitted again. REVIEW AGAIN must be explicitly selected before an early re-review can be recorded.
          </Text>
        </View>

        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-headline font-semibold text-foreground">
            Membership Review Register
          </Text>

          <Pressable onPress={() => void load()} className="p-2">
            <RefreshCw color={THEME.accent} size={18}/>
          </Pressable>
        </View>

        {loading && rows.length === 0 ? (
          <ActivityIndicator color={THEME.accent}/>
        ) : null}

        {!loading && rows.length === 0 ? (
          <Text className="text-footnote text-muted-foreground">
            No eligible memberships require review in this workspace.
          </Text>
        ) : null}

        <View className="gap-3">
          {rows.map(row => {
            const busy = busyId === row.membership_id;
            const current = reviewCurrent(row);
            const armed = reReviewId === row.membership_id;

            return (
              <View
                key={row.membership_id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <View className="flex-row gap-3 items-center">
                  <ShieldCheck
                    color={THEME.accent}
                    size={19}
                  />

                  <View className="flex-1">
                    <Text className="text-headline font-semibold text-card-foreground">
                      {row.email}
                    </Text>

                    <Text className="text-footnote text-muted-foreground mt-1">
                      {String(row.role).toUpperCase()}
                      {' · '}
                      {String(row.membership_status).toUpperCase()}
                    </Text>
                  </View>

                  <Text className="text-caption font-bold text-primary">
                    {row.review_outcome
                      ? String(row.review_outcome).toUpperCase()
                      : 'NOT REVIEWED'}
                  </Text>
                </View>

                <Text className="text-footnote text-muted-foreground mt-3">
                  {row.reviewed_at
                    ? `Last reviewed: ${new Date(row.reviewed_at).toLocaleString()}`
                    : 'No periodic review recorded yet.'}
                </Text>

                {row.next_review_due ? (
                  <Text className="text-footnote text-muted-foreground mt-1">
                    Next review due: {new Date(row.next_review_due).toLocaleDateString()}
                  </Text>
                ) : null}

                {current && !armed ? (
                  <View className="mt-3">
                    <Pressable
                      disabled={busy}
                      onPress={() => {
                        setReReviewId(row.membership_id);
                        setMessage(
                          'Early re-review armed. Choose an outcome or cancel.'
                        );
                      }}
                      className="rounded-lg border border-primary px-3 py-2 self-start"
                    >
                      <Text className="text-footnote font-semibold text-primary">
                        REVIEW AGAIN
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-2 mt-3">
                    <Pressable
                      disabled={busy}
                      onPress={() =>
                        void record(
                          row,
                          'retained',
                          current && armed
                        )
                      }
                      className="rounded-lg border border-primary px-3 py-2"
                    >
                      <Text className="text-footnote font-semibold text-primary">
                        RETAIN ACCESS
                      </Text>
                    </Pressable>

                    <Pressable
                      disabled={busy}
                      onPress={() =>
                        void record(
                          row,
                          'action_required',
                          current && armed
                        )
                      }
                      className="rounded-lg border border-border px-3 py-2"
                    >
                      <Text className="text-footnote font-semibold text-card-foreground">
                        FLAG ACTION REQUIRED
                      </Text>
                    </Pressable>

                    {armed ? (
                      <Pressable
                        disabled={busy}
                        onPress={() => {
                          setReReviewId(null);
                          setMessage('Early re-review cancelled.');
                        }}
                        className="rounded-lg border border-border px-3 py-2"
                      >
                        <Text className="text-footnote text-muted-foreground">
                          Cancel
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {message ? (
          <View className="rounded-xl border border-border bg-card p-3 mt-5">
            <Text className="text-footnote text-muted-foreground">
              {message}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
