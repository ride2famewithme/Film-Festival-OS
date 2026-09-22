import {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  BadgeCheck,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react-native';

import {
  useLocalSearchParams,
} from 'expo-router';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  THEME,
} from '@/constants/theme';

import {
  getPublicAwardVerification,
  PublicAwardVerification,
} from '@/data/workflows/public-award-verification';


function prettyPlacement(
  value?: string | null
) {
  const v =
    String(value || '')
      .trim();

  const labels:
    Record<string, string> = {
      winner:
        'Winner / 1st Place',
      second_place:
        '2nd Place',
      third_place:
        '3rd Place',
      jury_choice:
        "Jury's Choice",
      audience_choice:
        'Audience / Public Choice',
      special_recognition:
        'Special Recognition',
    };

  return (
    labels[v] ||
    v
      .replace(/_/g, ' ')
      .replace(
        /\b\w/g,
        (m) => m.toUpperCase()
      ) ||
    'Award'
  );
}


export default function PublicAwardVerificationScreen() {
  const insets =
    useSafeAreaInsets();

  const { id } =
    useLocalSearchParams<{
      id?: string;
    }>();

  const awardId =
    String(id ?? '');

  const [data, setData] =
    useState<
      PublicAwardVerification | null
    >(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');


  useEffect(() => {

    let active = true;

    async function load() {

      setLoading(true);
      setError('');

      try {

        const row =
          await getPublicAwardVerification(
            awardId
          );

        if (!active)
          return;

        setData(row);

      } catch (e: any) {

        if (!active)
          return;

        setError(
          e?.message ||
          'Verification service unavailable.'
        );

      } finally {

        if (active)
          setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };

  }, [awardId]);


  return (
    <View className="flex-1 bg-background">

      <ScrollView
        contentContainerStyle={{
          paddingTop:
            insets.top + 24,
          paddingBottom:
            insets.bottom + 48,
          paddingHorizontal: 20,
        }}
      >

        <View className="items-center mb-6">

          <ShieldCheck
            size={48}
            color={THEME.accent}
          />

          <Text className="text-footnote font-bold uppercase tracking-widest text-primary mt-3">
            FILM FESTIVAL OS™
          </Text>

          <Text className="text-title1 font-bold text-foreground text-center mt-1">
            Award Verification™
          </Text>

          <Text className="text-subhead text-muted-foreground text-center mt-2">
            Independent public verification of a published festival award record.
          </Text>

        </View>


        {loading && (

          <View className="items-center py-12">
            <ActivityIndicator
              color={THEME.accent}
            />

            <Text className="text-footnote text-muted-foreground mt-3">
              Verifying award…
            </Text>
          </View>

        )}


        {!loading && !!error && (

          <View className="rounded-3xl border border-primary bg-card p-5">

            <Text className="text-title3 font-bold text-primary">
              VERIFICATION SERVICE ERROR
            </Text>

            <Text className="text-body text-card-foreground mt-2">
              {error}
            </Text>

          </View>

        )}


        {!loading &&
          !error &&
          !data && (

          <View className="rounded-3xl border border-border bg-card p-5">

            <Text className="text-title2 font-bold text-foreground">
              NOT VERIFIED
            </Text>

            <Text className="text-body text-muted-foreground mt-2">
              No published Film Festival OS™ award record was found for this verification ID.
            </Text>

            <Text className="text-footnote text-muted-foreground mt-4">
              Award ID: {awardId || 'Not supplied'}
            </Text>

          </View>

        )}


        {!loading &&
          !error &&
          data && (

          <>

            <View className="rounded-3xl border border-primary bg-card p-5">

              <View className="flex-row items-center gap-2">

                <BadgeCheck
                  size={24}
                  color={THEME.accent}
                />

                <Text className="text-title2 font-bold text-primary">
                  VERIFIED
                </Text>

              </View>


              <Text className="text-display font-bold text-foreground mt-5">
                {data.award_name}
              </Text>

              <Text className="text-title3 text-card-foreground mt-2">
                {data.project_title}
              </Text>

              {!!data.creator_name && (

                <Text className="text-subhead text-muted-foreground mt-1">
                  {data.creator_name}
                </Text>

              )}


              <View className="rounded-2xl border border-border bg-background p-4 mt-5">

                <Text className="text-footnote text-muted-foreground">
                  Festival
                </Text>

                <Text className="text-headline font-semibold text-card-foreground mt-1">
                  {data.festival_name}
                </Text>


                <Text className="text-footnote text-muted-foreground mt-4">
                  Result / Placement
                </Text>

                <Text className="text-headline font-semibold text-card-foreground mt-1">
                  {prettyPlacement(
                    data.placement
                  )}
                </Text>


                <Text className="text-footnote text-muted-foreground mt-4">
                  Festival Year
                </Text>

                <Text className="text-headline font-semibold text-card-foreground mt-1">
                  {data.award_year}
                </Text>


                <Text className="text-footnote text-muted-foreground mt-4">
                  Merit Design
                </Text>

                <Text className="text-headline font-semibold text-card-foreground mt-1">
                  {String(
                    data.design_style ||
                    'golden'
                  ).toUpperCase()}
                </Text>


                <Text className="text-footnote text-muted-foreground mt-4">
                  Verification Code
                </Text>

                <Text className="text-headline font-semibold text-primary mt-1">
                  {data.verification_code ||
                    'Published award record verified'}
                </Text>


                <Text className="text-footnote text-muted-foreground mt-4">
                  Award ID
                </Text>

                <Text className="text-footnote text-card-foreground mt-1">
                  {data.award_id}
                </Text>

              </View>


              {!!data.nft_url && (

                <Pressable
                  onPress={() =>
                    void Linking.openURL(
                      data.nft_url!
                    )
                  }
                  className="rounded-xl border border-primary px-4 py-3 mt-4"
                >
                  <View className="flex-row justify-center items-center gap-2">

                    <ExternalLink
                      size={16}
                      color={
                        THEME.accent
                      }
                    />

                    <Text className="font-bold text-primary">
                      OPEN VERIFIED NFT
                    </Text>

                  </View>
                </Pressable>

              )}


              {!!data.marketplace_url && (

                <Pressable
                  onPress={() =>
                    void Linking.openURL(
                      data.marketplace_url!
                    )
                  }
                  className="rounded-xl border border-border px-4 py-3 mt-3"
                >
                  <Text className="font-bold text-center text-card-foreground">
                    OPEN MARKETPLACE LISTING
                  </Text>
                </Pressable>

              )}

            </View>


            <Text className="text-footnote text-muted-foreground text-center mt-5">
              This page verifies the published Film Festival OS™ award record only.
              Marketplace ownership, resale price and external blockchain services may change independently.
            </Text>

          </>

        )}

      </ScrollView>

    </View>
  );
}
