import {
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { THEME } from '@/constants/theme';

import {
  getTenantNftAwardPolicy,
  resolveNftSuggestedValue,
  setTenantNftAwardPolicy,
} from '@/data/workflows/nft-award-policy';


type ValueKey =
  | 'winner'
  | 'second'
  | 'third'
  | 'jury'
  | 'audience'
  | 'special';


const DEFINITIONS = [
  {
    key: 'winner',
    placement: 'winner',
    label: 'Winner / 1st Place',
  },
  {
    key: 'second',
    placement: 'second_place',
    label: '2nd Place',
  },
  {
    key: 'third',
    placement: 'third_place',
    label: '3rd Place',
  },
  {
    key: 'jury',
    placement: 'jury_choice',
    label: 'Jury Choice',
  },
  {
    key: 'audience',
    placement: 'audience_choice',
    label: 'Audience Choice',
  },
  {
    key: 'special',
    placement: 'special_recognition',
    label: 'Special Recognition',
  },
] as const;


function textValue(value: any) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value);
}


function parseValue(
  label: string,
  value: string
) {
  const raw = value.trim();

  if (!raw)
    return null;

  const n = Number(raw);

  if (
    !Number.isFinite(n) ||
    n < 0
  ) {
    throw new Error(
      `${label}: enter zero or a positive ETH value, or leave blank to inherit.`
    );
  }

  return n;
}


export default function NftValueHierarchyPanel() {
  const [policy, setPolicy] =
    useState<any | null>(null);

  const [effective, setEffective] =
    useState<Record<string, any>>({});

  const [values, setValues] =
    useState<Record<ValueKey, string>>({
      winner: '',
      second: '',
      third: '',
      jury: '',
      audience: '',
      special: '',
    });

  const [
    allowDescendantOverride,
    setAllowDescendantOverride,
  ] = useState(true);

  const [busy, setBusy] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState('');


  async function load() {
    setLoading(true);
    setLoadError('');

    try {
      const [
        p,
        winner,
        second,
        third,
        jury,
        audience,
        special,
      ] = await Promise.all([
        getTenantNftAwardPolicy(),
        resolveNftSuggestedValue('winner'),
        resolveNftSuggestedValue('second_place'),
        resolveNftSuggestedValue('third_place'),
        resolveNftSuggestedValue('jury_choice'),
        resolveNftSuggestedValue('audience_choice'),
        resolveNftSuggestedValue('special_recognition'),
      ]);

      setPolicy(p);

      setValues({
        winner:
          textValue(
            p?.winner_suggested_eth
          ),

        second:
          textValue(
            p?.second_place_suggested_eth
          ),

        third:
          textValue(
            p?.third_place_suggested_eth
          ),

        jury:
          textValue(
            p?.jury_choice_suggested_eth
          ),

        audience:
          textValue(
            p?.audience_choice_suggested_eth
          ),

        special:
          textValue(
            p?.special_recognition_suggested_eth
          ),
      });

      setAllowDescendantOverride(
        p?.allow_descendant_override !==
          false
      );

      setEffective({
        winner,
        second,
        third,
        jury,
        audience,
        special,
      });

    } catch (e: any) {
      const message =
        e?.message ||
        'Unknown hierarchy loading error';

      setLoadError(message);

      Alert.alert(
        'NFT Value Hierarchy',
        message
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void load();
  }, []);


  const inheritedLock =
    Object.values(effective).some(
      (row: any) =>
        row?.override_locked === true
    );


  async function save() {
    if (inheritedLock) {
      return Alert.alert(
        'NFT Value Hierarchy',
        'A higher franchise level has locked descendant overrides.'
      );
    }

    try {
      setBusy(true);

      await setTenantNftAwardPolicy({
        winner:
          parseValue(
            'Winner',
            values.winner
          ),

        second:
          parseValue(
            '2nd Place',
            values.second
          ),

        third:
          parseValue(
            '3rd Place',
            values.third
          ),

        jury:
          parseValue(
            'Jury Choice',
            values.jury
          ),

        audience:
          parseValue(
            'Audience Choice',
            values.audience
          ),

        special:
          parseValue(
            'Special Recognition',
            values.special
          ),

        allowDescendantOverride,
      });

      await load();

      Alert.alert(
        'NFT Value Hierarchy',
        'Workspace NFT value policy saved.'
      );

    } catch (e: any) {
      Alert.alert(
        'NFT Value Hierarchy',
        e.message
      );
    } finally {
      setBusy(false);
    }
  }


  return (
    <View className="rounded-2xl border border-primary bg-background p-4 mt-4">

      <Text className="text-headline font-semibold text-card-foreground">
        NFT Value Hierarchy™
      </Text>

      <Text className="text-footnote text-muted-foreground mt-1">
        Effective suggested resale / fundraising values follow the
        Film Festival OS™ tenant hierarchy. Leave workspace values
        blank to inherit from the nearest authorised parent policy.
      </Text>


      <Text className="text-footnote font-bold text-primary mt-3">
        Current workspace:{' '}
        {policy?.tenant_name ||
          'Active FFOS Workspace'}
      </Text>

      {!!loadError && (
        <View className="rounded-xl border border-primary bg-card p-3 mt-3">
          <Text className="text-footnote font-bold text-primary">
            NFT HIERARCHY LOAD ERROR
          </Text>

          <Text className="text-footnote text-card-foreground mt-1">
            {loadError}
          </Text>
        </View>
      )}


      {inheritedLock && (
        <Text className="text-footnote font-bold text-primary mt-2">
          HIGHER-LEVEL POLICY LOCK ACTIVE
        </Text>
      )}


      <View className="mt-4">

        {DEFINITIONS.map((item) => {
          const row =
            effective[item.key];

          const hasValue =
            row?.suggested_eth !== null &&
            row?.suggested_eth !== undefined;

          const amount =
            hasValue
              ? Number(row.suggested_eth)
              : null;

          return (
            <View
              key={item.key}
              className="rounded-xl border border-border bg-card p-3 mb-2"
            >
              <Text className="text-footnote font-bold text-card-foreground">
                {item.label}
              </Text>

              <Text className="text-footnote text-primary mt-1">
                Effective:{' '}
                {amount === null
                  ? 'UNAVAILABLE'
                  : `${amount.toFixed(8)} ETH`}
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                Source:{' '}
                {row?.source_tenant_name ||
                  'Film Festival OS™'}
                {' · '}
                {row?.source_kind ||
                  'SYSTEM DEFAULT'}
              </Text>
            </View>
          );
        })}

      </View>


      <Text className="text-footnote font-bold text-card-foreground mt-3 mb-2">
        Current Workspace Policy
      </Text>

      <Text className="text-footnote text-muted-foreground mb-3">
        Blank = inherit. Enter a value only when this workspace
        intentionally overrides the inherited policy.
      </Text>


      {DEFINITIONS.map((item) => (
        <View
          key={item.key}
          className="mb-3"
        >
          <Text className="text-footnote text-card-foreground mb-1">
            {item.label}
          </Text>

          <TextInput
            value={values[item.key]}
            editable={!inheritedLock}
            keyboardType="decimal-pad"
            placeholder="INHERIT"
            placeholderTextColor={
              THEME.muted
            }
            onChangeText={(value) =>
              setValues(
                (current) => ({
                  ...current,
                  [item.key]: value,
                })
              )
            }
            className={`rounded-xl border border-border bg-card px-4 py-3 text-foreground ${
              inheritedLock
                ? 'opacity-50'
                : ''
            }`}
          />
        </View>
      ))}


      <Pressable
        disabled={inheritedLock}
        onPress={() =>
          setAllowDescendantOverride(
            (value) => !value
          )
        }
        className={`rounded-xl border border-primary px-4 py-3 mt-1 ${
          inheritedLock
            ? 'opacity-50'
            : ''
        }`}
      >
        <Text className="text-footnote font-bold text-center text-primary">
          DESCENDANT OVERRIDES:{' '}
          {allowDescendantOverride
            ? 'ALLOWED'
            : 'LOCKED BELOW THIS WORKSPACE'}
        </Text>
      </Pressable>


      <Pressable
        disabled={
          busy ||
          loading ||
          inheritedLock
        }
        onPress={() =>
          void save()
        }
        className={`rounded-xl bg-primary px-4 py-3 mt-3 ${
          busy ||
          loading ||
          inheritedLock
            ? 'opacity-50'
            : ''
        }`}
      >
        <Text className="font-bold text-center text-primary-foreground">
          {busy
            ? 'Saving…'
            : loading
            ? 'Loading…'
            : inheritedLock
            ? 'INHERITED POLICY LOCKED'
            : 'SAVE WORKSPACE NFT VALUE POLICY'}
        </Text>
      </Pressable>

    </View>
  );
}
