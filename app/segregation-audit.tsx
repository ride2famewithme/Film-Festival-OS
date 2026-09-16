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
  ShieldAlert,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import { can } from '@/data/access';
import { getActiveContext } from '@/data/session';
import { requireSupabaseClient } from '@/data/supabase-client';

type Finding = {
  finding_key: string;
  subject_user_id?: string | null;
  subject_label: string;
  finding_type: string;
  severity: string;
  detail: string;
};

export default function SegregationAuditScreen() {
  const i = useSafeAreaInsets();

  const [rows,setRows] = useState<Finding[]>([]);
  const [loading,setLoading] = useState(false);
  const [reviewing,setReviewing] = useState(false);
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
        'segregation_duty_findings',
        {
          p_tenant_id:ctx.tenantId,
        }
      );

      if (error) throw new Error(error.message);

      setRows((data ?? []) as Finding[]);
    } catch(e:any) {
      setMessage(
        e.message ?? 'Unable to load segregation findings'
      );
    } finally {
      setLoading(false);
    }
  },[]);

  useEffect(() => {
    void load();
  },[load]);

  async function recordReview() {
    setReviewing(true);
    setMessage('');

    try {
      const ctx = await getActiveContext();

      if (!ctx) throw new Error('Authentication required');

      const client = requireSupabaseClient();

      const { data,error } = await client.rpc(
        'record_segregation_control_review',
        {
          p_tenant_id:ctx.tenantId,
        }
      );

      if (error) throw new Error(error.message);

      const count = Number(data ?? rows.length);

      setMessage(
        count === 0
          ? 'Segregation control review recorded: no active findings.'
          : `Segregation control review recorded with ${count} active finding(s).`
      );

      await load();
    } catch(e:any) {
      setMessage(
        e.message ?? 'Unable to record segregation review'
      );
    } finally {
      setReviewing(false);
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
          Segregation of Duties & Conflict Control
        </Text>

        <Text className="text-subhead text-muted-foreground mt-2 mb-5">
          Detect incompatible tenant roles and unresolved jury conflict states before authority overlaps.
        </Text>

        <View className="rounded-2xl border border-primary bg-card p-4 mb-5">
          <Text className="text-headline font-semibold text-primary">
            Database-enforced control
          </Text>

          <Text className="text-footnote text-muted-foreground mt-1">
            New incompatible manager, juror and creator role combinations are blocked at the membership database boundary.
          </Text>
        </View>

        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-headline font-semibold text-foreground">
            Live Findings
          </Text>

          <Pressable onPress={() => void load()} className="p-2">
            <RefreshCw color={THEME.accent} size={18}/>
          </Pressable>
        </View>

        {loading && rows.length === 0 ? (
          <ActivityIndicator color={THEME.accent}/>
        ) : null}

        {!loading && rows.length === 0 ? (
          <View className="rounded-2xl border border-border bg-card p-4">
            <View className="flex-row items-center gap-3">
              <ShieldCheck color={THEME.accent} size={21}/>

              <View className="flex-1">
                <Text className="text-headline font-semibold text-card-foreground">
                  No active segregation findings
                </Text>

                <Text className="text-footnote text-muted-foreground mt-1">
                  No incompatible tenant-role combinations or unresolved linked jury conflicts were detected.
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <View className="gap-3">
          {rows.map(row => (
            <View
              key={row.finding_key}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <View className="flex-row items-center gap-3">
                <ShieldAlert color={THEME.accent} size={20}/>

                <View className="flex-1">
                  <Text className="text-headline font-semibold text-card-foreground">
                    {row.subject_label}
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-1">
                    {row.finding_type}
                    {' · '}
                    {row.severity}
                  </Text>
                </View>
              </View>

              <Text className="text-footnote text-muted-foreground mt-3">
                {row.detail}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          disabled={reviewing}
          onPress={() => void recordReview()}
          className="rounded-xl border border-primary px-4 py-3 mt-5 self-start"
        >
          <Text className="text-footnote font-semibold text-primary">
            RECORD CONTROL REVIEW
          </Text>
        </Pressable>

        {message ? (
          <View className="rounded-xl border border-border bg-card p-3 mt-4">
            <Text className="text-footnote text-muted-foreground">
              {message}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
