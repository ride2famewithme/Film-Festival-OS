import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Users,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import {
  can,
  type Permission,
  type PlatformRole,
} from '@/data/access';
import { getActiveContext } from '@/data/session';
import { requireSupabaseClient } from '@/data/supabase-client';

const ROLES: PlatformRole[] = [
  'platform_admin',
  'festival_owner',
  'festival_staff',
  'juror',
  'creator',
  'sponsor_partner',
];

const PERMISSIONS: Permission[] = [
  'tenant.read',
  'tenant.manage',
  'festival.manage',
  'submission.manage',
  'jury.review',
  'jury.manage',
  'project.manage',
  'risk.manage',
  'audit.read',
  'people.manage',
  'moderation.manage',
  'finance.manage',
  'support.manage',
  'health.manage',
  'platform.configure',
];

const ROLE_META: Record<
  PlatformRole,
  {
    title: string;
    authority: string;
    description: string;
    segregation: string;
  }
> = {
  platform_admin: {
    title: 'Platform Admin',
    authority: 'GLOBAL / HIGHEST',
    description:
      'Global HQ platform administration and high-authority operational control.',
    segregation:
      'Cannot be combined in the same tenant with juror or creator access.',
  },

  festival_owner: {
    title: 'Festival Owner / Operator',
    authority: 'TENANT OWNER',
    description:
      'Festival or operator-level management authority inside the active tenant.',
    segregation:
      'Cannot be combined in the same tenant with juror or creator access.',
  },

  festival_staff: {
    title: 'Festival Staff',
    authority: 'OPERATIONAL',
    description:
      'Day-to-day festival operations without owner or platform-level authority.',
    segregation:
      'Cannot be combined in the same tenant with juror or creator access.',
  },

  juror: {
    title: 'Juror',
    authority: 'RESTRICTED JUDGING',
    description:
      'Judging access only, separated from festival management and creator authority.',
    segregation:
      'Cannot be combined in the same tenant with manager/staff or creator access.',
  },

  creator: {
    title: 'Creator',
    authority: 'CREATOR / PROJECT',
    description:
      'Creator-facing tenant and project access without competition-management authority.',
    segregation:
      'Cannot be combined in the same tenant with manager/staff or juror access.',
  },

  sponsor_partner: {
    title: 'Sponsor / Partner',
    authority: 'LIMITED',
    description:
      'Limited partner access. Jury participation is governed separately by jury controls.',
    segregation:
      'No Block 038 membership-role incompatibility is currently applied to this role.',
  },
};

type Counts = {
  total: number;
  active: number;
  invited: number;
  suspended: number;
  other: number;
};

function emptyCounts(): Counts {
  return {
    total: 0,
    active: 0,
    invited: 0,
    suspended: 0,
    other: 0,
  };
}

function prettyPermission(p: Permission): string {
  return p
    .split('.')
    .map(part =>
      part
        .split('_')
        .map(word =>
          word.length
            ? word.charAt(0).toUpperCase() + word.slice(1)
            : word
        )
        .join(' ')
    )
    .join(' · ');
}

export default function RoleCatalogueScreen() {
  const insets = useSafeAreaInsets();

  const [activeRole,setActiveRole] =
    useState<PlatformRole | null>(null);

  const [tenantId,setTenantId] =
    useState('');

  const [tenantName,setTenantName] =
    useState('');

  const [counts,setCounts] =
    useState<Record<PlatformRole,Counts>>(() =>
      Object.fromEntries(
        ROLES.map(role => [role,emptyCounts()])
      ) as Record<PlatformRole,Counts>
    );

  const [unknownRoles,setUnknownRoles] =
    useState<string[]>([]);

  const [loading,setLoading] =
    useState(false);

  const [message,setMessage] =
    useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const ctx = await getActiveContext();

      if (!ctx) {
        throw new Error('Authentication required');
      }

      if (!can(ctx.role,'people.manage')) {
        throw new Error(
          'Permission denied: role catalogue governance access required.'
        );
      }

      setActiveRole(ctx.role);
      setTenantId(ctx.tenantId);

      const client = requireSupabaseClient();

      const tenantResult = await client
        .from('tenants')
        .select('name')
        .eq('id',ctx.tenantId)
        .limit(1);

      if (!tenantResult.error) {
        setTenantName(
          String(
            tenantResult.data?.[0]?.name ??
            ctx.tenantId
          )
        );
      } else {
        setTenantName(ctx.tenantId);
      }

      const { data,error } = await client.rpc(
        'people_register',
        {
          p_tenant_id:ctx.tenantId,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const next = Object.fromEntries(
        ROLES.map(role => [role,emptyCounts()])
      ) as Record<PlatformRole,Counts>;

      const unknown = new Set<string>();

      for (const row of data ?? []) {
        const role = String(row.role ?? '');
        const status = String(row.status ?? '');

        if (!ROLES.includes(role as PlatformRole)) {
          if (role) unknown.add(role);
          continue;
        }

        const bucket = next[role as PlatformRole];

        bucket.total += 1;

        if (status === 'active') {
          bucket.active += 1;
        } else if (status === 'invited') {
          bucket.invited += 1;
        } else if (status === 'suspended') {
          bucket.suspended += 1;
        } else {
          bucket.other += 1;
        }
      }

      setCounts(next);
      setUnknownRoles([...unknown].sort());
    } catch(e:any) {
      setMessage(
        e.message ?? 'Unable to load role catalogue'
      );
    } finally {
      setLoading(false);
    }
  },[]);

  useEffect(() => {
    void load();
  },[load]);

  const rows = useMemo(
    () =>
      ROLES.map(role => ({
        role,
        meta:ROLE_META[role],
        permissions:PERMISSIONS.filter(
          permission => can(role,permission)
        ),
        counts:counts[role],
      })),
    [counts]
  );

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingTop:insets.top+12,
          paddingBottom:insets.bottom+48,
          paddingHorizontal:20,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to Access and Role Governance"
          onPress={() =>
            router.replace('/access-governance')
          }
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft
            color={THEME.accent}
            size={19}
          />
        </Pressable>

        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
          ROLE GOVERNANCE
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          Role Catalogue & Permission Matrix
        </Text>

        <Text className="text-subhead text-muted-foreground mt-2">
          Read-only view of implemented Film Festival OS™ roles,
          application permissions and live tenant membership counts.
        </Text>

        <View className="rounded-2xl border border-primary bg-card p-4 mt-5">
          <View className="flex-row items-center gap-3">
            <ShieldCheck
              color={THEME.accent}
              size={21}
            />

            <View className="flex-1">
              <Text className="text-headline font-semibold text-primary">
                Read-only by design
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                This screen does not modify permissions. The client permission
                map improves application behaviour; Supabase RLS remains the
                production data-security boundary.
              </Text>
            </View>
          </View>
        </View>

        <View className="rounded-2xl border border-border bg-card p-4 mt-4">
          <Text className="text-footnote text-muted-foreground">
            Active tenant
          </Text>

          <Text className="text-body font-semibold text-card-foreground mt-1">
            {tenantName || tenantId || 'Loading…'}
          </Text>

          {tenantId ? (
            <Text className="text-caption text-muted-foreground mt-1">
              Tenant ID: {tenantId}
            </Text>
          ) : null}

          <Text className="text-footnote text-muted-foreground mt-3">
            Your active role
          </Text>

          <Text className="text-body font-semibold text-primary mt-1">
            {activeRole
              ? ROLE_META[activeRole].title
              : 'Loading…'}
          </Text>
        </View>

        <View className="flex-row justify-between items-center mt-6 mb-3">
          <View className="flex-row items-center gap-2">
            <Users
              color={THEME.accent}
              size={20}
            />

            <Text className="text-headline font-semibold text-foreground">
              Implemented Roles
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh role catalogue"
            onPress={() => void load()}
            className="p-2"
          >
            <RefreshCw
              color={THEME.accent}
              size={18}
            />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator
            color={THEME.accent}
          />
        ) : null}

        <View className="gap-4 mt-2">
          {rows.map(row => (
            <View
              key={row.role}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <View className="flex-row justify-between gap-3">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-headline font-semibold text-card-foreground">
                      {row.meta.title}
                    </Text>

                    {activeRole === row.role ? (
                      <Text className="text-caption font-bold text-primary">
                        YOUR ACTIVE ROLE
                      </Text>
                    ) : null}
                  </View>

                  <Text className="text-caption font-bold text-primary mt-1">
                    {row.meta.authority}
                  </Text>
                </View>

                <Text className="text-footnote font-semibold text-primary">
                  {row.permissions.length} permissions
                </Text>
              </View>

              <Text className="text-footnote text-muted-foreground mt-3">
                {row.meta.description}
              </Text>

              <View className="rounded-xl border border-border bg-background p-3 mt-3">
                <Text className="text-footnote font-semibold text-foreground">
                  Live tenant memberships
                </Text>

                <Text className="text-footnote text-muted-foreground mt-1">
                  Total {row.counts.total}
                  {' · '}
                  Active {row.counts.active}
                  {' · '}
                  Invited {row.counts.invited}
                  {' · '}
                  Suspended {row.counts.suspended}
                  {row.counts.other
                    ? ` · Other ${row.counts.other}`
                    : ''}
                </Text>
              </View>

              <Text className="text-footnote font-semibold text-foreground mt-4">
                Application permissions
              </Text>

              <View className="gap-2 mt-2">
                {row.permissions.map(permission => (
                  <View
                    key={permission}
                    className="rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <Text className="text-footnote text-card-foreground">
                      {prettyPermission(permission)}
                    </Text>

                    <Text className="text-caption text-muted-foreground mt-1">
                      {permission}
                    </Text>
                  </View>
                ))}
              </View>

              <View className="rounded-xl border border-border bg-background p-3 mt-4">
                <Text className="text-footnote font-semibold text-foreground">
                  Segregation rule
                </Text>

                <Text className="text-footnote text-muted-foreground mt-1">
                  {row.meta.segregation}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {unknownRoles.length ? (
          <View className="rounded-2xl border border-border bg-card p-4 mt-5">
            <Text className="text-headline font-semibold text-foreground">
              Unknown membership role detected
            </Text>

            <Text className="text-footnote text-muted-foreground mt-2">
              {unknownRoles.join(', ')}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-2">
              Review before changing the permission catalogue.
            </Text>
          </View>
        ) : null}

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
