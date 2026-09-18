import { goWorkspaceHome } from '@/lib/navigation';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ChevronRight, LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@/constants/theme';
import QuickGuideHelp from '@/components/QuickGuideHelp';

type HubItem = {
  title: string;
  detail: string;
  icon: LucideIcon;
  route?: string;
  badge?: string;
};

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: HubItem[];
  statusTitle?: string;
  statusText?: string;
};

export function OSHub({ eyebrow, title, subtitle, items, statusTitle, statusText }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}>
        <Pressable onPress={() => void goWorkspaceHome()} className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5">
          <ArrowLeft color={THEME.accent} size={19} />
        </Pressable>
        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">{eyebrow}</Text>
        <Text className="text-title1 font-bold text-foreground mt-1">{title}</Text>
        <Text className="text-subhead text-muted-foreground mt-2 mb-5">{subtitle}</Text>

        <QuickGuideHelp
          purpose={`Use ${title} as a controlled navigation hub for the related Film Festival OS™ functions.`}
          steps={[
            'Read the page status or summary first.',
            'Choose the module that matches the job you need to complete.',
            'Complete the task inside that module, then return to this hub.',
          ]}
          terms={[
            {
              label: 'MODULE',
              description: 'A dedicated Film Festival OS™ work area for a specific job or responsibility.',
            },
            {
              label: 'TENANT',
              description: 'The festival, franchise, territory or HQ workspace whose data and permissions you are currently using.',
            },
            {
              label: 'PRODUCTION',
              description: 'A workflow that has moved beyond a placeholder and is connected to implemented application logic.',
            },
          ]}
          flow={['OPEN HUB', 'CHOOSE MODULE', 'COMPLETE TASK', 'RETURN']}
        />

        {statusTitle && statusText ? (
          <View className="rounded-2xl border border-primary bg-card p-4 mb-6">
            <Text className="text-headline font-semibold text-primary">{statusTitle}</Text>
            <Text className="text-footnote text-muted-foreground mt-1">{statusText}</Text>
          </View>
        ) : null}

        <View className="gap-3">
          {items.map(({ title: itemTitle, detail, icon: Icon, route, badge }) => (
            <Pressable
              key={itemTitle}
              onPress={() => route && router.push(route as never)}
              disabled={!route}
              className="rounded-2xl bg-card border border-border p-4 flex-row items-center gap-3"
              style={({ pressed }) => ({ opacity: pressed && route ? 0.7 : 1 })}
            >
              <View className="w-11 h-11 rounded-xl items-center justify-center bg-background border border-border">
                <Icon color={THEME.accent} size={21} />
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-2">
                  <Text className="text-headline font-semibold text-card-foreground flex-shrink" numberOfLines={1}>{itemTitle}</Text>
                  {badge ? <Text className="text-caption font-bold text-primary">{badge}</Text> : null}
                </View>
                <Text className="text-footnote text-muted-foreground mt-1">{detail}</Text>
              </View>
              {route ? <ChevronRight color={THEME.muted} size={18} /> : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
