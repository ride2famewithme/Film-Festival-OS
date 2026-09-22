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
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  ArrowLeft,
  Award,
  Gem,
  Link as LinkIcon,
  RefreshCw,
} from 'lucide-react-native';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import QuickGuideHelp from '@/components/QuickGuideHelp';

import {
  getDigitalAwardPackage,
  getDigitalAwardRecipientNotice,
  queueDigitalAwardRecipientNotice,
  updateDigitalAwardControls,
} from '@/data/workflows/digital-awards';

const placements = [
  ['winner', 'WINNER / 1ST PLACE'],
  ['second_place', '2ND PLACE'],
  ['third_place', '3RD PLACE'],
  ['jury_choice', "JURY'S CHOICE"],
  ['audience_choice', 'AUDIENCE / PUBLIC CHOICE'],
  ['special_recognition', 'SPECIAL RECOGNITION'],
] as const;

const designs = [
  ['golden', 'GOLDEN WINNER'],
  ['platinum', 'PLATINUM EXCELLENCE'],
  ['diamond', 'DIAMOND DISTINCTION'],
  ['ruby', 'RUBY MERIT'],
  ['sapphire', 'SAPPHIRE MERIT'],
  ['emerald', 'EMERALD MERIT'],
  ['pearl', 'PEARL RECOGNITION'],
  ['silver', 'SILVER'],
  ['bronze', 'BRONZE'],
  ['special', 'SPECIAL FESTIVAL DESIGN'],
] as const;

export default function DigitalAwardScreen() {
  const i = useSafeAreaInsets();

  const params =
    useLocalSearchParams<{
      awardId?: string;
    }>();

  const awardId =
    String(params.awardId ?? '');

  const [pkg, setPkg] =
    useState<any>(null);

  const [busy, setBusy] =
    useState(false);

  const [awardEnabled, setAwardEnabled] =
    useState(true);

  const [nftEnabled, setNftEnabled] =
    useState(true);

  const [placement, setPlacement] =
    useState('winner');

  const [design, setDesign] =
    useState('golden');

  const [assetUrl, setAssetUrl] =
    useState('');

  const [nftUrl, setNftUrl] =
    useState('');

  const [
    marketplaceUrl,
    setMarketplaceUrl,
  ] = useState('');

  const [recipientNotice, setRecipientNotice] =
    useState<any>(null);

  const [noticeStatus, setNoticeStatus] =
    useState('');

  const load = async () => {
    if (!awardId)
      return Alert.alert(
        'Digital Award',
        'Award ID missing.'
      );

    try {
      const data =
        await getDigitalAwardPackage(
          awardId
        );

      setPkg(data);

      const o = data.output ?? {};

      setAwardEnabled(
        o.award_enabled !== false
      );

      setNftEnabled(
        o.nft_enabled !== false
      );

      setPlacement(
        o.placement || 'winner'
      );

      setDesign(
        o.placement === 'winner'
          ? 'golden'
          : o.design_style ||
            'golden'
      );

      setAssetUrl(
        o.asset_url || ''
      );

      setNftUrl(
        o.nft_url || ''
      );

      setMarketplaceUrl(
        o.marketplace_url || ''
      );

      try {
        const notice =
          await getDigitalAwardRecipientNotice(
            awardId
          );

        setRecipientNotice(notice);
      } catch {
        setRecipientNotice(null);
      }
    } catch (e: any) {
      Alert.alert(
        'Digital Award',
        e?.message || String(e)
      );
    }
  };

  useEffect(() => {
    void load();
  }, [awardId]);

  const queueRecipientNotice =
    async () => {
      setBusy(true);
      setNoticeStatus('');

      try {
        const result =
          await queueDigitalAwardRecipientNotice(
            awardId
          );

        setNoticeStatus(
          result?.alreadyQueued
            ? 'NFT recipient notice already queued — no duplicate created.'
            : 'NFT recipient notice queued successfully.'
        );
      } catch (e: any) {
        Alert.alert(
          'NFT Recipient Notice',
          e?.message || String(e)
        );
      } finally {
        setBusy(false);
      }
    };


  const save = async () => {
    if (!pkg?.output?.id)
      return;

    setBusy(true);

    try {
      await updateDigitalAwardControls(
        pkg.output.id,
        {
          award_enabled:
            awardEnabled,
          nft_enabled:
            nftEnabled,
          placement,
          design_style:
            placement === 'winner'
              ? 'golden'
              : design,
          asset_url:
            assetUrl,
          nft_url:
            nftUrl,
          marketplace_url:
            marketplaceUrl,
        }
      );

      await load();

      Alert.alert(
        'Digital Award',
        'Award controls saved.'
      );
    } catch (e: any) {
      Alert.alert(
        'Digital Award',
        e?.message || String(e)
      );
    } finally {
      setBusy(false);
    }
  };

  const verificationUrl =
    awardId
      ? `https://filmfestivalos.com/award/${awardId}`
      : '';

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingTop: i.top + 12,
          paddingBottom:
            i.bottom + 40,
          paddingHorizontal: 20,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft
            size={19}
            color={THEME.accent}
          />
        </Pressable>

        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
          FILM FESTIVAL OS™
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          Digital Award / NFT Registry™
        </Text>

        <Text className="text-subhead text-muted-foreground mt-1 mb-5">
          Controlled digital-award settings for a published festival result.
        </Text>

        <QuickGuideHelp
          purpose="Create, verify and notify a recipient about an approved Film Festival OS™ Digital / NFT Award without confusing minting cost, suggested resale value or ownership."
          steps={[
            'Confirm AWARD and NFT / DIGITAL AWARD are ON.',
            'Confirm the correct placement: Winner, 2nd, 3rd, Jury Choice, Audience Choice or Special Recognition.',
            'Confirm the merit design. Winner / 1st Place always uses GOLDEN by default.',
            'After the NFT is genuinely minted, paste the NFT / token URL and optional marketplace URL.',
            'Click SAVE DIGITAL AWARD CONTROLS before sending any recipient notice.',
            'Check the recipient, award placement, design and suggested resale / fundraising ETH value.',
            'Click QUEUE NFT RECIPIENT NOTICE only after the real NFT link has been saved.',
            'Use OPEN LAUREL GENERATOR for the verified downloadable festival laurel.',
          ]}
          terms={[
            {
              label: 'MINT COST',
              description: 'What the festival may pay to mint or transfer the NFT. This is separate from the suggested resale value.',
            },
            {
              label: 'SUGGESTED RESALE / FUNDRAISING VALUE',
              description: 'An ETH amount suggested by authorised festival management. It is not prepaid cryptocurrency and is not a guaranteed market price.',
            },
            {
              label: 'NFT / TOKEN URL',
              description: 'The real blockchain or provider link for the minted digital award. Do not use a fake or placeholder URL.',
            },
            {
              label: 'MARKETPLACE URL',
              description: 'Optional public marketplace link such as a compatible NFT marketplace where the recipient may later view or list the NFT.',
            },
            {
              label: 'FFOS VERIFICATION URL',
              description: 'Permanent Film Festival OS™ verification path for the award record. Marketplace links may change without changing this FFOS record.',
            },
            {
              label: 'RECIPIENT OWNERSHIP',
              description: 'After transfer, the recipient may keep, transfer or list the NFT and may choose their own marketplace price.',
            },
          ]}
          flow={[
            'PUBLISHED AWARD',
            'DIGITAL AWARD / NFT REGISTRY',
            'SAVE REAL NFT LINK',
            'VERIFY VALUE + RECIPIENT',
            'QUEUE NFT NOTICE',
            'LAUREL / VERIFICATION',
          ]}
        />

        <View className="rounded-2xl border border-primary bg-card p-4 mt-4 mb-5">
          <Text className="font-bold text-primary">
            NFT AWARD WORKFLOW — KISS
          </Text>

          <Text className="text-footnote text-card-foreground mt-2">
            Award Decisions → Laurel / Digital Award → Generate Laurel / Digital Award → NFT Recipient Notice™
          </Text>

          <Text className="text-footnote text-muted-foreground mt-2">
            Never queue the NFT notice until the real NFT / token URL has been saved.
          </Text>

          <Text className="text-footnote text-muted-foreground mt-2">
            Minting cost and Suggested Resale / Fundraising Value are two completely separate amounts.
          </Text>
        </View>


        {!!pkg && (
          <>
            <View className="rounded-3xl border border-border bg-card p-4 mb-4">
              <View className="flex-row items-center gap-2">
                <Award
                  size={18}
                  color={THEME.accent}
                />

                <Text className="text-headline font-semibold text-card-foreground">
                  {pkg.award?.award_name}
                </Text>
              </View>

              <Text className="text-footnote text-muted-foreground mt-2">
                Film: {pkg.submission?.title}
              </Text>

              <Text className="text-footnote text-muted-foreground">
                Festival: {pkg.festivalName}
              </Text>

              <Text className="text-footnote text-muted-foreground">
                Year: {pkg.year}
              </Text>
            </View>

            <View className="rounded-3xl border border-border bg-card p-4 mb-4">
              <Text className="text-headline font-semibold text-card-foreground mb-3">
                Award Controls
              </Text>

              <Pressable
                onPress={() =>
                  setAwardEnabled(
                    !awardEnabled
                  )
                }
                className="rounded-xl border border-primary px-4 py-3 mb-2"
              >
                <Text className="font-bold text-primary text-center">
                  AWARD: {awardEnabled
                    ? 'ON'
                    : 'OFF'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  setNftEnabled(
                    !nftEnabled
                  )
                }
                className="rounded-xl border border-primary px-4 py-3"
              >
                <Text className="font-bold text-primary text-center">
                  NFT / DIGITAL AWARD:{' '}
                  {nftEnabled
                    ? 'ON'
                    : 'OFF'}
                </Text>
              </Pressable>

              <Text className="text-footnote text-muted-foreground mt-3">
                Default is ON. Authorised management may switch individual awards OFF according to season, budget, eligibility and operational capacity.
              </Text>
            </View>

            <View className="rounded-3xl border border-border bg-card p-4 mb-4">
              <Text className="text-headline font-semibold text-card-foreground mb-3">
                Placement / Merit
              </Text>

              <View className="flex-row flex-wrap gap-2">
                {placements.map(
                  ([key, label]) => (
                    <Pressable
                      key={key}
                      onPress={() => {
                        setPlacement(
                          key
                        );

                        if (
                          key ===
                          'winner'
                        ) {
                          setDesign(
                            'golden'
                          );
                        }
                      }}
                      className={`rounded-full border px-3 py-2 ${
                        placement ===
                        key
                          ? 'border-primary bg-primary'
                          : 'border-border bg-background'
                      }`}
                    >
                      <Text
                        className={
                          placement ===
                          key
                            ? 'text-primary-foreground'
                            : 'text-foreground'
                        }
                      >
                        {label}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>
            </View>

            <View className="rounded-3xl border border-border bg-card p-4 mb-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Gem
                  size={18}
                  color={THEME.accent}
                />

                <Text className="text-headline font-semibold text-card-foreground">
                  Merit Design
                </Text>
              </View>

              {placement ===
              'winner' ? (
                <View className="rounded-xl border border-primary p-3">
                  <Text className="font-bold text-primary">
                    GOLDEN WINNER — LOCKED DEFAULT
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-1">
                    First-place Winner awards always use the premium FFOS Golden Winner design.
                  </Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {designs.map(
                    ([key, label]) => (
                      <Pressable
                        key={key}
                        onPress={() =>
                          setDesign(
                            key
                          )
                        }
                        className={`rounded-full border px-3 py-2 ${
                          design === key
                            ? 'border-primary bg-primary'
                            : 'border-border bg-background'
                        }`}
                      >
                        <Text
                          className={
                            design ===
                            key
                              ? 'text-primary-foreground'
                              : 'text-foreground'
                          }
                        >
                          {label}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              )}
            </View>

            <View className="rounded-3xl border border-border bg-card p-4 mb-4">
              <View className="flex-row items-center gap-2 mb-3">
                <LinkIcon
                  size={18}
                  color={THEME.accent}
                />

                <Text className="text-headline font-semibold text-card-foreground">
                  Award Asset / NFT Links
                </Text>
              </View>

              <TextInput
                value={assetUrl}
                onChangeText={
                  setAssetUrl
                }
                placeholder="Award image / downloadable asset URL"
                placeholderTextColor={
                  THEME.muted
                }
                className="rounded-xl border border-border bg-background px-4 py-3 text-foreground mb-2"
              />

              <TextInput
                value={nftUrl}
                onChangeText={
                  setNftUrl
                }
                placeholder="NFT / token URL"
                placeholderTextColor={
                  THEME.muted
                }
                className="rounded-xl border border-border bg-background px-4 py-3 text-foreground mb-2"
              />

              <TextInput
                value={marketplaceUrl}
                onChangeText={
                  setMarketplaceUrl
                }
                placeholder="Marketplace URL — e.g. Rarible / Crossmint / OpenSea"
                placeholderTextColor={
                  THEME.muted
                }
                className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
              />
            </View>

            <View className="rounded-3xl border border-primary bg-card p-4 mb-4">
              <Text className="text-headline font-semibold text-card-foreground">
                NFT Recipient Notice™
              </Text>

              <Text className="text-footnote text-muted-foreground mt-2">
                Separate from the original award-decision notification.
                Queue this only after the NFT has been minted and its NFT / token URL has been saved.
              </Text>

              {!!recipientNotice && (
                <>
                  <Text className="text-footnote font-semibold text-card-foreground mt-4">
                    Recipient
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-1">
                    {recipientNotice.submission?.email || 'No recipient email'}
                  </Text>

                  <Text className="text-footnote font-semibold text-card-foreground mt-3">
                    Placement / Design
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-1">
                    {recipientNotice.placementLabel}
                    {' · '}
                    {String(recipientNotice.designStyle).toUpperCase()}
                  </Text>

                  <Text className="text-footnote font-semibold text-card-foreground mt-3">
                    Suggested Resale / Fundraising Value
                  </Text>

                  <Text className="text-headline font-bold text-primary mt-1">
                    {recipientNotice.suggestedEth} ETH
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-2">
                    Not prepaid cryptocurrency and not a guaranteed market value.
                    After transfer, the recipient may keep the NFT, transfer it,
                    use the suggested amount as a fundraising target, or set their own marketplace listing price.
                  </Text>
                </>
              )}

              <Pressable
                disabled={
                  busy ||
                  !nftEnabled ||
                  !nftUrl.trim()
                }
                onPress={() =>
                  void queueRecipientNotice()
                }
                className={`rounded-xl px-4 py-3 mt-4 ${
                  nftEnabled &&
                  nftUrl.trim()
                    ? 'bg-primary'
                    : 'bg-muted opacity-60'
                }`}
              >
                <Text
                  className={`font-bold text-center ${
                    nftEnabled &&
                    nftUrl.trim()
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {!nftUrl.trim()
                    ? 'SAVE NFT LINK BEFORE QUEUEING'
                    : 'QUEUE NFT RECIPIENT NOTICE'}
                </Text>
              </Pressable>

              {!!noticeStatus && (
                <Text className="text-footnote text-primary mt-2">
                  {noticeStatus}
                </Text>
              )}
            </View>


            <View className="rounded-3xl border border-border bg-card p-4 mb-4">
              <Text className="font-semibold text-card-foreground">
                Reserved FFOS Verification URL
              </Text>

              <Text className="text-footnote text-primary mt-2">
                {verificationUrl}
              </Text>

              <Text className="text-footnote text-muted-foreground mt-2">
                This permanent FFOS path is reserved for the future public award-verification page so marketplace links may change without invalidating the award QR.
              </Text>
            </View>

            <Pressable
              onPress={save}
              disabled={busy}
              className="rounded-xl bg-primary px-4 py-3 mb-3"
            >
              <Text className="font-bold text-primary-foreground text-center">
                {busy
                  ? 'SAVING…'
                  : 'SAVE DIGITAL AWARD CONTROLS'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                router.push({
                  pathname:
                    '/laurel-generator',
                  params: {
                    awardId,
                  },
                } as any)
              }
              className="rounded-xl border border-primary px-4 py-3"
            >
              <Text className="font-bold text-primary text-center">
                OPEN LAUREL GENERATOR
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                void load()
              }
              className="self-end mt-4"
            >
              <RefreshCw
                size={19}
                color={THEME.accent}
              />
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}
