import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@/constants/theme';
import {
  getActiveContext,
  getActiveSeason,
  listActiveMemberships,
  setActiveTenant,
} from '@/data/session';
import { db } from '@/data/db';

type WorkspaceOption = {
  tenantId: string;
  role: string;
};

type LiveFestivalData = {
  festivalName: string | null;
  country: string | null;
  profileStatus: string | null;
  seasonLabel: string | null;
  seasonStatus: string | null;
  submissions: number;
  juryAssignments: number;
  juryReviews: number;
  notifications: number;
};

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();

  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [activeTenantName, setActiveTenantName] = useState<string | null>(null);
  const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceOption[]>([]);
  const [switchingTenantId, setSwitchingTenantId] = useState<string | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState('');
  const [liveData, setLiveData] = useState<LiveFestivalData>({
    festivalName: null,
    country: null,
    profileStatus: null,
    seasonLabel: null,
    seasonStatus: null,
    submissions: 0,
    juryAssignments: 0,
    juryReviews: 0,
    notifications: 0,
  });

  const loadWorkspaceAccess = useCallback(async () => {
    try {
      const [context, memberships] = await Promise.all([
        getActiveContext(),
        listActiveMemberships(),
      ]);

      setActiveTenantId(context?.tenantId ?? null);

      if (context?.tenantId) {
        const tenantResult = await db
          .from<any>('tenants')
          .select('*')
          .eq('id', context.tenantId)
          .limit(1);

        if (tenantResult.error) {
          throw new Error(tenantResult.error.message);
        }

        const tenant = tenantResult.data?.[0];
        setActiveTenantName(
          tenant?.name ? String(tenant.name) : context.tenantId
        );

        const activeSeason = await getActiveSeason();

        const [
          profileResult,
          seasonsResult,
          submissionsResult,
          assignmentsResult,
          reviewsResult,
          notificationsResult,
        ] = await Promise.all([
          db.from<any>('festival_profiles').select('*').eq('tenant_id', context.tenantId),
          db.from<any>('festival_seasons').select('*').eq('tenant_id', context.tenantId),
          db.from<any>('submissions').select('*').eq('tenant_id', context.tenantId),
          db.from<any>('jury_assignments').select('*').eq('tenant_id', context.tenantId),
          db.from<any>('jury_reviews').select('*').eq('tenant_id', context.tenantId),
          db.from<any>('notifications').select('*').eq('tenant_id', context.tenantId),
        ]);

        const results = [
          profileResult,
          seasonsResult,
          submissionsResult,
          assignmentsResult,
          reviewsResult,
          notificationsResult,
        ];

        const failed = results.find((result: any) => result.error);

        if (failed?.error) {
          throw new Error(failed.error.message);
        }

        const profile = profileResult.data?.[0] ?? null;
        const seasons = (seasonsResult.data ?? []) as any[];
        const currentSeason =
          activeSeason ??
          seasons[0] ??
          null;

        setLiveData({
          festivalName: profile?.festival_name
            ? String(profile.festival_name)
            : null,
          country: profile?.country ? String(profile.country) : null,
          profileStatus: profile?.status ? String(profile.status) : null,
          seasonLabel: currentSeason?.label ? String(currentSeason.label) : null,
          seasonStatus: currentSeason?.status ? String(currentSeason.status) : null,
          submissions: submissionsResult.data?.length ?? 0,
          juryAssignments: assignmentsResult.data?.length ?? 0,
          juryReviews: reviewsResult.data?.length ?? 0,
          notifications: notificationsResult.data?.length ?? 0,
        });
      } else {
        setActiveTenantName(null);
        setLiveData({
          festivalName: null,
          country: null,
          profileStatus: null,
          seasonLabel: null,
          seasonStatus: null,
          submissions: 0,
          juryAssignments: 0,
          juryReviews: 0,
          notifications: 0,
        });
      }

      setWorkspaceOptions(
        (memberships as any[]).map((membership: any) => ({
          tenantId: String(membership.tenant_id),
          role: String(membership.role),
        }))
      );

      setWorkspaceMessage('');
    } catch (error: any) {
      setWorkspaceOptions([]);
      setWorkspaceMessage(
        error?.message ?? 'Workspace access could not be loaded.'
      );
    }
  }, []);

  useEffect(() => {
    loadWorkspaceAccess();
  }, [loadWorkspaceAccess]);

  const switchWorkspace = useCallback(
    async (workspace: WorkspaceOption) => {
      if (workspace.tenantId === activeTenantId) return;

      setSwitchingTenantId(workspace.tenantId);
      setWorkspaceMessage('');

      try {
        await setActiveTenant(workspace.tenantId);
        setActiveTenantId(workspace.tenantId);

        if (workspace.role === 'platform_admin') {
          router.replace('/global-hq');
        } else {
          router.replace('/(tabs)/dashboard');
        }
      } catch (error: any) {
        setWorkspaceMessage(
          error?.message ?? 'Workspace could not be changed.'
        );
      } finally {
        setSwitchingTenantId(null);
      }
    },
    [activeTenantId]
  );

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96, paddingHorizontal: 20 }}
      >
        <View className="flex-row items-center justify-between mb-7">
          <View>
            <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
            {liveData.festivalName ?? activeTenantName ?? 'Festival Workspace'}
          </Text>
            <Text className="text-title1 font-bold text-foreground mt-1">{`${
  new Date().getHours() < 12
    ? 'Good morning'
    : new Date().getHours() < 18
      ? 'Good afternoon'
      : 'Good evening'
}, Alex`}</Text>
            <Text className="text-subhead text-muted-foreground mt-1">
            {liveData.country ? liveData.country + ' · Active Film Festival OS™ workspace' : 'Active Film Festival OS™ workspace'}
          </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open account access"
            onPress={() => router.push('/login')}
            style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
            className="w-11 h-11 rounded-full bg-card border border-border items-center justify-center"
          >
            <UserRound size={19} color={THEME.accent} />
          </Pressable>
        </View>

        {/* DASHBOARD WORKSPACE ACCESS */}
        <View className="rounded-2xl border border-border bg-card p-4 mb-5">
          <Text className="text-caption font-bold uppercase tracking-widest text-primary">
            Workspace Access
          </Text>

          <Text className="text-footnote text-muted-foreground mt-1">
            {workspaceOptions.length === 0
              ? 'No active workspace memberships found.'
              : workspaceOptions.length === 1
                ? '1 active workspace — no switch required.'
                : workspaceOptions.length +
                  ' active workspaces — choose an authorised workspace.'}
          </Text>

          {workspaceOptions.length > 1 ? (
            <View className="gap-2 mt-3">
              {workspaceOptions.map((workspace, index) => (
                <Pressable
                  key={workspace.tenantId}
                  accessibilityRole="button"
                  accessibilityLabel={
                    'Switch workspace ' + (index + 1)
                  }
                  disabled={
                    switchingTenantId !== null ||
                    workspace.tenantId === activeTenantId
                  }
                  onPress={() => switchWorkspace(workspace)}
                  style={{
                    opacity:
                      workspace.tenantId === activeTenantId ? 0.65 : 1,
                  }}
                  className="rounded-xl border border-border bg-background p-3"
                >
                  <Text className="text-footnote font-bold text-foreground">
                    {workspace.role.replace(/_/g, ' ').toUpperCase()}
                    {workspace.tenantId === activeTenantId
                      ? ' • ACTIVE'
                      : ''}
                  </Text>

                  <Text className="text-caption text-muted-foreground mt-1">
                    Workspace ID: {workspace.tenantId}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {workspaceMessage ? (
            <Text className="text-caption text-muted-foreground mt-2">
              {workspaceMessage}
            </Text>
          ) : null}
        </View>

        {/* LIVE FESTIVAL DATA V1 */}
        <View className="rounded-3xl border border-border bg-card p-5 mb-6">
          <Text className="text-caption font-bold uppercase tracking-widest text-primary">
            Live Festival Workspace
          </Text>

          <Text className="text-title2 font-bold text-foreground mt-2">
            {liveData.festivalName ?? activeTenantName ?? 'Festival Workspace'}
          </Text>

          <Text className="text-footnote text-muted-foreground mt-1">
            {liveData.country ?? 'Country not set'}
          </Text>

          <View className="flex-row flex-wrap gap-2 mt-4">
            <View className="rounded-xl border border-border bg-background px-3 py-2">
              <Text className="text-caption text-muted-foreground">
                PROFILE
              </Text>
              <Text className="text-footnote font-bold text-foreground mt-1">
                {(liveData.profileStatus ?? 'NOT CREATED').toUpperCase()}
              </Text>
            </View>

            <View className="rounded-xl border border-border bg-background px-3 py-2">
              <Text className="text-caption text-muted-foreground">
                SEASON
              </Text>
              <Text className="text-footnote font-bold text-foreground mt-1">
                {liveData.seasonLabel ?? '—'}
              </Text>
            </View>

            <View className="rounded-xl border border-border bg-background px-3 py-2">
              <Text className="text-caption text-muted-foreground">
                SEASON STATUS
              </Text>
              <Text className="text-footnote font-bold text-foreground mt-1">
                {(liveData.seasonStatus ?? 'NOT CREATED').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <Text className="text-title3 font-semibold text-foreground mb-3">
          Live operations
        </Text>

        <View className="flex-row flex-wrap gap-3 mb-6">
          <View className="flex-1 min-w-[140px] rounded-2xl bg-card border border-border p-4">
            <Text className="text-caption text-muted-foreground">
              Submissions
            </Text>
            <Text className="text-title1 font-bold text-foreground mt-2">
              {liveData.submissions}
            </Text>
            <Text className="text-caption text-primary mt-1">
              Active tenant only
            </Text>
          </View>

          <View className="flex-1 min-w-[140px] rounded-2xl bg-card border border-border p-4">
            <Text className="text-caption text-muted-foreground">
              Jury assignments
            </Text>
            <Text className="text-title1 font-bold text-foreground mt-2">
              {liveData.juryAssignments}
            </Text>
            <Text className="text-caption text-primary mt-1">
              Active tenant only
            </Text>
          </View>

          <View className="flex-1 min-w-[140px] rounded-2xl bg-card border border-border p-4">
            <Text className="text-caption text-muted-foreground">
              Jury reviews
            </Text>
            <Text className="text-title1 font-bold text-foreground mt-2">
              {liveData.juryReviews}
            </Text>
            <Text className="text-caption text-primary mt-1">
              Active tenant only
            </Text>
          </View>

          <View className="flex-1 min-w-[140px] rounded-2xl bg-card border border-border p-4">
            <Text className="text-caption text-muted-foreground">
              Notifications
            </Text>
            <Text className="text-title1 font-bold text-foreground mt-2">
              {liveData.notifications}
            </Text>
            <Text className="text-caption text-primary mt-1">
              Active tenant only
            </Text>
          </View>
        </View>

        <View className="rounded-2xl border border-border bg-card p-4">
          <Text className="text-headline font-semibold text-foreground">
            Supabase persistence
          </Text>
          <Text className="text-footnote text-muted-foreground mt-2">
            This dashboard now reads festival profile, season and operational counts
            from the currently active Film Festival OS™ tenant.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}
