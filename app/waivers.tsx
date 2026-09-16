import { goWorkspaceHome } from '@/lib/navigation';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import {
  createBenefit,
  listBenefits,
  listCategories,
  toggleBenefit,
} from '@/data/workflows/commercial-awards';

type Kind = 'percent' | 'fixed' | 'waiver' | 'deadline';

function isoDate(value: string) {
  return value.trim() ? `${value.trim()}T00:00:00.000Z` : null;
}

export default function Waivers() {
  const i = useSafeAreaInsets();

  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<Kind>('percent');
  const [value, setValue] = useState('10');
  const [reason, setReason] = useState('');

  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [usageLimit, setUsageLimit] = useState('');

  const [deadlineWaiver, setDeadlineWaiver] = useState(false);
  const [oneUse, setOneUse] = useState(false);
  const [visibility, setVisibility] =
    useState<'private' | 'public'>('private');

  const [appliesTo, setAppliesTo] =
    useState<'all' | 'selected'>('all');

  const [selectedCategories, setSelectedCategories] =
    useState<string[]>([]);

  const load = async () => {
    try {
      const [b, c] = await Promise.all([
        listBenefits(),
        listCategories(),
      ]);

      setRows(b);
      setCategories(c.filter((x: any) => x.status === 'open'));
    } catch (e: any) {
      Alert.alert('Waivers & Benefits', e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleCategory = (id: string) => {
    setSelectedCategories((old) =>
      old.includes(id)
        ? old.filter((x) => x !== id)
        : [...old, id]
    );
  };

  const add = async () => {
    if (!code.trim())
      return Alert.alert('Required', 'Code is required.');

    let amount = 0;

    if (kind === 'percent' || kind === 'fixed') {
      amount = Number(value);

      if (!Number.isFinite(amount) || amount < 0)
        return Alert.alert('Value', 'Enter a valid value.');
    }

    if (kind === 'waiver') amount = 100;
    if (kind === 'deadline') amount = 0;

    const maxUses = usageLimit.trim()
      ? Number(usageLimit)
      : undefined;

    if (
      maxUses !== undefined &&
      (!Number.isInteger(maxUses) || maxUses <= 0)
    ) {
      return Alert.alert(
        'Maximum uses',
        'Enter a whole number greater than zero.'
      );
    }

    if (
      appliesTo === 'selected' &&
      selectedCategories.length === 0
    ) {
      return Alert.alert(
        'Categories',
        'Select at least one category.'
      );
    }

    try {
      await createBenefit({
        code,
        label,
        kind,
        value: amount,
        reason,
        starts_at: isoDate(startsAt),
        expires_at: isoDate(expiresAt),
        usage_limit: maxUses,
        deadline_waiver:
          kind === 'deadline' ? true : deadlineWaiver,
        one_use_per_submitter: oneUse,
        visibility,
        applies_to: appliesTo,
        category_ids: selectedCategories,
      });

      setCode('');
      setLabel('');
      setReason('');
      setUsageLimit('');
      setSelectedCategories([]);

      await load();

      Alert.alert(
        'Saved',
        'Waiver / benefit code saved to Supabase.'
      );
    } catch (e: any) {
      Alert.alert('Could not create', e.message);
    }
  };

  const Choice = ({
    active,
    label,
    onPress,
  }: {
    active: boolean;
    label: string;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3 py-2 ${
        active
          ? 'border-primary bg-primary'
          : 'border-border bg-background'
      }`}
    >
      <Text
        className={
          active
            ? 'text-primary-foreground'
            : 'text-foreground'
        }
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingTop: i.top + 12,
          paddingBottom: i.bottom + 40,
          paddingHorizontal: 20,
        }}
      >
        <Pressable
          onPress={() => void goWorkspaceHome()}
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft color={THEME.accent} size={19} />
        </Pressable>

        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
          REAL WORKFLOW
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          Waiver & Discount Control Centre™
        </Text>

        <Text className="text-subhead text-muted-foreground mt-1 mb-5">
          Tenant-controlled discounts, fee waivers, deadline
          waivers and member benefits with issuer and audit
          history.
        </Text>

        <View className="rounded-3xl border border-border bg-card p-4 gap-3">
          <Text className="text-headline font-semibold text-card-foreground">
            Create code
          </Text>

          <TextInput
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            placeholder="Code — e.g. MEMBER10"
            placeholderTextColor={THEME.muted}
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
          />

          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Internal label — optional"
            placeholderTextColor={THEME.muted}
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
          />

          <Text className="font-semibold text-foreground">
            Code type
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {(
              [
                ['percent', 'Percent'],
                ['fixed', 'Fixed'],
                ['waiver', 'Fee Waiver'],
                ['deadline', 'Deadline Waiver'],
              ] as const
            ).map(([k, text]) => (
              <Choice
                key={k}
                active={kind === k}
                label={text}
                onPress={() => setKind(k)}
              />
            ))}
          </View>

          {(kind === 'percent' || kind === 'fixed') && (
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder={
                kind === 'percent'
                  ? 'Percent discount'
                  : 'Fixed amount'
              }
              placeholderTextColor={THEME.muted}
              className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
            />
          )}

          {kind !== 'deadline' && (
            <>
              <Text className="font-semibold text-foreground">
                Also allow deadline waiver?
              </Text>

              <View className="flex-row gap-2">
                <Choice
                  active={deadlineWaiver}
                  label="Yes"
                  onPress={() => setDeadlineWaiver(true)}
                />
                <Choice
                  active={!deadlineWaiver}
                  label="No"
                  onPress={() => setDeadlineWaiver(false)}
                />
              </View>
            </>
          )}

          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason — VIP, Member, Sponsor, Student, Partner..."
            placeholderTextColor={THEME.muted}
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
          />

          <Text className="font-semibold text-foreground">
            Validity
          </Text>

          <View className="flex-row gap-2">
            <TextInput
              value={startsAt}
              onChangeText={setStartsAt}
              placeholder="Start YYYY-MM-DD"
              placeholderTextColor={THEME.muted}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-foreground"
            />

            <TextInput
              value={expiresAt}
              onChangeText={setExpiresAt}
              placeholder="End YYYY-MM-DD"
              placeholderTextColor={THEME.muted}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-foreground"
            />
          </View>

          <TextInput
            value={usageLimit}
            onChangeText={setUsageLimit}
            keyboardType="number-pad"
            placeholder="Maximum uses — blank = unlimited"
            placeholderTextColor={THEME.muted}
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
          />

          <Text className="font-semibold text-foreground">
            One use per submitter
          </Text>

          <View className="flex-row gap-2">
            <Choice
              active={oneUse}
              label="Yes"
              onPress={() => setOneUse(true)}
            />
            <Choice
              active={!oneUse}
              label="No"
              onPress={() => setOneUse(false)}
            />
          </View>

          <Text className="font-semibold text-foreground">
            Visibility
          </Text>

          <View className="flex-row gap-2">
            <Choice
              active={visibility === 'private'}
              label="Private"
              onPress={() => setVisibility('private')}
            />
            <Choice
              active={visibility === 'public'}
              label="Public"
              onPress={() => setVisibility('public')}
            />
          </View>

          <Text className="font-semibold text-foreground">
            Categories
          </Text>

          <View className="flex-row gap-2">
            <Choice
              active={appliesTo === 'all'}
              label="All Categories"
              onPress={() => setAppliesTo('all')}
            />
            <Choice
              active={appliesTo === 'selected'}
              label="Specific Categories"
              onPress={() => setAppliesTo('selected')}
            />
          </View>

          {appliesTo === 'selected' && (
            <View className="flex-row flex-wrap gap-2">
              {categories.map((cat) => (
                <Choice
                  key={cat.id}
                  active={selectedCategories.includes(cat.id)}
                  label={cat.name}
                  onPress={() => toggleCategory(cat.id)}
                />
              ))}
            </View>
          )}

          <Pressable
            onPress={add}
            className="rounded-xl bg-primary px-4 py-3 flex-row justify-center items-center gap-2 mt-2"
          >
            <Plus size={17} color={THEME.primaryFg} />
            <Text className="font-bold text-primary-foreground">
              Create Waiver / Benefit
            </Text>
          </Pressable>
        </View>

        <View className="flex-row justify-between items-center mt-6 mb-3">
          <Text className="text-title3 font-semibold text-foreground">
            Code register
          </Text>

          <Pressable onPress={load}>
            <RefreshCw size={19} color={THEME.accent} />
          </Pressable>
        </View>

        {rows.map((r) => (
          <View
            key={r.id}
            className="rounded-2xl border border-border bg-card p-4 mb-3"
          >
            <Text className="text-headline font-semibold text-card-foreground">
              {r.code}
            </Text>

            {!!r.label && (
              <Text className="text-footnote text-foreground mt-1">
                {r.label}
              </Text>
            )}

            <Text className="text-footnote text-muted-foreground mt-1">
              {r.kind} · value {r.value} · {r.status}
            </Text>

            <Text className="text-footnote text-muted-foreground">
              Uses {r.uses_count ?? 0}
              {r.usage_limit ? ` / ${r.usage_limit}` : ' / unlimited'}
              {' · '}
              {r.visibility ?? 'private'}
              {' · '}
              {r.applies_to ?? 'all'} categories
            </Text>

            {!!r.reason && (
              <Text className="text-footnote text-muted-foreground">
                Reason: {r.reason}
              </Text>
            )}

            <Pressable
              onPress={async () => {
                await toggleBenefit(r.id, r.status);
                await load();
              }}
              className="self-start rounded-full border border-primary px-3 py-2 mt-3"
            >
              <Text className="text-footnote text-primary">
                {r.status === 'active' ? 'Pause' : 'Activate'}
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
