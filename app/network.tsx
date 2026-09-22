import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ArrowLeft,
  ChevronDown,
  Globe2,
  Map,
  MapPinned,
  RefreshCw,
  Trophy,
} from 'lucide-react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { goWorkspaceHome } from '@/lib/navigation';
import { THEME } from '@/constants/theme';
import QuickGuideHelp from '@/components/QuickGuideHelp';
import { US_STATE_OPTIONS } from '@/data/reference/us-states';
import {
  countries,
  continents,
} from 'countries-list';
import {
  bootstrapGlobalHqProfile,
  createFranchiseOperatorAtomic,
  listFranchiseNetwork,
  type FranchiseLevel,
} from '@/data/workflows/franchise';

type WorldCountryOption = {
  code: string;
  name: string;
  aliases: string[];
  continentCode: string;
  continentName: string;
  capital: string;
};

const WORLD_COUNTRY_OPTIONS: WorldCountryOption[] =
  Object.entries(
    countries as Record<string, any>
  )
    .map(([code, country]) => {
      const continentCode = String(
        country.continent ?? ''
      );

      return {
        code,
        name: String(country.name ?? ''),
        aliases: Array.isArray(country.alias)
          ? country.alias.map(String)
          : [],
        continentCode,
        continentName: String(
          (
            continents as Record<
              string,
              string
            >
          )[continentCode] ?? ''
        ),
        capital: String(
          country.capital ?? ''
        ),
      };
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name)
    );

const layers = [
  {
    name: 'Global Master',
    detail:
      'Global platform standards, IP, governance and approved network controls.',
    icon: Globe2,
  },
  {
    name: 'Continent Master',
    detail:
      'Continental coordination and approved regional operating structure.',
    icon: Map,
  },
  {
    name: 'Country Master',
    detail:
      'Country-level operator network, language and commercial coordination.',
    icon: MapPinned,
  },
  {
    name: 'Region / State + Capital Structure',
    detail:
      'Region/state territories with separate national/country and state/regional capital pathways.',
    icon: MapPinned,
  },
  {
    name: 'City Operator',
    detail:
      'Approved city-level franchise or operator territory.',
    icon: MapPinned,
  },
  {
    name: 'Festival Operator',
    detail:
      'Locally operated festival workspace with its own programme and operations.',
    icon: Trophy,
  },
  {
    name: 'Global Pool',
    detail:
      'Optional direct-entry or advancement pathway governed by traceable rules.',
    icon: Globe2,
  },
];

const pretty = (value: string) => {
  const labels: Record<string, string> = {
    capital_city: 'NATIONAL / COUNTRY CAPITAL',
    regional_capital: 'STATE / REGIONAL CAPITAL',
  };

  return (
    labels[String(value || '')] ??
    String(value || '')
      .replace(/_/g, ' ')
      .toUpperCase()
  );
};

const creatableLevels: {
  value: FranchiseLevel;
  label: string;
}[] = [
  { value: 'continent_master', label: 'CONTINENT MASTER' },
  { value: 'country_master', label: 'COUNTRY MASTER' },
  { value: 'region_master', label: 'REGION MASTER' },
  { value: 'capital_city', label: 'NATIONAL / COUNTRY CAPITAL' },
  { value: 'regional_capital', label: 'STATE / REGIONAL CAPITAL' },
  { value: 'city_operator', label: 'CITY OPERATOR' },
  { value: 'festival_operator', label: 'FESTIVAL OPERATOR' },
  { value: 'global_pool', label: 'GLOBAL POOL' },
];

const parentRules: Record<string, FranchiseLevel[]> = {
  continent_master: ['global_master'],
  country_master: ['continent_master', 'global_master'],
  region_master: ['country_master'],
  capital_city: ['country_master'],
  regional_capital: ['region_master'],
  city_operator: [
    'region_master',
    'capital_city',
    'regional_capital',
    'country_master',
  ],
  festival_operator: [
    'city_operator',
    'region_master',
    'capital_city',
    'regional_capital',
    'country_master',
  ],
  global_pool: ['global_master'],
};

export default function NetworkScreen() {
  const insets = useSafeAreaInsets();

  const [rows, setRows] =
    useState<any[]>([]);

  const [refreshing, setRefreshing] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [bootstrapping, setBootstrapping] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [createMessage, setCreateMessage] =
    useState('');

  const [showUSStates, setShowUSStates] =
    useState(false);

  const [usStateQuery, setUsStateQuery] =
    useState('');

  const [geographyQuery, setGeographyQuery] =
    useState('');

  const [
    selectedCountryCode,
    setSelectedCountryCode,
  ] = useState('');

  const [
    geographyMessage,
    setGeographyMessage,
  ] = useState('');

  const [newName, setNewName] =
    useState('');

  const [newTerritory, setNewTerritory] =
    useState('');

  const [newLevel, setNewLevel] =
    useState<FranchiseLevel>(
      'continent_master'
    );

  const [
    parentTenantId,
    setParentTenantId,
  ] = useState('');

  const eligibleParents = rows.filter(
    (row) =>
      (
        parentRules[newLevel] ?? []
      ).includes(
        row.franchise_level as FranchiseLevel
      )
  );

  const geographyNeedle =
    geographyQuery
      .trim()
      .toUpperCase();

  const countrySuggestions =
    geographyNeedle.length >= 2
      ? WORLD_COUNTRY_OPTIONS
          .filter((country) => {
            const haystack = [
              country.name,
              country.code,
              country.continentName,
              country.capital,
              ...country.aliases,
            ]
              .join(' ')
              .toUpperCase();

            return haystack.includes(
              geographyNeedle
            );
          })
          .slice(0, 8)
      : [];

  const parentSuggestions =
    geographyNeedle.length >= 2
      ? eligibleParents
          .filter((row) =>
            [
              row.tenant_name,
              row.territory_name,
              row.continent_name,
              row.country_name,
              row.country_code,
              row.region_name,
              row.region_code,
              row.city_name,
            ]
              .map((value) =>
                String(value ?? '')
                  .toUpperCase()
              )
              .join(' ')
              .includes(geographyNeedle)
          )
          .slice(0, 8)
      : [];

  const usaCountryMaster =
    rows.find((row) => {
      if (
        row.franchise_level !==
        'country_master'
      ) {
        return false;
      }

      const values = [
        row.country_code,
        row.country_name,
        row.territory_name,
        row.tenant_name,
      ].map((value) =>
        String(value ?? '')
          .trim()
          .toUpperCase()
      );

      return values.some(
        (value) =>
          value === 'US' ||
          value === 'USA' ||
          value === 'UNITED STATES' ||
          value ===
            'UNITED STATES OF AMERICA' ||
          value.includes(
            'UNITED STATES'
          )
      );
    });

  const smartUSStateSuggestions =
    newLevel === 'region_master' &&
    geographyNeedle.length >= 2
      ? US_STATE_OPTIONS
          .filter((state) => {
            const stateName =
              state.name.toUpperCase();

            const stateCode =
              state.code.toUpperCase();

            return (
              stateName.includes(
                geographyNeedle
              ) ||
              stateCode ===
                geographyNeedle
            );
          })
          .slice(0, 8)
      : [];

  const selectedParent = eligibleParents.find(
    (row) =>
      String(row.tenant_id) === parentTenantId
  );

  const selectedParentName = String(
    selectedParent?.tenant_name ?? ''
  ).trim();

  const selectedParentCountryValues = [
    selectedParent?.territory_name,
    selectedParent?.country_name,
    selectedParent?.country_code,
    selectedParent?.tenant_name,
  ].map((value) =>
    String(value ?? '').trim().toUpperCase()
  );

  const isUSCountryParent =
    newLevel === 'region_master' &&
    selectedParent?.franchise_level ===
      'country_master' &&
    selectedParentCountryValues.some(
      (value) =>
        value === 'USA' ||
        value === 'US' ||
        value === 'UNITED STATES' ||
        value === 'UNITED STATES OF AMERICA' ||
        value.includes('UNITED STATES')
    );

  const selectedUSState =
    US_STATE_OPTIONS.find(
      (state) =>
        newTerritory.trim() ===
        `${state.name} (${state.code})`
    );

  const usStateNeedle =
    usStateQuery
      .trim()
      .toUpperCase();

  const filteredUSStateOptions =
    usStateNeedle
      ? US_STATE_OPTIONS.filter(
          (state) =>
            state.name
              .toUpperCase()
              .includes(usStateNeedle) ||
            state.code
              .toUpperCase()
              .includes(usStateNeedle)
        )
      : US_STATE_OPTIONS;

  const isUnitedStatesCountryEntry =
    newLevel === 'country_master' &&
    [
      'US',
      'USA',
      'UNITED STATES',
      'UNITED STATES OF AMERICA',
    ].includes(
      newTerritory.trim().toUpperCase()
    );

  const applyCountrySuggestion = (
    country: WorldCountryOption
  ) => {
    const upper = (value: unknown) =>
      String(value ?? '')
        .trim()
        .toUpperCase();

    const globalMaster = rows.find(
      (row) =>
        row.franchise_level ===
        'global_master'
    );

    const continentMaster = rows.find(
      (row) =>
        row.franchise_level ===
          'continent_master' &&
        [
          row.tenant_name,
          row.territory_name,
          row.continent_name,
        ].some((value) =>
          upper(value).includes(
            upper(country.continentName)
          )
        )
    );

    const countryMaster = rows.find(
      (row) =>
        row.franchise_level ===
          'country_master' &&
        (
          upper(row.country_code) ===
            upper(country.code) ||
          [
            row.country_name,
            row.territory_name,
            row.tenant_name,
          ].some((value) =>
            upper(value).includes(
              upper(country.name)
            )
          )
        )
    );

    setGeographyQuery(
      `${country.name} (${country.code})`
    );
    setSelectedCountryCode(
      country.code
    );
    setShowUSStates(false);
    setCreateMessage('');

    if (newLevel === 'continent_master') {
      setNewTerritory(
        country.continentName
      );

      setParentTenantId(
        globalMaster
          ? String(globalMaster.tenant_id)
          : ''
      );

      setGeographyMessage(
        `✓ ${country.name} belongs to ${country.continentName}. FFOS prepared the Continent Master territory.`
      );

      return;
    }

    if (newLevel === 'country_master') {
      setNewTerritory(country.name);

      const parent =
        continentMaster ??
        globalMaster;

      setParentTenantId(
        parent
          ? String(parent.tenant_id)
          : ''
      );

      setGeographyMessage(
        continentMaster
          ? `✓ ${country.name} (${country.code}) selected. Existing ${country.continentName} Continent Master selected automatically.`
          : `✓ ${country.name} (${country.code}) selected. No ${country.continentName} Continent Master exists yet, so Global HQ was selected as the permitted parent.`
      );

      return;
    }

    if (
      newLevel === 'region_master'
    ) {
      if (countryMaster) {
        setParentTenantId(
          String(countryMaster.tenant_id)
        );
        setNewTerritory('');

        setShowUSStates(
          country.code === 'US'
        );

        setGeographyMessage(
          country.code === 'US'
            ? `✓ ${country.name} Country Master selected. USA State / District list opened automatically below.`
            : `✓ ${country.name} Country Master selected. Now choose or enter the State / Region below.`
        );
      } else {
        setNewLevel(
          'country_master'
        );
        setNewTerritory(
          country.name
        );

        const parent =
          continentMaster ??
          globalMaster;

        setParentTenantId(
          parent
            ? String(parent.tenant_id)
            : ''
        );

        setGeographyMessage(
          `COUNTRY MASTER REQUIRED FIRST — FFOS switched to Country Master and prepared ${country.name} (${country.code}) automatically.`
        );
      }

      return;
    }

    if (
      newLevel === 'capital_city'
    ) {
      if (countryMaster) {
        setParentTenantId(
          String(countryMaster.tenant_id)
        );

        if (country.capital) {
          setNewTerritory(
            country.capital
          );
        }

        setGeographyMessage(
          `✓ ${country.name} selected. ${country.capital || 'The national capital'} is ready as the National / Country Capital territory.`
        );
      } else {
        setNewLevel(
          'country_master'
        );
        setNewTerritory(
          country.name
        );

        const parent =
          continentMaster ??
          globalMaster;

        setParentTenantId(
          parent
            ? String(parent.tenant_id)
            : ''
        );

        setGeographyMessage(
          `COUNTRY MASTER REQUIRED FIRST — FFOS prepared ${country.name} before its National / Country Capital can be created.`
        );
      }

      return;
    }

    if (
      newLevel === 'city_operator' ||
      newLevel === 'festival_operator'
    ) {
      if (countryMaster) {
        setParentTenantId(
          String(countryMaster.tenant_id)
        );

        setGeographyMessage(
          `✓ ${country.name} Country Master selected as a permitted parent. You may also search for a more specific Region, Capital or City below.`
        );
      } else {
        setGeographyMessage(
          `${country.name} was found, but no Country Master exists in the FFOS network yet. Create the Country Master first.`
        );
      }

      return;
    }

    if (
      newLevel === 'regional_capital'
    ) {
      setGeographyMessage(
        `${country.name} found. A State / Regional Capital must sit beneath an existing Region / State Master. Start typing the State or Region name to find that existing parent.`
      );

      return;
    }

    setGeographyMessage(
      `✓ ${country.name} (${country.code}) found.`
    );
  };

  const applyUSStateSuggestion = (
    state: {
      name: string;
      code: string;
    }
  ) => {
    if (!usaCountryMaster) {
      setGeographyMessage(
        'USA COUNTRY MASTER REQUIRED FIRST — create the United States Country Master before adding a State / Region.'
      );
      return;
    }

    setParentTenantId(
      String(
        usaCountryMaster.tenant_id
      )
    );

    setNewTerritory(
      `${state.name} (${state.code})`
    );

    setGeographyQuery(
      `${state.name} (${state.code})`
    );

    setShowUSStates(false);
    setUsStateQuery('');
    setCreateMessage('');

    setGeographyMessage(
      `✓ ${state.name} (${state.code}) selected. United States Country Master was selected automatically as the parent and Step 4 was populated.`
    );
  };

  const applyParentSuggestion = (
    row: any
  ) => {
    const rowCountryValues = [
      row.country_code,
      row.country_name,
      row.territory_name,
      row.tenant_name,
    ].map((value) =>
      String(value ?? '')
        .trim()
        .toUpperCase()
    );

    const shouldOpenUSStates =
      newLevel === 'region_master' &&
      row.franchise_level ===
        'country_master' &&
      rowCountryValues.some(
        (value) =>
          value === 'US' ||
          value === 'USA' ||
          value === 'UNITED STATES' ||
          value ===
            'UNITED STATES OF AMERICA' ||
          value.includes(
            'UNITED STATES'
          )
      );

    setParentTenantId(
      String(row.tenant_id)
    );

    setGeographyQuery(
      String(
        row.territory_name ??
        row.tenant_name ??
        ''
      )
    );

    setGeographyMessage(
      `✓ Existing ${pretty(
        row.franchise_level
      )} parent selected: ${
        row.tenant_name
      }.`
    );

    setShowUSStates(
      shouldOpenUSStates
    );
    setCreateMessage('');
  };

  const selectedLevelLabel =
    creatableLevels.find(
      (level) => level.value === newLevel
    )?.label ?? pretty(newLevel);

  const normaliseFormValue = (value: string) =>
    value.trim().toUpperCase();

  const invalidTenantName =
    !!newName.trim() &&
    (
      normaliseFormValue(newName) ===
        normaliseFormValue(selectedLevelLabel) ||
      (
        !!selectedParentName &&
        normaliseFormValue(newName) ===
          normaliseFormValue(selectedParentName)
      )
    );

  const invalidTerritoryName =
    !!newTerritory.trim() &&
    (
      normaliseFormValue(newTerritory) ===
        normaliseFormValue(selectedLevelLabel) ||
      (
        !!selectedParentName &&
        normaliseFormValue(newTerritory) ===
          normaliseFormValue(selectedParentName)
      )
    );

  const duplicateTerritory =
    !!newTerritory.trim() &&
    !!parentTenantId
      ? rows.find(
          (row) =>
            String(
              row.franchise_level ?? ''
            ) === newLevel &&
            String(
              row.parent_tenant_id ?? ''
            ) === parentTenantId &&
            normaliseFormValue(
              String(
                row.territory_name ?? ''
              )
            ) ===
              normaliseFormValue(
                newTerritory
              )
        )
      : undefined;

  const createDisabled =
    creating ||
    !newName.trim() ||
    !newTerritory.trim() ||
    !parentTenantId ||
    invalidTenantName ||
    invalidTerritoryName ||
    !!duplicateTerritory;


  const load = useCallback(
    async () => {
      setRefreshing(true);
      setMessage('');

      try {
        setRows(
          await listFranchiseNetwork()
        );
      } catch (error: any) {
        setRows([]);

        setMessage(
          error?.message ??
            'Franchise network could not be loaded.'
        );
      } finally {
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={load}
            tintColor={THEME.accent}
          />
        }
        contentContainerStyle={{
          paddingTop:
            insets.top + 12,
          paddingBottom:
            insets.bottom + 40,
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
          GLOBAL FRANCHISE ARCHITECTURE
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          One platform. Local independence.
        </Text>

        <Text className="text-subhead text-muted-foreground mt-2 mb-5">
          Controlled multi-tenant franchise and operator hierarchy with optional Global Pool.
        </Text>

        <QuickGuideHelp
          purpose="Show how Film Festival OS™ franchise, territory and festival operators fit into one controlled network."
          steps={[
            'IMPORTANT — Select Parent: seeing a parent name does not mean it is selected. Click the required parent box (for example Film Festival OS™ Global HQ) until a gold outline and ✓ SELECTED PARENT appear. The Create button remains disabled until this selection is made.',

            'Follow the form in order: Step 1 choose the Franchise / Operator Level; Step 2 click an eligible Parent card; Step 3 enter the actual Operator / Tenant Name; Step 4 enter the Territory Name. Do not paste the level or parent name into Steps 3 or 4.',
            'For USA Region / State Master setup, select the United States Country parent and use the USA State / District Selector to choose the state and two-letter abbreviation.',
            'Start at the highest applicable territory level.',
            'Follow the parent → child hierarchy down to the local operator.',
            'Use the live register below to confirm each operator territory and status.',
          ]}
          terms={[
            {
              label: 'MASTER',
              description:
                'A higher-level approved operating territory such as global, continent or country.',
            },
            {
              label: 'OPERATOR',
              description:
                'The authorised organisation or tenant running an approved territory or festival.',
            },
            {
              label: 'TERRITORY',
              description:
                'The geographic operating area recorded for the franchise profile.',
            },
            {
              label: 'GLOBAL POOL',
              description:
                'Optional direct-entry or advancement pathway outside the ordinary local hierarchy.',
            },
          ]}
          flow={[
            'GLOBAL',
            'CONTINENT',
            'COUNTRY',
            'REGION / CAPITAL',
            'CITY',
            'FESTIVAL',
          ]}
        />

        <View className="gap-2 mt-6">
          {layers.map(
            (
              {
                name,
                detail,
                icon: Icon,
              },
              index
            ) => (
              <View key={name}>
                <View className="rounded-2xl border border-border bg-card p-4 flex-row gap-3 items-start">
                  <Icon
                    color={THEME.accent}
                    size={21}
                  />

                  <View className="flex-1">
                    <Text className="text-headline font-semibold text-card-foreground">
                      {name}
                    </Text>

                    <Text className="text-footnote text-muted-foreground mt-1">
                      {detail}
                    </Text>
                  </View>
                </View>

                {index <
                  layers.length -
                    1 && (
                  <View className="items-center py-1">
                    <ChevronDown
                      color={THEME.muted}
                      size={18}
                    />
                  </View>
                )}
              </View>
            )
          )}
        </View>

        <View className="rounded-2xl border border-border bg-card p-5 mt-8">
          <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
            PLATFORM ADMIN CONTROL
          </Text>

          <Text className="text-title3 font-bold text-card-foreground mt-1">
            Add Franchise / Operator
          </Text>

          <Text className="text-footnote text-muted-foreground mt-2">
            Create the tenant, franchise profile and eight-step onboarding checklist as one controlled transaction.
            Migration 062 enforces the permitted parent → child hierarchy.
          </Text>

          <Text className="text-footnote font-semibold text-card-foreground mt-5 mb-2">
            STEP 1 — CHOOSE FRANCHISE / OPERATOR LEVEL — REQUIRED
          </Text>
          <Text className="text-footnote text-muted-foreground mb-2">
            Choose the level first. The eligible parent choices in Step 2 update automatically.
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {creatableLevels.map((level) => (
              <Pressable
                key={level.value}
                onPress={() => {
                  setNewLevel(level.value);
                  setParentTenantId('');
                  setShowUSStates(false);
                  setUsStateQuery('');
                  setGeographyQuery('');
                  setSelectedCountryCode('');
                  setGeographyMessage('');
                  setCreateMessage('');
                }}
                className={`rounded-xl border px-3 py-2 ${
                  newLevel === level.value
                    ? 'border-primary bg-primary'
                    : 'border-border bg-background'
                }`}
              >
                <Text
                  className={`text-footnote font-semibold ${
                    newLevel === level.value
                      ? 'text-primary-foreground'
                      : 'text-foreground'
                  }`}
                >
                  {level.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="rounded-xl border border-primary bg-background p-3 mt-4">
            <Text className="text-footnote font-bold text-card-foreground">
              SMART GEOGRAPHY FINDER™
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Start typing a country, continent, state/region, city or existing FFOS territory. FFOS will find the geography and help select the correct parent.
            </Text>

            <TextInput
              value={geographyQuery}
              onChangeText={(value) => {
                setGeographyQuery(value);
                setGeographyMessage('');
              }}
              placeholder="e.g. United States, France, California, Queensland..."
              placeholderTextColor={THEME.muted}
              className="rounded-xl border border-border bg-card px-4 py-3 text-foreground mt-3"
            />

            {newLevel === 'region_master' &&
              geographyNeedle.length >= 2 &&
              smartUSStateSuggestions.length > 0 && (
                <View className="gap-2 mt-3">
                  <Text className="text-footnote font-bold text-card-foreground">
                    USA STATE / DISTRICT MATCHES
                  </Text>

                  <Text className="text-footnote text-muted-foreground">
                    Click a State / District once. FFOS will select the United States Country Master parent and populate Step 4 automatically.
                  </Text>

                  {smartUSStateSuggestions.map(
                    (state) => (
                      <Pressable
                        key={`smart-us-${state.code}`}
                        onPress={() =>
                          applyUSStateSuggestion(
                            state
                          )
                        }
                        className="rounded-xl border border-primary bg-card px-4 py-3"
                      >
                        <Text className="text-footnote font-semibold text-foreground">
                          {state.name} ({state.code}) — United States
                        </Text>

                        <Text className="text-footnote text-muted-foreground mt-1">
                          REGION / STATE MASTER
                        </Text>
                      </Pressable>
                    )
                  )}

                  {!usaCountryMaster && (
                    <Text className="text-footnote font-semibold text-primary">
                      USA Country Master has not been created yet.
                    </Text>
                  )}
                </View>
              )}

            {geographyNeedle.length >= 2 &&
              countrySuggestions.length > 0 && (
                <View className="gap-2 mt-3">
                  <Text className="text-footnote font-bold text-card-foreground">
                    COUNTRY / CONTINENT MATCHES
                  </Text>

                  {countrySuggestions.map(
                    (country) => (
                      <Pressable
                        key={country.code}
                        onPress={() =>
                          applyCountrySuggestion(
                            country
                          )
                        }
                        className="rounded-xl border border-border bg-card px-4 py-3"
                      >
                        <Text className="text-footnote font-semibold text-foreground">
                          {country.name} ({country.code}) — {country.continentName}
                        </Text>

                        {!!country.capital && (
                          <Text className="text-footnote text-muted-foreground mt-1">
                            National capital: {country.capital}
                          </Text>
                        )}
                      </Pressable>
                    )
                  )}
                </View>
              )}

            {geographyNeedle.length >= 2 &&
              parentSuggestions.length > 0 && (
                <View className="gap-2 mt-3">
                  <Text className="text-footnote font-bold text-card-foreground">
                    EXISTING FFOS NETWORK MATCHES
                  </Text>

                  {parentSuggestions.map(
                    (row) => (
                      <Pressable
                        key={row.tenant_id}
                        onPress={() =>
                          applyParentSuggestion(
                            row
                          )
                        }
                        className="rounded-xl border border-border bg-card px-4 py-3"
                      >
                        <Text className="text-footnote font-semibold text-foreground">
                          {row.tenant_name}
                        </Text>

                        <Text className="text-footnote text-muted-foreground mt-1">
                          {pretty(
                            row.franchise_level
                          )} · {row.territory_name}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              )}

            {!!geographyMessage && (
              <Text className="text-footnote font-semibold text-primary mt-3">
                {geographyMessage}
              </Text>
            )}
          </View>

          <Text className="text-footnote font-semibold text-card-foreground mt-5 mb-2">
            STEP 2 — SELECT / CONFIRM PARENT FRANCHISE / TERRITORY — REQUIRED
          </Text>

          {eligibleParents.length > 0 && (
            <Text
              className={`text-footnote mb-2 ${
                parentTenantId
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground'
              }`}
            >
              {parentTenantId
                ? '✓ PARENT SELECTED. Now complete Operator / Tenant Name and Territory Name below.'
                : 'IMPORTANT: Seeing a parent below does NOT mean it is selected. Click the required parent box. A gold outline and ✓ SELECTED PARENT confirm your selection.'}
            </Text>
          )}

          {eligibleParents.length > 0 ? (
            <View className="gap-2">
              {eligibleParents.map((row) => (
                <Pressable
                  key={row.tenant_id}
                  onPress={() => {
                    const rowCountryValues = [
                      row.country_code,
                      row.country_name,
                      row.territory_name,
                      row.tenant_name,
                    ].map((value) =>
                      String(value ?? '')
                        .trim()
                        .toUpperCase()
                    );

                    const shouldOpenUSStates =
                      newLevel ===
                        'region_master' &&
                      row.franchise_level ===
                        'country_master' &&
                      rowCountryValues.some(
                        (value) =>
                          value === 'US' ||
                          value === 'USA' ||
                          value ===
                            'UNITED STATES' ||
                          value ===
                            'UNITED STATES OF AMERICA' ||
                          value.includes(
                            'UNITED STATES'
                          )
                      );

                    setParentTenantId(
                      String(row.tenant_id)
                    );
                    setShowUSStates(
                      shouldOpenUSStates
                    );
                    setCreateMessage('');
                  }}
                  className={`rounded-xl border p-3 ${
                    parentTenantId ===
                    String(row.tenant_id)
                      ? 'border-primary bg-background'
                      : 'border-border bg-background'
                  }`}
                >
                  <Text className="font-semibold text-foreground">
                    {row.tenant_name}
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-1">
                    {pretty(
                      row.franchise_level
                    )} · {row.territory_name}
                  </Text>
                  {parentTenantId ===
                    String(row.tenant_id) && (
                    <Text className="text-footnote font-bold text-primary mt-2">
                      ✓ SELECTED PARENT
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          ) : (
            <View className="rounded-xl border border-border bg-background p-3">
              <Text className="text-footnote text-muted-foreground">
                No eligible parent exists for this level yet. Create the required higher-level territory first.
              </Text>
            </View>
          )}

          <Text className="text-footnote font-semibold text-card-foreground mt-5 mb-2">
            STEP 3 — ENTER OPERATOR / TENANT NAME — REQUIRED
          </Text>
          <Text className="text-footnote text-muted-foreground mb-2">
            Enter the actual organisation / operator name. Do not enter the selected level or parent name here.
          </Text>

          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g. Film Festival OS™ Oceania"
            placeholderTextColor={THEME.muted}
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
          />
          {invalidTenantName && (
            <Text className="text-footnote font-semibold text-primary mt-2">
              ⚠ Check Step 3: enter the actual Operator / Tenant Name — not the franchise level or parent name.
            </Text>
          )}

          <Text className="text-footnote font-semibold text-card-foreground mt-4 mb-2">
            STEP 4 — ENTER TERRITORY NAME — REQUIRED
          </Text>
          <Text className="text-footnote text-muted-foreground mb-2">
            Enter the geographic territory this franchise / operator represents, for example Australia, Queensland or Brisbane.
          </Text>

          {isUSCountryParent && (
            <View className="rounded-xl border border-border bg-background p-3 mb-3">
              <Text className="text-footnote font-bold text-card-foreground">
                USA STATE / DISTRICT SELECTOR
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                Select one U.S. state or District of Columbia. The State name and official two-letter abbreviation will populate Step 4.
              </Text>

              <Pressable
                onPress={() => {
                  setUsStateQuery('');
                  setShowUSStates(
                    (current) => !current
                  );
                }}
                className="rounded-xl border border-primary px-4 py-3 mt-3"
              >
                <Text className="text-footnote font-bold text-primary text-center">
                  {showUSStates
                    ? 'CLOSE USA STATE LIST'
                    : 'SELECT USA STATE / DISTRICT'}
                </Text>
              </Pressable>

              {showUSStates && (
                <View className="gap-2 mt-3">
                  <TextInput
                    value={usStateQuery}
                    onChangeText={setUsStateQuery}
                    placeholder="Type state name or abbreviation... e.g. California, CA, Texas"
                    placeholderTextColor={THEME.muted}
                    className="rounded-xl border border-primary bg-card px-4 py-3 text-foreground"
                  />

                  <Text className="text-footnote text-muted-foreground">
                    {filteredUSStateOptions.length} matching state / district option{filteredUSStateOptions.length === 1 ? '' : 's'}
                  </Text>

                  {filteredUSStateOptions.length === 0 && (
                    <View className="rounded-xl border border-border bg-card p-3">
                      <Text className="text-footnote text-muted-foreground">
                        No matching U.S. state or district. Try the full name or two-letter abbreviation.
                      </Text>
                    </View>
                  )}

                  {filteredUSStateOptions.map(
                    (state) => (
                      <Pressable
                        key={state.code}
                        onPress={() => {
                          setNewTerritory(
                            `${state.name} (${state.code})`
                          );
                          setShowUSStates(false);
                          setUsStateQuery('');
                          setCreateMessage('');
                        }}
                        className="rounded-xl border border-border bg-card px-4 py-3"
                      >
                        <Text className="text-footnote font-semibold text-foreground">
                          {state.name} — {state.code}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              )}
            </View>
          )}

          <TextInput
            value={newTerritory}
            onChangeText={(value) => {
              setNewTerritory(value);

              if (
                newLevel ===
                'country_master'
              ) {
                setSelectedCountryCode('');
              }

              setCreateMessage('');
            }}
            placeholder="e.g. Oceania"
            placeholderTextColor={THEME.muted}
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
          />
          {invalidTerritoryName && (
            <Text className="text-footnote font-semibold text-primary mt-2">
              ⚠ Check Step 4: enter the actual Territory Name — not the franchise level or selected parent name.
            </Text>
          )}

          {!!duplicateTerritory && (
            <View className="rounded-xl border border-primary bg-background p-3 mt-3">
              <Text className="text-footnote font-bold text-primary">
                ⚠ TERRITORY ALREADY EXISTS
              </Text>

              <Text className="text-footnote font-semibold text-card-foreground mt-2">
                {duplicateTerritory.territory_name}
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                {pretty(
                  duplicateTerritory.franchise_level
                )} · Parent: {selectedParentName || 'Selected parent'}
              </Text>

              <Text className="text-footnote text-muted-foreground mt-2">
                Use the existing franchise / territory record instead. FFOS has disabled Create to prevent an accidental duplicate.
              </Text>
            </View>
          )}

          {!!createMessage && (
            <View className="rounded-xl border border-border bg-background p-3 mt-4">
              <Text className="text-footnote text-muted-foreground">
                {createMessage}
              </Text>
            </View>
          )}

          <Pressable
            disabled={
              createDisabled
            }
            onPress={async () => {
              setCreating(true);
              setCreateMessage('');

              try {
                await createFranchiseOperatorAtomic({
                  name: newName,
                  franchise_level:
                    newLevel,
                  territory_name:
                    newTerritory,
                  parent_tenant_id:
                    parentTenantId,
                  region_name:
                    newLevel ===
                    'region_master'
                      ? (
                          selectedUSState?.name ??
                          newTerritory.trim()
                        )
                      : undefined,
                  region_code:
                    newLevel ===
                    'region_master'
                      ? selectedUSState?.code
                      : undefined,
                  continent_name:
                    newLevel ===
                    'continent_master'
                      ? newTerritory
                      : undefined,
                  country_name:
                    newLevel ===
                    'country_master'
                      ? newTerritory
                      : undefined,
                  country_code:
                    newLevel ===
                    'country_master'
                      ? (
                          selectedCountryCode ||
                          (
                            isUnitedStatesCountryEntry
                              ? 'US'
                              : undefined
                          )
                        )
                      : undefined,
                  city_name:
                    newLevel ===
                      'capital_city' ||
                    newLevel ===
                      'regional_capital' ||
                    newLevel ===
                      'city_operator'
                      ? newTerritory
                      : undefined,
                });

                setCreateMessage(
                  'PASS: Franchise / operator created and onboarding checklist initialised.'
                );

                setNewName('');
                setNewTerritory('');
                setParentTenantId('');

                await load();
              } catch (error: any) {
                setCreateMessage(
                  error?.message ??
                    'Franchise / operator could not be created.'
                );
              } finally {
                setCreating(false);
              }
            }}
            className={`rounded-xl px-4 py-3 mt-5 ${
              createDisabled
                ? 'bg-muted opacity-60'
                : 'bg-primary'
            }`}
          >
            <Text
              className={`font-bold text-center ${
                createDisabled
                  ? 'text-muted-foreground'
                  : 'text-primary-foreground'
              }`}
            >
              {creating
                ? 'CREATING…'
                : 'CREATE FRANCHISE / OPERATOR'}
            </Text>
          </Pressable>

          <Text className="text-footnote text-muted-foreground mt-3">
            Platform Admin only. The database validates hierarchy and rolls back the whole operation if any step fails.
          </Text>
        </View>

        <View className="flex-row items-center justify-between mt-8 mb-3">
          <View>
            <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
              LIVE REGISTER
            </Text>

            <Text className="text-title3 font-bold text-foreground mt-1">
              Franchise Network
            </Text>
          </View>

          <Pressable
            onPress={load}
            className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center"
          >
            <RefreshCw
              color={THEME.accent}
              size={18}
            />
          </Pressable>
        </View>

        {!!message && (
          <View className="rounded-2xl border border-border bg-card p-4 mb-3">
            <Text className="font-semibold text-card-foreground">
              Franchise foundation status
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              {message}
            </Text>
          </View>
        )}

        {rows.map((row) => (
          <View
            key={row.id}
            className="rounded-2xl border border-border bg-card p-4 mb-3"
          >
            <Text className="text-headline font-semibold text-card-foreground">
              {row.tenant_name}
            </Text>

            <Text className="text-footnote font-semibold text-primary mt-1">
              {pretty(
                row.franchise_level
              )}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-2">
              Territory: {row.territory_name}
            </Text>

            {!!row.parent_tenant_name && (
              <Text className="text-footnote text-muted-foreground mt-1">
                Parent: {row.parent_tenant_name}
              </Text>
            )}

            <Text className="text-footnote text-muted-foreground mt-1">
              Status: {pretty(row.status)}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Territory exclusivity: {row.exclusive_territory ? 'RECORDED' : 'NOT RECORDED'}
            </Text>
          </View>
        ))}

        {!message &&
          !refreshing &&
          rows.length === 0 && (
            <View className="rounded-2xl border border-border bg-card p-5">
              <Text className="font-semibold text-card-foreground">
                No franchise profiles yet
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                The hierarchy is ready. Create the Global HQ root profile to initialise the live franchise register.
              </Text>

              <Pressable
                disabled={bootstrapping}
                onPress={async () => {
                  setBootstrapping(true);
                  setMessage('');

                  try {
                    await bootstrapGlobalHqProfile();
                    await load();
                  } catch (error: any) {
                    setMessage(
                      error?.message ??
                        'Global HQ profile could not be created.'
                    );
                  } finally {
                    setBootstrapping(false);
                  }
                }}
                className="mt-4 rounded-xl border border-border px-4 py-3 self-start"
              >
                <Text className="font-semibold text-foreground">
                  {bootstrapping
                    ? 'CREATING GLOBAL HQ...'
                    : 'INITIALISE GLOBAL HQ PROFILE'}
                </Text>
              </Pressable>
            </View>
          )}
      </ScrollView>
    </View>
  );
}
