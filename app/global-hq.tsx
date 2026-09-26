import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Building2,
  Clapperboard,
  FolderKanban,
  Gauge,
  Globe2,
  KeyRound,
  ServerCog,
  ShieldCheck,
  Users,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '@/components/BrandLogo';
import { THEME } from '@/constants/theme';
import { getOperationalSnapshot, listHqTenants } from '@/data/workflows/operations-hq';
import { getActiveContext, listActiveMemberships, setActiveTenant } from '@/data/session';

type Snapshot = {
  submissions?: number;
  submissionsPending?: number;
  juryAssigned?: number;
  juryCompleted?: number;
  notificationsQueued?: number;
  paymentsPending?: number;
  awardsDraft?: number;
  projectsActive?: number;
  tasksOpen?: number;
  risksOpen?: number;
};

type WorkspaceOption = {
  tenantId: string;
  role: string;
  name: string;
};

const value = (n?: number) => (typeof n === 'number' ? String(n) : '—');

export default function GlobalHqScreen() {
  const insets = useSafeAreaInsets();
  const [snapshot, setSnapshot] = useState<Snapshot>({});
  const [tenantCount, setTenantCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [activeTenantName, setActiveTenantName] = useState<string | null>(null);
  const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceOption[]>([]);
  const [switchingTenantId, setSwitchingTenantId] = useState<string | null>(null);
  const masterPulse = useRef(new Animated.Value(0.35)).current;
  const [hqAccess, setHqAccess] =
    useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const context = await getActiveContext();
        if (!active) return;

        if (!context) {
          setHqAccess('denied');
          router.replace('/login');
          return;
        }

        if (context.role !== 'platform_admin') {
          setHqAccess('denied');
          router.replace('/dashboard');
          return;
        }

        setHqAccess('allowed');
      } catch {
        if (active) {
          setHqAccess('denied');
          router.replace('/login');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    setMessage('');

    const [opsResult, tenantsResult, contextResult, membershipsResult] =
      await Promise.allSettled([
        getOperationalSnapshot(),
        listHqTenants(),
        getActiveContext(),
        listActiveMemberships(),
      ]);

    const context =
      contextResult.status === 'fulfilled' ? contextResult.value : null;

    setActiveEmail(context?.email ?? null);
    setActiveRole(context?.role ?? null);
    setActiveTenantId(context?.tenantId ?? null);

    if (opsResult.status === 'fulfilled') {
      setSnapshot(opsResult.value);
    } else {
      setMessage(opsResult.reason?.message ?? 'Operational data could not be loaded.');
    }

    if (tenantsResult.status === 'fulfilled') {
      const tenants = tenantsResult.value as any[];
      setTenantCount(tenants.length);

      const activeTenant = context
        ? tenants.find((tenant: any) => String(tenant.id) === context.tenantId)
        : null;

      setActiveTenantName(
        activeTenant?.name ? String(activeTenant.name) : null
      );
    } else {
      setTenantCount(null);
      setActiveTenantName(null);
      if (!message) setMessage(tenantsResult.reason?.message ?? 'HQ tenant data could not be loaded.');
    }

    if (membershipsResult.status === 'fulfilled') {
      const memberships = membershipsResult.value as any[];
      const tenants =
        tenantsResult.status === 'fulfilled'
          ? (tenantsResult.value as any[])
          : [];

      setWorkspaceOptions(
        memberships.map((membership: any) => {
          const tenantId = String(membership.tenant_id);
          const tenant = tenants.find(
            (item: any) => String(item.id) === tenantId
          );

          return {
            tenantId,
            role: String(membership.role),
            name: tenant?.name ? String(tenant.name) : tenantId,
          };
        })
      );
    } else {
      setWorkspaceOptions([]);
      setMessage((current) => current || (membershipsResult.reason?.message ?? 'Workspace memberships could not be loaded.'));
    }

    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (hqAccess !== 'allowed') return;

    void load();

    const retry = setTimeout(() => {
      void load();
    }, 750);

    return () => clearTimeout(retry);
  }, [hqAccess, load]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(masterPulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(masterPulse, {
          toValue: 0.35,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [masterPulse]);

  const switchWorkspace = useCallback(
    async (workspace: WorkspaceOption) => {
      if (workspace.tenantId === activeTenantId) return;

      setSwitchingTenantId(workspace.tenantId);
      setMessage('');

      try {
        await setActiveTenant(workspace.tenantId);

        if (workspace.role === 'platform_admin') {
          await load();
        } else {
          router.replace('/dashboard');
        }
      } catch (error: any) {
        setMessage(error?.message ?? 'Workspace could not be changed.');
      } finally {
        setSwitchingTenantId(null);
      }
    },
    [activeTenantId, load]
  );

  const statCards = [
    { label: 'Network tenants', value: tenantCount === null ? '—' : String(tenantCount) },
    { label: 'Submissions', value: value(snapshot.submissions) },
    { label: 'Pending decisions', value: value(snapshot.submissionsPending) },
    { label: 'Jury assigned', value: value(snapshot.juryAssigned) },
    { label: 'Jury completed', value: value(snapshot.juryCompleted) },
    { label: 'Payments pending', value: value(snapshot.paymentsPending) },
    { label: 'Awards draft', value: value(snapshot.awardsDraft) },
    { label: 'Open risks', value: value(snapshot.risksOpen) },
  ];

  const modules = [
    { title: 'Security Centre', subtitle: 'MFA, GitHub login and Platform Admin protection', icon: ShieldCheck, route: '/security-centre' },
    { title: 'Global Network', subtitle: 'Country, regional, continental and Global Pool structure', icon: Globe2, route: '/network' },
    { title: 'People & Roles', subtitle: 'Platform admins, festival staff and role assignments', icon: Users, route: '/people' },
    { title: 'Jury Management', subtitle: 'Private jury panel, scoring, weighting, integrity and recusal controls', icon: Gauge, route: '/jury' },
    { title: 'Project Management™', subtitle: 'Projects, tasks, KPIs, risks and delivery', icon: FolderKanban, route: '/project-management' },
    { title: 'Risk, Compliance & Resilience', subtitle: 'Risk, incidents, continuity, obligations and controls', icon: ShieldCheck, route: '/risk' },
    { title: 'Control Library™', subtitle: 'Governance controls, ownership, review status and assurance evidence', icon: ShieldCheck, route: '/control-library' },
    { title: 'Reports & Exports', subtitle: 'Operational reporting, jury progress and controlled exports', icon: BarChart3, route: '/reports' },
    { title: 'AI Next Actions', subtitle: 'Priorities, blockers, management briefs and follow-up', icon: BrainCircuit, route: '/pm-ai-actions' },
    { title: 'System Health', subtitle: 'Operational readiness, integrations and diagnostics', icon: ServerCog, route: '/admin-health' },
  ];

  if (hqAccess !== 'allowed') {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-body text-muted-foreground">
          {hqAccess === 'checking'
            ? 'Verifying Global HQ access…'
            : 'Global HQ requires an authorised Platform Admin workspace.'}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={THEME.accent} />}
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: insets.bottom + 48,
          paddingHorizontal: 20,
        }}
      >
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-row items-center gap-3 flex-1">
            <BrandLogo size={58} radius={18} />
            <View className="flex-1">
              <Text className="text-caption font-bold uppercase tracking-widest text-primary">FILM FESTIVAL OS™</Text>
              <Text className="text-title1 font-bold text-foreground mt-1">Global HQ</Text>
              <Text className="text-footnote text-muted-foreground mt-1">Platform Administration · Global Network Control</Text>
            </View>
          </View>

          <View className="rounded-full border border-border bg-card px-3 py-2">
            <Text className="text-caption font-bold text-primary">
              {activeRole
                ? activeRole.replace(/_/g, ' ').toUpperCase()
                : 'NO ACTIVE ROLE'}
            </Text>
          </View>
        </View>

        {/* HQ QUICK ACCESS — PLATFORM ADMIN ONLY */}
        {activeRole === 'platform_admin' ? (
          <View className="flex-row flex-wrap gap-3 mb-6">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open People and Roles"
              onPress={() => router.push('/people')}
              style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}
              className="flex-1 min-w-[260px] min-h-[72px] rounded-2xl bg-primary px-5 py-4 flex-row items-center justify-between gap-3"
            >
              <View className="flex-row items-center gap-3 flex-1">
                <Users size={25} color={THEME.accentFg} />
                <View className="flex-1">
                  <Text className="text-headline font-bold text-primary-foreground">
                    People & Roles
                  </Text>
                  <Text className="text-footnote text-primary-foreground">
                    Staff, memberships and access
                  </Text>
                </View>
              </View>
              <ArrowRight size={20} color={THEME.accentFg} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Platform Administration"
              onPress={() => router.push('/admin')}
              style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}
              className="flex-1 min-w-[260px] min-h-[72px] rounded-2xl border border-primary bg-card px-5 py-4 flex-row items-center justify-between gap-3"
            >
              <View className="flex-row items-center gap-3 flex-1">
                <ShieldCheck size={25} color={THEME.accent} />
                <View className="flex-1">
                  <Text className="text-headline font-bold text-card-foreground">
                    Platform Administration
                  </Text>
                  <Text className="text-footnote text-muted-foreground">
                    Global HQ administration
                  </Text>
                </View>
              </View>
              <ArrowRight size={20} color={THEME.accent} />
            </Pressable>
          </View>
        ) : null}

        <View className="rounded-3xl border border-border bg-card p-5 mb-6">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1">
              <Text className="text-caption font-bold uppercase tracking-widest text-primary">EXECUTIVE CONTROL CENTRE</Text>
              <Text className="text-title2 font-bold text-card-foreground mt-2">{`${
  new Date().getHours() < 12
    ? 'Good morning'
    : new Date().getHours() < 18
      ? 'Good afternoon'
      : 'Good evening'
}, Alex`}</Text>
              <Text className="text-body text-muted-foreground mt-2">
                One view across the Film Festival OS™ network, live operations, governance and delivery.
              </Text>

            {/* AUTHENTICATED CONTEXT */}
            <View className="flex-row flex-wrap gap-2 mt-4">
              <View className="rounded-xl border border-border bg-background px-3 py-2">
                <Text className="text-caption font-bold text-muted-foreground">
                  SIGNED IN
                </Text>
                <Text className="text-footnote text-foreground mt-1">
                  {activeEmail ?? '—'}
                </Text>
              </View>

              <View className="rounded-xl border border-border bg-background px-3 py-2">
                <Text className="text-caption font-bold text-muted-foreground">
                  ROLE
                </Text>
                <Text className="text-footnote text-foreground mt-1">
                  {activeRole
                    ? activeRole.replace(/_/g, ' ').toUpperCase()
                    : '—'}
                </Text>
              </View>

              <View className="rounded-xl border border-border bg-background px-3 py-2">
                <Text className="text-caption font-bold text-muted-foreground">
                  ACTIVE TENANT
                </Text>
                <Text className="text-footnote text-foreground mt-1">
                  {activeTenantName ?? activeTenantId ?? '—'}
                </Text>
                {activeTenantName && activeTenantId ? (
                  <Text className="text-caption text-muted-foreground mt-1">
                    {activeTenantId}
                  </Text>
                ) : null}
              </View>
            </View>
            </View>
            <Building2 size={28} color={THEME.accent} />
          </View>

          
            <View className="rounded-xl border border-border bg-background px-3 py-3 mt-3">
              <Text className="text-caption font-bold text-muted-foreground">
                WORKSPACE ACCESS
              </Text>

              <Text className="text-footnote text-foreground mt-1">
                {workspaceOptions.length === 0
                  ? 'No active workspace memberships found.'
                  : workspaceOptions.length === 1
                    ? '1 active workspace — no switch required.'
                    : workspaceOptions.length + ' active workspaces — choose a workspace:'}
              </Text>

              {workspaceOptions.length > 1 ? (
                <View className="flex-row flex-wrap gap-2 mt-3">
                  {workspaceOptions.map((workspace) => (
                    <Pressable
                      key={workspace.tenantId}
                      accessibilityRole="button"
                      accessibilityLabel={'Switch to ' + workspace.name}
                      disabled={
                        switchingTenantId !== null ||
                        workspace.tenantId === activeTenantId
                      }
                      onPress={() => switchWorkspace(workspace)}
                      style={{
                        opacity:
                          workspace.tenantId === activeTenantId ? 0.65 : 1,
                      }}
                      className="rounded-xl border border-border px-3 py-2"
                    >
                      <Text className="text-footnote font-bold text-foreground">
                        {workspace.name}
                        {workspace.tenantId === activeTenantId
                          ? ' • ACTIVE'
                          : ''}
                      </Text>
                      <Text className="text-caption text-muted-foreground mt-1">
                        {workspace.role.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <View className="flex-row gap-3 mt-5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open festival workspace"
              onPress={() => router.push('/(tabs)/dashboard')}
              style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
              className="flex-1 min-h-12 rounded-xl bg-primary flex-row items-center justify-center gap-2 px-3"
            >
              <Clapperboard size={17} color={THEME.accentFg} />
              <Text className="text-footnote font-bold text-primary-foreground">Festival Workspace</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open live operations dashboard"
              onPress={() => router.push('/operations-dashboard')}
              style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
              className="flex-1 min-h-12 rounded-xl border border-border bg-background flex-row items-center justify-center gap-2 px-3"
            >
              <Gauge size={17} color={THEME.accent} />
              <Text className="text-footnote font-bold text-foreground">Live Operations</Text>
            </Pressable>
          </View>
        </View>

        {activeRole === 'platform_admin' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Global Master Key"
            onPress={() => router.push('/global-hq/master-control')}
            style={({ pressed }) => ({
              opacity: pressed ? 0.78 : 1,
              overflow: 'hidden',
            })}
            className="rounded-3xl border border-primary bg-card p-5 mb-6"
          >
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 170,
                height: 170,
                borderRadius: 85,
                borderWidth: 2,
                borderColor: '#16f28b',
                opacity: masterPulse,
                right: -32,
                top: -54,
              }}
            />

            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 108,
                height: 108,
                borderRadius: 54,
                borderWidth: 1,
                borderColor: '#16f28b',
                opacity: masterPulse,
                right: -1,
                top: -23,
              }}
            />

            <View className="flex-row items-center gap-4">
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  borderWidth: 1,
                  borderColor: '#16f28b',
                  backgroundColor: '#03140d',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <KeyRound size={28} color="#27f59a" />
              </View>

              <View className="flex-1">
                <Text className="text-caption font-bold uppercase tracking-widest text-primary">
                  SCHILLER™ SECURED ACCESS
                </Text>

                <Text className="text-title3 font-bold text-card-foreground mt-1">
                  GLOBAL MASTER KEY™
                </Text>

                <Text className="text-footnote text-muted-foreground mt-1">
                  Password + MFA protected global platform authority
                </Text>
              </View>

              <ArrowRight size={20} color={THEME.accent} />
            </View>
          </Pressable>
        ) : null}

        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-title3 font-semibold text-foreground">Network snapshot</Text>
          <Text className="text-caption text-muted-foreground">Pull down to refresh</Text>
        </View>

        <View className="flex-row flex-wrap justify-between mb-5">
          {statCards.map((item) => (
            <View key={item.label} className="w-[48.5%] rounded-2xl border border-border bg-card p-4 mb-3">
              <Text className="text-title1 font-bold text-card-foreground">{item.value}</Text>
              <Text className="text-footnote text-muted-foreground mt-1">{item.label}</Text>
            </View>
          ))}
        </View>

        {message ? (
          <View className="rounded-2xl border border-border bg-card px-4 py-3 mb-5">
            <Text className="text-footnote text-muted-foreground">{message}</Text>
          </View>
        ) : null}

        <Text className="text-title3 font-semibold text-foreground mb-3">HQ management centres</Text>

        <View className="gap-3">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Pressable
                key={module.title}
                onPress={() => module.route ? router.push(module.route as never) : undefined}
                style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}
                className="rounded-2xl border border-border bg-card p-4 flex-row items-center gap-4"
              >
                <View className="w-11 h-11 rounded-xl bg-background border border-border items-center justify-center">
                  <Icon size={20} color={THEME.accent} />
                </View>
                <View className="flex-1">
                  <Text className="text-headline font-semibold text-card-foreground">{module.title}</Text>
                  <Text className="text-footnote text-muted-foreground mt-1">{module.subtitle}</Text>
                </View>
                <ArrowRight size={18} color={THEME.muted} />
              </Pressable>
            );
          })}
        </View>

        <View className="rounded-2xl border border-border bg-card p-4 mt-6">
          <Text className="text-caption font-bold uppercase tracking-widest text-primary">HQ STATUS</Text>
          <Text className="text-footnote text-muted-foreground mt-2">
            Platform Admin routing is active. Existing festival/juror workspace is preserved as a separate operating layer.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
