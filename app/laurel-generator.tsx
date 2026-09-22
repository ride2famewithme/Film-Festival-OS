import { goWorkspaceHome } from '@/lib/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  ArrowLeft,
  Award,
  Download,
  ShieldCheck,
} from 'lucide-react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import * as QRCode from 'qrcode';

import {
  getLaurelPackage,
} from '@/data/workflows/laurel-generator';


function esc(v: unknown) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}



function makeQrSvg(value: string) {
  const qr = QRCode.create(
    value,
    {
      errorCorrectionLevel: 'M',
    }
  );

  const modules: any =
    qr.modules;

  const size =
    Number(modules.size);

  const quietZone = 4;
  const boxSize = 170;

  const cell =
    boxSize /
    (size + quietZone * 2);

  let blocks = '';

  for (
    let row = 0;
    row < size;
    row += 1
  ) {
    for (
      let col = 0;
      col < size;
      col += 1
    ) {
      const dark =
        Number(
          modules.data[
            row * size + col
          ]
        ) !== 0;

      if (!dark)
        continue;

      const x =
        (col + quietZone) * cell;

      const y =
        (row + quietZone) * cell;

      blocks +=
        `<rect x="${x.toFixed(3)}" ` +
        `y="${y.toFixed(3)}" ` +
        `width="${cell.toFixed(3)}" ` +
        `height="${cell.toFixed(3)}" ` +
        `fill="#090909"/>`;
    }
  }

  return `
  <!-- FFOS PERMANENT VERIFICATION QR -->
  <g transform="translate(1365 735)">
    <rect
      x="0"
      y="0"
      width="${boxSize}"
      height="${boxSize}"
      rx="8"
      fill="#FFFFFF"
    />

    <g shape-rendering="crispEdges">
      ${blocks}
    </g>

    <text
      x="${boxSize / 2}"
      y="195"
      text-anchor="middle"
      fill="#B88A2A"
      font-family="Arial, sans-serif"
      font-size="18"
      font-weight="bold">
      SCAN TO VERIFY
    </text>
  </g>`;
}


function makeSvg(data: any) {
  const festival = esc(data.festivalName);
  const award = esc(data.award.award_name);
  const film = esc(data.submission.title);
  const year = esc(data.year);
  const code = esc(data.output.verification_code);

  const verificationUrl =
    `https://filmfestivalos.com/award/${String(data.award.id)}`;

  const verificationQr =
    makeQrSvg(verificationUrl);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="1600"
     height="1000"
     viewBox="0 0 1600 1000">

  <rect width="1600"
        height="1000"
        fill="#090909"/>

  <rect x="35"
        y="35"
        width="1530"
        height="930"
        rx="38"
        fill="none"
        stroke="#B88A2A"
        stroke-width="6"/>

  <!-- LEFT LAUREL -->
  <path d="M420 790
           C250 650 230 390 405 205"
        fill="none"
        stroke="#B88A2A"
        stroke-width="16"
        stroke-linecap="round"/>

  <g fill="#B88A2A">
    <ellipse cx="335" cy="680" rx="33" ry="75"
             transform="rotate(-52 335 680)"/>
    <ellipse cx="290" cy="585" rx="33" ry="75"
             transform="rotate(-43 290 585)"/>
    <ellipse cx="282" cy="480" rx="33" ry="75"
             transform="rotate(-29 282 480)"/>
    <ellipse cx="315" cy="375" rx="33" ry="75"
             transform="rotate(-12 315 375)"/>
    <ellipse cx="370" cy="285" rx="33" ry="75"
             transform="rotate(10 370 285)"/>
  </g>

  <!-- RIGHT LAUREL -->
  <path d="M1180 790
           C1350 650 1370 390 1195 205"
        fill="none"
        stroke="#B88A2A"
        stroke-width="16"
        stroke-linecap="round"/>

  <g fill="#B88A2A">
    <ellipse cx="1265" cy="680" rx="33" ry="75"
             transform="rotate(52 1265 680)"/>
    <ellipse cx="1310" cy="585" rx="33" ry="75"
             transform="rotate(43 1310 585)"/>
    <ellipse cx="1318" cy="480" rx="33" ry="75"
             transform="rotate(29 1318 480)"/>
    <ellipse cx="1285" cy="375" rx="33" ry="75"
             transform="rotate(12 1285 375)"/>
    <ellipse cx="1230" cy="285" rx="33" ry="75"
             transform="rotate(-10 1230 285)"/>
  </g>

  <text x="800"
        y="185"
        text-anchor="middle"
        fill="#B88A2A"
        font-family="Georgia, serif"
        font-size="54"
        font-weight="bold">
    ${festival}
  </text>

  <text x="800"
        y="335"
        text-anchor="middle"
        fill="#FFFFFF"
        font-family="Arial, sans-serif"
        font-size="42"
        letter-spacing="6">
    OFFICIAL FESTIVAL LAUREL
  </text>

  <text x="800"
        y="475"
        text-anchor="middle"
        fill="#B88A2A"
        font-family="Georgia, serif"
        font-size="88"
        font-weight="bold">
    ${award}
  </text>

  <text x="800"
        y="605"
        text-anchor="middle"
        fill="#FFFFFF"
        font-family="Arial, sans-serif"
        font-size="48"
        font-weight="bold">
    ${film}
  </text>

  <text x="800"
        y="710"
        text-anchor="middle"
        fill="#B88A2A"
        font-family="Arial, sans-serif"
        font-size="54"
        font-weight="bold">
    ${year}
  </text>

  <line x1="570"
        y1="775"
        x2="1030"
        y2="775"
        stroke="#B88A2A"
        stroke-width="3"/>

  <text x="800"
        y="835"
        text-anchor="middle"
        fill="#CCCCCC"
        font-family="Arial, sans-serif"
        font-size="25"
        letter-spacing="3">
    VERIFICATION ${code}
  </text>

  <text x="800"
        y="900"
        text-anchor="middle"
        fill="#777777"
        font-family="Arial, sans-serif"
        font-size="20">
    Generated by Film Festival OS™ Laurel Generator™
  </text>


  ${verificationQr}

</svg>`;
}


export default function LaurelGenerator() {
  const i = useSafeAreaInsets();

  const params =
    useLocalSearchParams<{ awardId?: string }>();

  const awardId =
    String(params.awardId ?? '');

  const [data, setData] =
    useState<any>(null);

  const [busy, setBusy] =
    useState(true);


  useEffect(() => {
    (async () => {
      try {
        if (!awardId)
          throw new Error('Award ID missing');

        const result =
          await getLaurelPackage(awardId);

        setData(result);
      } catch (e: any) {
        Alert.alert(
          'Laurel Generator',
          e.message
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [awardId]);


  const svg = useMemo(
    () => data ? makeSvg(data) : '',
    [data]
  );


  const download = () => {
    if (!data || !svg)
      return;

    if (Platform.OS !== 'web') {
      Alert.alert(
        'SVG ready',
        'Web download is enabled. Native sharing/export can be added in the mobile release.'
      );
      return;
    }

    const doc =
      (globalThis as any).document;

    const URLObj =
      (globalThis as any).URL;

    if (!doc || !URLObj) {
      Alert.alert(
        'Download',
        'Browser download is unavailable.'
      );
      return;
    }

    const blob =
      new Blob(
        [svg],
        {
          type: 'image/svg+xml;charset=utf-8',
        }
      );

    const url =
      URLObj.createObjectURL(blob);

    const a =
      doc.createElement('a');

    const safe =
      `${data.festivalName}-${data.award.award_name}-${data.year}`
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '');

    a.href = url;
    a.download =
      `${safe}-LAUREL.svg`;

    doc.body.appendChild(a);
    a.click();
    a.remove();

    URLObj.revokeObjectURL(url);
  };


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
          <ArrowLeft
            color={THEME.accent}
            size={19}
          />
        </Pressable>


        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
          REAL WORKFLOW
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          Laurel Generator™
        </Text>

        <Text className="text-subhead text-muted-foreground mt-1 mb-5">
          Tenant-branded verified laurels generated only from published,
          competition-eligible awards.
        </Text>


        {busy && (
          <Text className="text-muted-foreground">
            Generating verified laurel…
          </Text>
        )}


        {data && (
          <>
            <View className="rounded-3xl border border-border bg-card p-5">

              <View className="flex-row items-center gap-2">
                <Award
                  size={21}
                  color={THEME.accent}
                />

                <Text className="text-title3 font-bold text-card-foreground">
                  {data.award.award_name}
                </Text>
              </View>


              <Text className="text-headline font-semibold text-primary mt-4">
                {data.festivalName}
              </Text>

              <Text className="text-subhead text-card-foreground mt-2">
                {data.submission.title}
              </Text>

              <Text className="text-footnote text-muted-foreground mt-2">
                Year: {data.year}
              </Text>


              <View className="rounded-xl border border-primary p-3 mt-4">
                <View className="flex-row items-center gap-2">

                  <ShieldCheck
                    size={18}
                    color={THEME.accent}
                  />

                  <Text className="font-bold text-primary">
                    VERIFIED FESTIVAL OUTPUT
                  </Text>

                </View>

                <Text className="text-footnote text-muted-foreground mt-2">
                  Verification code:
                  {' '}
                  {data.output.verification_code}
                </Text>
              </View>


              <Pressable
                onPress={download}
                className="rounded-xl bg-primary px-4 py-3 mt-5 flex-row justify-center items-center gap-2"
              >
                <Download
                  size={18}
                  color={THEME.primaryFg}
                />

                <Text className="font-bold text-primary-foreground">
                  Download SVG Laurel
                </Text>
              </Pressable>

            </View>


            <View className="rounded-2xl border border-border bg-card p-4 mt-4">
              <Text className="font-semibold text-card-foreground">
                Laurel Generator™ V1
              </Text>

              <Text className="text-footnote text-muted-foreground mt-2">
                Neutral black/gold fallback template.
                Future franchise branding can replace logo,
                colours and typography without changing award verification.
              </Text>
            </View>
          </>
        )}

      </ScrollView>
    </View>
  );
}
