import { goWorkspaceHome } from '@/lib/navigation';

import {
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ArrowLeft,
  Plus,
  RefreshCw,
} from 'lucide-react-native';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';

import {
  createCategory,
  listCategories,
  updateAllCategoryAwardControls,
  updateCategoryAwardControls,
  updateCategoryStatus,
} from '@/data/workflows/commercial-awards';
import NftValueHierarchyPanel from '@/components/NftValueHierarchyPanel';


export default function Categories() {
  const i = useSafeAreaInsets();

  const [rows, setRows] =
    useState<any[]>([]);

  const [name, setName] =
    useState('');

  const [fee, setFee] =
    useState('35');

  const [currency, setCurrency] =
    useState('USD');

  const [busy, setBusy] =
    useState(false);

  const [workingId, setWorkingId] =
    useState('');

  const [estimatedMintCost, setEstimatedMintCost] =
    useState('0.50');


  const load = async () => {
    try {
      setRows(
        await listCategories()
      );
    } catch (e: any) {
      Alert.alert(
        'Categories',
        e.message
      );
    }
  };


  useEffect(() => {
    void load();
  }, []);


  const add = async () => {
    if (!name.trim()) {
      return Alert.alert(
        'Required',
        'Category name is required.'
      );
    }

    const n = Number(fee);

    if (
      !Number.isFinite(n) ||
      n < 0
    ) {
      return Alert.alert(
        'Fee',
        'Enter a valid fee.'
      );
    }

    setBusy(true);

    try {
      await createCategory({
        name: name.trim(),
        currency:
          currency
            .trim()
            .toUpperCase() ||
          'USD',
        regular_fee: n,
      });

      setName('');

      await load();
    } catch (e: any) {
      Alert.alert(
        'Could not create',
        e.message
      );
    } finally {
      setBusy(false);
    }
  };


  async function setCategoryControls(
    row: any,
    values: {
      award_enabled?: boolean;
      nft_award_enabled?: boolean;
      nft_value_override_enabled?: boolean;
      winner_enabled?: boolean;
      second_place_enabled?: boolean;
      third_place_enabled?: boolean;
      jury_choice_enabled?: boolean;
      audience_choice_enabled?: boolean;
      special_recognition_enabled?: boolean;
      winner_reference_eth?: number;
      second_place_reference_eth?: number;
      third_place_reference_eth?: number;
      jury_choice_reference_eth?: number;
      audience_choice_reference_eth?: number;
      special_recognition_reference_eth?: number;
    }
  ) {
    setWorkingId(String(row.id));

    try {
      await updateCategoryAwardControls(
        String(row.id),
        values
      );

      await load();
    } catch (e: any) {
      Alert.alert(
        'Award Library',
        e.message
      );
    } finally {
      setWorkingId('');
    }
  }


  async function saveReferenceValue(
    row: any,
    field:
      | 'winner_reference_eth'
      | 'second_place_reference_eth'
      | 'third_place_reference_eth'
      | 'jury_choice_reference_eth'
      | 'audience_choice_reference_eth'
      | 'special_recognition_reference_eth',
    raw: string
  ) {
    const value = Number(raw);

    if (!Number.isFinite(value) || value < 0) {
      return Alert.alert(
        'NFT Award Reference Value',
        'Enter a valid ETH value of zero or greater.'
      );
    }

    await setCategoryControls(
      row,
      {
        [field]: value,
      } as any
    );
  }


  async function bulkControls(
    values: {
      award_enabled?: boolean;
      nft_award_enabled?: boolean;
    }
  ) {
    setBusy(true);

    try {
      await updateAllCategoryAwardControls(
        values
      );

      await load();
    } catch (e: any) {
      Alert.alert(
        'Award Library',
        e.message
      );
    } finally {
      setBusy(false);
    }
  }


  const awardCount =
    rows.filter(
      (r) =>
        r.award_enabled !== false
    ).length;

  const nftEligibleRows =
    rows.filter(
      (r) =>
        r.award_enabled !== false &&
        r.nft_award_enabled !== false
    );

  const nftCount =
    nftEligibleRows.length;

  const placementTotals = {
    winner: nftEligibleRows.filter(
      (r) => r.winner_enabled !== false
    ).length,

    second: nftEligibleRows.filter(
      (r) => r.second_place_enabled !== false
    ).length,

    third: nftEligibleRows.filter(
      (r) => r.third_place_enabled !== false
    ).length,

    jury: nftEligibleRows.filter(
      (r) => r.jury_choice_enabled !== false
    ).length,

    audience: nftEligibleRows.filter(
      (r) => r.audience_choice_enabled !== false
    ).length,

    special: nftEligibleRows.filter(
      (r) => r.special_recognition_enabled !== false
    ).length,
  };

  const estimatedMintCount =
    placementTotals.winner +
    placementTotals.second +
    placementTotals.third +
    placementTotals.jury +
    placementTotals.audience +
    placementTotals.special;

  const mintCost =
    Math.max(
      0,
      Number(estimatedMintCost) || 0
    );

  const estimatedTotalCost =
    estimatedMintCount * mintCost;


  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingTop:
            i.top + 12,
          paddingBottom:
            i.bottom + 40,
          paddingHorizontal: 20,
        }}
      >
        <Pressable
          onPress={() =>
            void goWorkspaceHome()
          }
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft
            color={THEME.accent}
            size={19}
          />
        </Pressable>


        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
          REAL WORKFLOW
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          Categories, Rules & Fees
        </Text>

        <Text className="text-subhead text-muted-foreground mt-1 mb-5">
          Persistent competition categories, controlled fees,
          entry status and Award Library™ controls.
        </Text>


        <View className="rounded-3xl border border-primary bg-card p-4 mb-5">
          <Text className="text-headline font-semibold text-card-foreground">
            Award Library™
          </Text>

          <Text className="text-footnote text-muted-foreground mt-2">
            Award categories and NFT / Digital Awards default to ON.
            Authorised management can switch individual categories
            ON or OFF without deleting the category or its history.
          </Text>

          <Text className="text-footnote text-card-foreground mt-3">
            Awards enabled: {awardCount} / {rows.length}
          </Text>

          <Text className="text-footnote text-card-foreground">
            NFT awards enabled: {nftCount} / {rows.length}
          </Text>

          <Text className="text-footnote font-bold text-primary mt-3">
            WINNER DESIGN: GOLDEN — LOCKED DEFAULT
          </Text>

          <NftValueHierarchyPanel />

          <View className="flex-row flex-wrap gap-2 mt-4">
            <Pressable
              disabled={busy}
              onPress={() =>
                void bulkControls({
                  award_enabled: true,
                })
              }
              className="rounded-full border border-primary px-3 py-2"
            >
              <Text className="text-footnote text-primary">
                ALL AWARDS ON
              </Text>
            </Pressable>

            <Pressable
              disabled={busy}
              onPress={() =>
                void bulkControls({
                  nft_award_enabled: true,
                })
              }
              className="rounded-full border border-primary px-3 py-2"
            >
              <Text className="text-footnote text-primary">
                ALL NFT AWARDS ON
              </Text>
            </Pressable>

            <Pressable
              disabled={busy}
              onPress={() =>
                void bulkControls({
                  nft_award_enabled: false,
                })
              }
              className="rounded-full border border-border px-3 py-2"
            >
              <Text className="text-footnote text-foreground">
                ALL NFT AWARDS OFF
              </Text>
            </Pressable>
          </View>

          <Text className="text-footnote text-muted-foreground mt-3">
            The NFT master switch is useful when minting time,
            budget or blockchain costs need to be reduced near
            award day.
          </Text>
        </View>


        <View className="rounded-3xl border border-border bg-card p-4 mb-5">
          <Text className="text-headline font-semibold text-card-foreground">
            NFT Award Budget / Minting Estimate
          </Text>

          <Text className="text-footnote text-muted-foreground mt-2">
            Automatically calculated from the Award Placement Controls that are ON.
            Actual blockchain or provider costs may vary at minting time.
          </Text>

          <View className="rounded-2xl border border-border bg-background p-4 mt-4">
            <Text className="text-footnote font-bold text-card-foreground">
              ACTIVE NFT AWARD PLAN
            </Text>

            <Text className="text-footnote text-card-foreground mt-2">
              Winner / 1st Place: {placementTotals.winner}
            </Text>

            <Text className="text-footnote text-card-foreground">
              2nd Place: {placementTotals.second}
            </Text>

            <Text className="text-footnote text-card-foreground">
              3rd Place: {placementTotals.third}
            </Text>

            <Text className="text-footnote text-card-foreground">
              Jury Choice: {placementTotals.jury}
            </Text>

            <Text className="text-footnote text-card-foreground">
              Audience / Public Choice: {placementTotals.audience}
            </Text>

            <Text className="text-footnote text-card-foreground">
              Special Recognition: {placementTotals.special}
            </Text>
          </View>

          <Text className="text-footnote font-semibold text-card-foreground mt-4 mb-2">
            Estimated mint / transfer cost per NFT — USD
          </Text>

          <TextInput
            value={estimatedMintCost}
            onChangeText={setEstimatedMintCost}
            keyboardType="decimal-pad"
            placeholder="0.50"
            placeholderTextColor={THEME.muted}
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground mb-4"
          />

          <View className="rounded-2xl border border-primary bg-background p-4">
            <Text className="text-footnote text-card-foreground">
              NFT-enabled categories: {nftCount}
            </Text>

            <Text className="text-footnote text-card-foreground mt-1">
              Enabled NFT award placements: {estimatedMintCount}
            </Text>

            <Text className="text-headline font-bold text-primary mt-3">
              Estimated total: USD ${estimatedTotalCost.toFixed(2)}
            </Text>
          </View>

          <Text className="text-footnote text-muted-foreground mt-3">
            Turn individual placement switches OFF to immediately reduce the
            expected NFT quantity and award-day minting budget.
          </Text>
        </View>


        <View className="rounded-3xl border border-border bg-card p-4 gap-3">
          <Text className="text-headline font-semibold text-card-foreground">
            Add competition category
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Category name"
            placeholderTextColor={
              THEME.muted
            }
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
          />

          <View className="flex-row gap-2">
            <TextInput
              value={fee}
              onChangeText={setFee}
              keyboardType="decimal-pad"
              placeholder="Fee"
              placeholderTextColor={
                THEME.muted
              }
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-foreground"
            />

            <TextInput
              value={currency}
              onChangeText={setCurrency}
              autoCapitalize="characters"
              placeholder="USD"
              placeholderTextColor={
                THEME.muted
              }
              className="w-24 rounded-xl border border-border bg-background px-4 py-3 text-foreground"
            />
          </View>

          <Pressable
            onPress={add}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-3 flex-row justify-center items-center gap-2"
          >
            <Plus
              size={17}
              color={THEME.primaryFg}
            />

            <Text className="font-bold text-primary-foreground">
              {busy
                ? 'Saving…'
                : 'Create Category'}
            </Text>
          </Pressable>
        </View>


        <View className="flex-row justify-between items-center mt-6 mb-3">
          <Text className="text-title3 font-semibold text-foreground">
            Category register
          </Text>

          <Pressable
            onPress={() =>
              void load()
            }
          >
            <RefreshCw
              size={19}
              color={THEME.accent}
            />
          </Pressable>
        </View>


        {rows.map((r) => {
          const awardOn =
            r.award_enabled !== false;

          const nftOn =
            r.nft_award_enabled !==
            false;

          const localValueOverrideOn =
            r.nft_value_override_enabled ===
            true;

          const winnerOn =
            r.winner_enabled !== false;

          const secondOn =
            r.second_place_enabled !== false;

          const thirdOn =
            r.third_place_enabled !== false;

          const juryOn =
            r.jury_choice_enabled !== false;

          const audienceOn =
            r.audience_choice_enabled !== false;

          const specialOn =
            r.special_recognition_enabled !== false;

          const working =
            workingId ===
            String(r.id);

          return (
            <View
              key={r.id}
              className="rounded-2xl border border-border bg-card p-4 mb-3"
            >
              <Text className="text-headline font-semibold text-card-foreground">
                {r.name}
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                {r.currency}{' '}
                {Number(
                  r.regular_fee
                ).toFixed(2)}
                {' · '}
                {r.status}
                {' · '}
                rules{' '}
                {r.rules_version ??
                  'not set'}
              </Text>


              <View className="rounded-xl border border-border bg-background p-3 mt-3">
                <Text className="text-footnote font-bold text-card-foreground">
                  Award Library Controls
                </Text>

                <View className="flex-row flex-wrap gap-2 mt-3">
                  <Pressable
                    disabled={working}
                    onPress={() =>
                      void setCategoryControls(
                        r,
                        {
                          award_enabled:
                            !awardOn,
                        }
                      )
                    }
                    className={`rounded-full border px-3 py-2 ${
                      awardOn
                        ? 'border-primary bg-primary'
                        : 'border-border bg-background'
                    }`}
                  >
                    <Text
                      className={
                        awardOn
                          ? 'text-footnote font-bold text-primary-foreground'
                          : 'text-footnote font-bold text-foreground'
                      }
                    >
                      AWARD:{' '}
                      {awardOn
                        ? 'ON'
                        : 'OFF'}
                    </Text>
                  </Pressable>


                  <Pressable
                    disabled={working}
                    onPress={() =>
                      void setCategoryControls(
                        r,
                        {
                          nft_award_enabled:
                            !nftOn,
                        }
                      )
                    }
                    className={`rounded-full border px-3 py-2 ${
                      nftOn
                        ? 'border-primary bg-primary'
                        : 'border-border bg-background'
                    }`}
                  >
                    <Text
                      className={
                        nftOn
                          ? 'text-footnote font-bold text-primary-foreground'
                          : 'text-footnote font-bold text-foreground'
                      }
                    >
                      NFT:{' '}
                      {nftOn
                        ? 'ON'
                        : 'OFF'}
                    </Text>
                  </Pressable>
                </View>


                <Text className="text-footnote font-bold text-card-foreground mt-4 mb-2">
                  Award Placement Controls
                </Text>

                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    disabled={working}
                    onPress={() =>
                      void setCategoryControls(r, {
                        winner_enabled: !winnerOn,
                      })
                    }
                    className={`rounded-full border px-3 py-2 ${
                      winnerOn
                        ? 'border-primary bg-primary'
                        : 'border-border bg-background'
                    }`}
                  >
                    <Text className={
                      winnerOn
                        ? 'text-footnote font-bold text-primary-foreground'
                        : 'text-footnote font-bold text-foreground'
                    }>
                      WINNER: {winnerOn ? 'ON' : 'OFF'}
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={working}
                    onPress={() =>
                      void setCategoryControls(r, {
                        second_place_enabled: !secondOn,
                      })
                    }
                    className={`rounded-full border px-3 py-2 ${
                      secondOn
                        ? 'border-primary bg-primary'
                        : 'border-border bg-background'
                    }`}
                  >
                    <Text className={
                      secondOn
                        ? 'text-footnote font-bold text-primary-foreground'
                        : 'text-footnote font-bold text-foreground'
                    }>
                      2ND: {secondOn ? 'ON' : 'OFF'}
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={working}
                    onPress={() =>
                      void setCategoryControls(r, {
                        third_place_enabled: !thirdOn,
                      })
                    }
                    className={`rounded-full border px-3 py-2 ${
                      thirdOn
                        ? 'border-primary bg-primary'
                        : 'border-border bg-background'
                    }`}
                  >
                    <Text className={
                      thirdOn
                        ? 'text-footnote font-bold text-primary-foreground'
                        : 'text-footnote font-bold text-foreground'
                    }>
                      3RD: {thirdOn ? 'ON' : 'OFF'}
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={working}
                    onPress={() =>
                      void setCategoryControls(r, {
                        jury_choice_enabled: !juryOn,
                      })
                    }
                    className={`rounded-full border px-3 py-2 ${
                      juryOn
                        ? 'border-primary bg-primary'
                        : 'border-border bg-background'
                    }`}
                  >
                    <Text className={
                      juryOn
                        ? 'text-footnote font-bold text-primary-foreground'
                        : 'text-footnote font-bold text-foreground'
                    }>
                      JURY CHOICE: {juryOn ? 'ON' : 'OFF'}
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={working}
                    onPress={() =>
                      void setCategoryControls(r, {
                        audience_choice_enabled: !audienceOn,
                      })
                    }
                    className={`rounded-full border px-3 py-2 ${
                      audienceOn
                        ? 'border-primary bg-primary'
                        : 'border-border bg-background'
                    }`}
                  >
                    <Text className={
                      audienceOn
                        ? 'text-footnote font-bold text-primary-foreground'
                        : 'text-footnote font-bold text-foreground'
                    }>
                      AUDIENCE: {audienceOn ? 'ON' : 'OFF'}
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={working}
                    onPress={() =>
                      void setCategoryControls(r, {
                        special_recognition_enabled: !specialOn,
                      })
                    }
                    className={`rounded-full border px-3 py-2 ${
                      specialOn
                        ? 'border-primary bg-primary'
                        : 'border-border bg-background'
                    }`}
                  >
                    <Text className={
                      specialOn
                        ? 'text-footnote font-bold text-primary-foreground'
                        : 'text-footnote font-bold text-foreground'
                    }>
                      SPECIAL: {specialOn ? 'ON' : 'OFF'}
                    </Text>
                  </Pressable>
                </View>

                <View className="rounded-2xl border border-border bg-background p-3 mt-4">
                  <Text className="text-footnote font-bold text-card-foreground">
                    NFT Suggested Resale / Fundraising Value™ — ETH
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-1 mb-3">
                    Suggested ETH resale / fundraising value assigned by authorised festival management.
                    FFOS does not preload, pay or transfer this ETH amount with the NFT.
                  </Text>

                  <Pressable
                    disabled={working}
                    onPress={() =>
                      void setCategoryControls(
                        r,
                        {
                          nft_value_override_enabled:
                            !localValueOverrideOn,
                        }
                      )
                    }
                    className={`rounded-xl border px-4 py-3 mb-3 ${
                      localValueOverrideOn
                        ? 'border-primary bg-primary'
                        : 'border-border bg-card'
                    }`}
                  >
                    <Text
                      className={
                        localValueOverrideOn
                          ? 'text-footnote font-bold text-center text-primary-foreground'
                          : 'text-footnote font-bold text-center text-primary'
                      }
                    >
                      FESTIVAL / EVENT OVERRIDE:{' '}
                      {localValueOverrideOn
                        ? 'ON'
                        : 'OFF — INHERIT'}
                    </Text>
                  </Pressable>

                  <Text className="text-footnote text-muted-foreground mb-3">
                    {localValueOverrideOn
                      ? 'This category uses its own ETH values unless a higher-level hierarchy lock applies.'
                      : 'This category inherits the effective FFOS hierarchy value. Local ETH fields are inactive.'}
                  </Text>

                  {[
                    ['Winner / 1st Place', 'winner_reference_eth', r.winner_reference_eth ?? 0.003],
                    ['2nd Place', 'second_place_reference_eth', r.second_place_reference_eth ?? 0.0005],
                    ['3rd Place', 'third_place_reference_eth', r.third_place_reference_eth ?? 0.00025],
                    ['Jury Choice', 'jury_choice_reference_eth', r.jury_choice_reference_eth ?? 0.0002],
                    ['Audience Choice', 'audience_choice_reference_eth', r.audience_choice_reference_eth ?? 0.0002],
                    ['Special Recognition', 'special_recognition_reference_eth', r.special_recognition_reference_eth ?? 0.0001],
                  ].map(([label, field, current]: any) => (
                    <View
                      key={field}
                      className="mb-3"
                    >
                      <Text className="text-footnote text-card-foreground mb-1">
                        {label}
                      </Text>

                      <TextInput
                        defaultValue={String(current)}
                        editable={localValueOverrideOn}
                        keyboardType="decimal-pad"
                        placeholder="0.00000000"
                        placeholderTextColor={THEME.muted}
                        onEndEditing={(e) => {
                          if (!localValueOverrideOn)
                            return;

                          void saveReferenceValue(
                            r,
                            field,
                            e.nativeEvent.text
                          );
                        }}
                        className="rounded-xl border border-border bg-card px-4 py-3 text-foreground"
                      />
                    </View>
                  ))}

                  <Text className="text-footnote text-muted-foreground mt-1">
                    After transfer, the recipient owns the NFT and may keep it, transfer it,
                    use the suggested amount as a fundraising target, or set their own marketplace listing price.
                    The suggested ETH amount is not prepaid cryptocurrency and is not a guaranteed market value.
                  </Text>
                </View>

                <Text className="text-footnote text-primary mt-3">
                  Winner design:
                  {' '}
                  GOLDEN
                  {' — '}
                  locked default
                </Text>

                <Text className="text-footnote text-muted-foreground mt-1">
                  Turning an award OFF does not delete the
                  competition category or historical results.
                </Text>
              </View>


              <Pressable
                onPress={async () => {
                  try {
                    await updateCategoryStatus(
                      r.id,
                      r.status === 'open'
                        ? 'closed'
                        : 'open'
                    );

                    await load();
                  } catch (e: any) {
                    Alert.alert(
                      'Category',
                      e.message
                    );
                  }
                }}
                className="self-start rounded-full border border-primary px-3 py-2 mt-3"
              >
                <Text className="text-footnote text-primary">
                  {r.status === 'open'
                    ? 'Close entries'
                    : 'Open entries'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
