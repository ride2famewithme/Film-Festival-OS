import { goWorkspaceHome } from '@/lib/navigation';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  History,
  KeyRound,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@/constants/theme';

const items = [
  {
    title: 'Privileged Access',
    badge: 'PRODUCTION',
    subtitle: 'High-authority accounts, MFA policy and access review.',
    icon: LockKeyhole,
    route: '/privileged-access',
  },
  {
    title: 'Audit Event Register',
    badge: '',
    subtitle: 'Who changed what, when and under which active tenant context.',
    icon: History,
    route: '/audit-log',
  },
  {
    title: 'Security Events',
    badge: 'PRODUCTION',
    subtitle: 'Suspicious access, lockouts and investigation records.',
    icon: ShieldAlert,
    route: '/incidents',
  },
  {
    title: 'Backup Evidence',
    badge: 'PRODUCTION',
    subtitle: 'Backup/restore status and later recovery-test evidence.',
    icon: ShieldCheck,
    route: '/continuity',
  },
  {
    title: 'Emergency Controls',
    badge: 'PRODUCTION',
    subtitle: 'Suspend compromised access while preserving records.',
    icon: KeyRound,
    route: '/access-governance',
  },
] as const;

export default function AdminSecurityScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 20,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => void goWorkspaceHome()}
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-4"
        >
          <ArrowLeft size={19} color={THEME.accent} />
        </Pressable>

        <Text className="text-caption font-bold uppercase tracking-widest text-primary">GLOBAL HQ</Text>
        <Text className="text-title1 font-bold text-foreground mt-2">Security & Audit</Text>
        <Text className="text-body text-muted-foreground mt-2 mb-5">
          Privileged-access, audit, evidence and security-event control centre.
        </Text>

        <View className="rounded-2xl border border-primary/70 bg-card p-4 mb-5">
          <Text className="text-headline font-semibold text-primary">Audit workflow implemented</Text>
          <Text className="text-footnote text-muted-foreground mt-2">
            Implemented application workflows now write tenant-scoped audit events. MFA, security telemetry and backup verification remain production controls.
          </Text>
        </View>

        <View className="gap-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.title}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.title}`}
                onPress={() => router.push(item.route as never)}
                style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
                className="rounded-2xl border border-border bg-card p-4 flex-row items-center gap-4"
              >
                <View className="w-11 h-11 rounded-xl border border-border bg-background items-center justify-center">
                  <Icon size={20} color={THEME.accent} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-headline font-semibold text-card-foreground">{item.title}</Text>
                    {item.badge ? (
                      <Text className="text-caption font-bold text-primary">{item.badge}</Text>
                    ) : null}
                  </View>
                  <Text className="text-footnote text-muted-foreground mt-1">{item.subtitle}</Text>
                </View>
                <ArrowRight size={18} color={THEME.muted} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
