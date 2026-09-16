import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Building2, ChevronRight, CircleDollarSign, FileBarChart, FolderKanban, Globe2, Inbox, LogIn, Megaphone, Settings2, ShieldCheck, Sparkles, UserRound, UsersRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@/constants/theme';

const sections = [
  {
    label: 'WORKSPACES',
    items: [
      { title: 'Festival Workspace', subtitle: 'Profile, season, categories, staff, jury and publishing', icon: Building2, route: '/festival' },
      { title: 'Filmmaker / Creator', subtitle: 'Projects, press kit, submissions, payments, messages and benefits', icon: UserRound, route: '/creator' },
      { title: 'Sponsor / Partner', subtitle: 'Approved campaigns, regions, assets and analytics', icon: UsersRound, route: '/sponsor' },
      { title: 'Platform Administration', subtitle: 'Global HQ governance, verification, moderation, support and audit', icon: ShieldCheck, route: '/admin' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { title: 'Submissions', subtitle: 'Search, filter, review and manage festival entries', icon: Inbox, route: '/submissions' },
      { title: 'Communications', subtitle: 'Submitters, jury/staff, templates and notification manager', icon: CircleDollarSign, route: '/communications' },
      { title: 'Reports & Exports', subtitle: 'Operational dashboards, jury progress and controlled exports', icon: FileBarChart, route: '/reports' },
      { title: 'Marketing', subtitle: 'Campaigns, ad creator, marketplace and connected channels', icon: Megaphone, route: '/marketing' },
      { title: 'Risk, Compliance & Resilience', subtitle: 'Risk, incidents, suppliers, continuity, obligations and access governance', icon: ShieldCheck, route: '/risk' },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { title: 'Jury Management', subtitle: 'Panel, assignments, scoring, weighting, conflicts and integrity controls', icon: UsersRound, route: '/jury' },
      { title: 'Project Management™', subtitle: 'Optional franchise portfolio, projects, tasks, board, timeline, KPIs, risks and AI next actions', icon: FolderKanban, route: '/project-management' },
    ],
  },
  {
    label: 'NETWORK & GROWTH',
    items: [
      { title: 'Global Network', subtitle: 'Country, regional, continental and Global Pool structure', icon: Globe2, route: '/network' },
      { title: 'Membership & Festival Credits™', subtitle: 'Membership tiers, benefits, discounts and loyalty ledger', icon: Sparkles, route: '/membership' },
      { title: 'Account & Settings', subtitle: 'Profile, locale, accessibility, security and connected services', icon: Settings2, route: '/settings' },
    ],
  },
];

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 160, paddingHorizontal: 20 }}>
        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">FILM FESTIVAL OS™ · v4.0 FINAL</Text>
        <Text className="text-title1 font-bold text-foreground mt-1">Operating System</Text>
        <Text className="text-subhead text-muted-foreground mt-2 mb-6">Role-based access to the major Film Festival OS™ workspaces and operating layers.</Text>

        {sections.map((section) => (
          <View key={section.label} className="mb-6">
            <Text className="text-caption font-bold uppercase tracking-widest text-primary mb-3">{section.label}</Text>
            <View className="gap-3">
              {section.items.map(({ title, subtitle, icon: Icon, route }) => (
                <Pressable key={title} onPress={() => router.push(route as never)} className="rounded-2xl bg-card border border-border p-4 flex-row items-center gap-3" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <View className="w-11 h-11 rounded-xl items-center justify-center bg-background border border-border">
                    <Icon color={THEME.accent} size={21} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-headline font-semibold text-card-foreground">{title}</Text>
                    <Text className="text-footnote text-muted-foreground mt-1">{subtitle}</Text>
                  </View>
                  <ChevronRight color={THEME.muted} size={18} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable onPress={() => router.push('/login')} className="mt-1 rounded-2xl border border-primary px-4 py-3 flex-row items-center justify-center gap-2" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <LogIn color={THEME.accent} size={18} />
          <Text className="text-subhead font-semibold text-primary">Sign in / switch role</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
