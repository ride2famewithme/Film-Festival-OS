import { type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react-native';

import { getActiveContext, listActiveMemberships } from '@/data/session';
import {
  getGlobalPlatformState,
  type GlobalPlatformState,
} from '@/data/workflows/global-platform-state';

export function GlobalPlatformGate({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  const [state, setState] =
    useState<GlobalPlatformState | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [hasPlatformAdminAccess, setHasPlatformAdminAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    const [stateResult, contextResult, membershipsResult] =
      await Promise.allSettled([
        getGlobalPlatformState(),
        getActiveContext(),
        listActiveMemberships(),
      ]);

    if (stateResult.status === 'fulfilled') {
      setState(stateResult.value.state);
    } else {
      setState(null);
      setError(
        stateResult.reason?.message ??
          'GLOBAL PLATFORM STATE could not be verified.'
      );
    }

    if (contextResult.status === 'fulfilled') {
      setRole(contextResult.value?.role ?? null);
    } else {
      setRole(null);
    }

    if (membershipsResult.status === 'fulfilled') {
      setHasPlatformAdminAccess(
        (membershipsResult.value ?? []).some(
          (membership: any) =>
            String(membership.role) === 'platform_admin'
        )
      );
    } else {
      setHasPlatformAdminAccess(false);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  const platformAdmin = role === 'platform_admin';
  const recoveryAdmin =
    platformAdmin || hasPlatformAdminAccess;

  const loginRoute =
    pathname === '/login' ||
    pathname.startsWith('/login/');

  const recoveryRoute =
    pathname === '/global-hq' ||
    pathname.startsWith('/global-hq/master-control') ||
    pathname === '/security-centre';

  if (loginRoute) return <>{children}</>;

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#050807',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <ActivityIndicator size="large" color="#27f59a" />
        <Text
          style={{
            color: '#8fa39a',
            marginTop: 14,
            fontWeight: '700',
          }}
        >
          Verifying GLOBAL PLATFORM STATE™…
        </Text>
      </View>
    );
  }

  if (error && !(recoveryAdmin && recoveryRoute)) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#050807',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 28,
        }}
      >
        <ShieldCheck size={46} color="#f5b942" />

        <Text
          style={{
            color: '#ffffff',
            fontSize: 24,
            fontWeight: '900',
            marginTop: 18,
            textAlign: 'center',
          }}
        >
          PLATFORM CONTROL STATE UNAVAILABLE
        </Text>

        <Text
          style={{
            color: '#9baaa3',
            marginTop: 10,
            textAlign: 'center',
            maxWidth: 520,
          }}
        >
          FFOS operational access is temporarily held until the
          Global Platform State can be verified.
        </Text>

        <Pressable
          onPress={() => void load()}
          style={{
            marginTop: 22,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 12,
            backgroundColor: '#146b45',
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <RefreshCw size={17} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontWeight: '900' }}>
            RETRY
          </Text>
        </Pressable>
      </View>
    );
  }

  if (
    (state === 'suspended' || state === 'retired') &&
    !(recoveryAdmin && recoveryRoute)
  ) {
    const retired = state === 'retired';

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#050807',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 28,
        }}
      >
        <LockKeyhole size={58} color="#27f59a" />

        <Text
          style={{
            color: '#63f5ad',
            fontSize: 12,
            fontWeight: '900',
            letterSpacing: 2,
            marginTop: 20,
          }}
        >
          GLOBAL MASTER KEY™
        </Text>

        <Text
          style={{
            color: '#ffffff',
            fontSize: 30,
            fontWeight: '900',
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          FFOS {retired ? 'RETIRED' : 'SUSPENDED'}
        </Text>

        <Text
          style={{
            color: '#9baaa3',
            marginTop: 12,
            textAlign: 'center',
            maxWidth: 560,
            lineHeight: 21,
          }}
        >
          {retired
            ? 'Operational access has been retired by Global Master. Historical records remain preserved.'
            : 'Operational access has been suspended by Global Master. Data and historical records remain preserved.'}
        </Text>

        {recoveryAdmin ? (
          <Pressable
            onPress={() =>
              router.replace(
                platformAdmin
                  ? '/global-hq/master-control'
                  : '/global-hq'
              )
            }
            style={{
              marginTop: 24,
              paddingVertical: 13,
              paddingHorizontal: 22,
              borderRadius: 12,
              backgroundColor: '#146b45',
            }}
          >
            <Text
              style={{
                color: '#ffffff',
                fontWeight: '900',
              }}
            >
              {platformAdmin
                ? 'OPEN GLOBAL MASTER CONTROL'
                : 'OPEN GLOBAL HQ RECOVERY'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (state === 'restricted') {
    return (
      <View style={{ flex: 1 }}>
        <View
          style={{
            backgroundColor: '#4a3510',
            paddingVertical: 8,
            paddingHorizontal: 14,
          }}
        >
          <Text
            style={{
              color: '#ffe7a3',
              textAlign: 'center',
              fontWeight: '900',
              fontSize: 12,
            }}
          >
            GLOBAL PLATFORM STATE™ — RESTRICTED OPERATION
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          {children}
        </View>
      </View>
    );
  }

  return <>{children}</>;
}
