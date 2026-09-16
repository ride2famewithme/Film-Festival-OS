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
  ShieldAlert,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import { getActiveContext } from '@/data/session';
import { can } from '@/data/access';
import { requireSupabaseClient } from '@/data/supabase-client';

type Row = {
  id: string;
  user_id?: string;
  email?: string;
  role?: string;
  status?: string;
  tenant_name?: string;
};

export default function EmergencyAccessScreen() {
  const i = useSafeAreaInsets();

  const [rows,setRows] = useState<Row[]>([]);
  const [ctx,setCtx] = useState<any>(null);
  const [busy,setBusy] = useState(false);
  const [armedId,setArmedId] = useState<string | null>(null);
  const [message,setMessage] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setMessage('');

    try {
      const context = await getActiveContext();

      if (!context) throw new Error('Authentication required');
      if (!can(context.role,'people.manage')) {
        throw new Error('Permission denied');
      }

      setCtx(context);

      const client = requireSupabaseClient();

      const { data,error } = await client.rpc('people_register',{
        p_tenant_id:context.tenantId,
      });

      if (error) throw new Error(error.message);

      setRows((data ?? []) as Row[]);
      setArmedId(null);

    } catch(e:any) {
      setMessage(e.message ?? 'Unable to load memberships');
    } finally {
      setBusy(false);
    }
  },[]);

  useEffect(() => {
    void load();
  },[load]);

  function protectedRow(row:Row) {
    if (
      row.user_id === ctx?.userId &&
      row.role === 'platform_admin'
    ) return true;

    if (
      ctx?.role === 'festival_owner' &&
      ['platform_admin','festival_owner'].includes(String(row.role))
    ) return true;

    return false;
  }

  async function apply(row:Row) {
    const next =
      row.status === 'suspended'
        ? 'active'
        : 'suspended';

    setBusy(true);
    setMessage('');

    try {
      const client = requireSupabaseClient();

      const { error } = await client.rpc(
        'set_membership_emergency_status',
        {
          p_membership_id:row.id,
          p_status:next,
        }
      );

      if (error) throw new Error(error.message);

      setMessage(
        next === 'suspended'
          ? 'Access suspended and audit event recorded.'
          : 'Access reactivated and audit event recorded.'
      );

      setArmedId(null);
      await load();

    } catch(e:any) {
      setMessage(e.message ?? 'Emergency control failed');
      setBusy(false);
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
          Emergency Access Controls
        </Text>

        <Text className="text-subhead text-muted-foreground mt-2 mb-5">
          Suspend compromised membership access while preserving a traceable audit record.
        </Text>

        <View className="rounded-2xl border border-primary bg-card p-4 mb-5">
          <Text className="text-headline font-semibold text-primary">
            Two-click safety control
          </Text>
          <Text className="text-footnote text-muted-foreground mt-1">
            The first click arms the action. The second confirms it. Protected administrator accounts cannot be accidentally suspended.
          </Text>
        </View>

        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-headline font-semibold text-foreground">
            Membership Access
          </Text>

          <Pressable onPress={() => void load()} className="p-2">
            <RefreshCw color={THEME.accent} size={18}/>
          </Pressable>
        </View>

        {busy && rows.length === 0
          ? <ActivityIndicator color={THEME.accent}/>
          : null}

        <View className="gap-3">
          {rows.map(row => {
            const isProtected = protectedRow(row);
            const next =
              row.status === 'suspended'
                ? 'REACTIVATE'
                : 'SUSPEND';

            const armed = armedId === row.id;

            return (
              <View
                key={row.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <View className="flex-row gap-3 items-center">
                  <ShieldAlert
                    color={THEME.accent}
                    size={19}
                  />

                  <View className="flex-1">
                    <Text className="text-headline font-semibold text-card-foreground">
                      {row.email ?? row.user_id ?? 'Membership'}
                    </Text>

                    <Text className="text-footnote text-muted-foreground mt-1">
                      {String(row.role ?? 'unknown').toUpperCase()}
                      {' · '}
                      {String(row.status ?? 'unknown').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {isProtected ? (
                  <Text className="text-footnote text-primary mt-3">
                    Protected account — emergency self-suspension blocked.
                  </Text>
                ) : (
                  <View className="flex-row gap-2 mt-3">
                    <Pressable
                      disabled={busy}
                      onPress={() => {
                        if (armed) {
                          void apply(row);
                        } else {
                          setArmedId(row.id);
                          setMessage(
                            `${next} armed. Click CONFIRM ${next} to execute.`
                          );
                        }
                      }}
                      className="rounded-lg border border-primary px-3 py-2"
                    >
                      <Text className="text-footnote font-semibold text-primary">
                        {armed ? `CONFIRM ${next}` : `${next} ACCESS`}
                      </Text>
                    </Pressable>

                    {armed ? (
                      <Pressable
                        onPress={() => {
                          setArmedId(null);
                          setMessage('Emergency action cancelled.');
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
