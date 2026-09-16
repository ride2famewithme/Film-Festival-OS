import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle2, Github, KeyRound, LockKeyhole, QrCode, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@/constants/theme';
import { requireSupabaseClient } from '@/data/supabase-client';

const securityClient = requireSupabaseClient();

async function getTotpFactors() {
  return securityClient.auth.mfa.listFactors();
}

async function enrollTotp() {
  return securityClient.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Film Festival OS Platform Admin',
  });
}

async function verifyTotpEnrollment(factorId: string, code: string) {
  const challenge = await securityClient.auth.mfa.challenge({ factorId });
  if (challenge.error || !challenge.data) return challenge;
  return securityClient.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
}

async function unenrollTotp(factorId: string) {
  return securityClient.auth.mfa.unenroll({ factorId });
}

async function linkGitHubIdentity() {
  const { data: sessionData, error: sessionError } = await securityClient.auth.getSession();
  if (sessionError) return { data: null, error: sessionError };
  if (!sessionData.session) {
    return {
      data: null,
      error: new Error('Sign in to Film Festival OS™ before linking GitHub.'),
    };
  }

  const redirectTo =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/global-hq`
      : undefined;

  return securityClient.auth.linkIdentity({
    provider: 'github',
    options: redirectTo ? { redirectTo } : undefined,
  });
}

function normalizeQrSource(value: string) {
  const qr = value.trim();
  if (!qr) return '';
  if (qr.startsWith('data:') || qr.startsWith('http://') || qr.startsWith('https://')) return qr;
  if (qr.startsWith('<svg')) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`;
  }
  return qr;
}

type Factor = {
  id: string;
  friendly_name?: string | null;
  factor_type?: string;
  status?: string;
};

export default function SecurityCentreScreen() {
  const insets = useSafeAreaInsets();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const verifiedTotp = useMemo(
    () => factors.find((factor) => factor.factor_type === 'totp' && factor.status === 'verified'),
    [factors],
  );

  const refreshFactors = useCallback(async () => {
    const { data, error } = await getTotpFactors();
    if (error) {
      setMessage(error.message);
      return;
    }

    const all = [
      ...(data?.totp ?? []),
      ...(data?.phone ?? []),
    ] as Factor[];

    setFactors(all);
  }, []);

  useEffect(() => {
    refreshFactors();
  }, [refreshFactors]);

  const startEnrollment = async () => {
    setBusy(true);
    setMessage('');
    setShowSecret(false);

    // Remove stale, unverified TOTP enrollments before creating a fresh secret.
    const { data: existing } = await getTotpFactors();
    const stale = (existing?.totp ?? []).filter((factor: Factor) => factor.status !== 'verified');
    for (const factor of stale) {
      await unenrollTotp(factor.id);
    }

    const { data, error } = await enrollTotp();
    setBusy(false);

    if (error || !data) {
      setMessage(error?.message ?? 'Could not start MFA enrollment.');
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp?.qr_code ?? '');
    setSecret(data.totp?.secret ?? '');
    setMessage('Fresh MFA enrollment created. Scan the QR code, then enter the 6-digit code from your authenticator.');
  };

  const verifyEnrollment = async () => {
    if (!factorId || code.trim().length < 6) {
      setMessage('Enter the 6-digit authenticator code.');
      return;
    }

    setBusy(true);
    const { error } = await verifyTotpEnrollment(factorId, code.trim());
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setCode('');
    setQrCode('');
    setSecret('');
    setShowSecret(false);
    setFactorId('');
    setMessage('MFA verified. Platform Admin protection is active.');
    await refreshFactors();
  };

  const removeMfa = async () => {
    if (!verifiedTotp) return;
    setBusy(true);
    const { error } = await unenrollTotp(verifiedTotp.id);
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Authenticator MFA removed.');
    await refreshFactors();
  };

  const github = async () => {
    setMessage('Linking GitHub to this signed-in Platform Admin account…');
    const { error } = await linkGitHubIdentity();
    if (error) setMessage(error.message);
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: insets.bottom + 42,
          paddingHorizontal: 20,
        }}
      >
        <Pressable
          onPress={() => router.replace('/global-hq')}
          className="min-h-11 flex-row items-center gap-2 mb-4"
        >
          <ArrowLeft size={18} color={THEME.accent} />
          <Text className="text-footnote font-bold text-primary">Global HQ</Text>
        </Pressable>

        <View className="flex-row items-center gap-3 mb-7">
          <View className="w-12 h-12 rounded-2xl bg-card border border-border items-center justify-center">
            <ShieldCheck size={24} color={THEME.accent} />
          </View>
          <View className="flex-1">
            <Text className="text-caption font-bold uppercase tracking-widest text-primary">FILM FESTIVAL OS™</Text>
            <Text className="text-title1 font-bold text-foreground mt-1">Platform Admin Security Centre™</Text>
            <Text className="text-footnote text-muted-foreground mt-1">Easy As™ security setup</Text>
          </View>
        </View>

        <View className="rounded-3xl border border-border bg-card p-5 mb-5">
          <View className="flex-row items-center gap-3">
            <LockKeyhole size={22} color={verifiedTotp ? '#22c55e' : THEME.accent} />
            <View className="flex-1">
              <Text className="text-headline font-semibold text-card-foreground">Authenticator MFA</Text>
              <Text className="text-footnote text-muted-foreground mt-1">
                {verifiedTotp ? 'Protected — second-factor verification is active.' : 'Recommended for every Platform Admin.'}
              </Text>
            </View>
            {verifiedTotp ? <CheckCircle2 size={22} color="#22c55e" /> : null}
          </View>

          {!verifiedTotp && !factorId ? (
            <Pressable
              onPress={startEnrollment}
              disabled={busy}
              className="min-h-12 rounded-xl bg-primary flex-row items-center justify-center gap-2 mt-5"
            >
              <QrCode size={18} color={THEME.accentFg} />
              <Text className="text-footnote font-bold text-primary-foreground">
                {busy ? 'Preparing QR…' : 'Set up with QR code'}
              </Text>
            </Pressable>
          ) : null}

          {factorId ? (
            <View className="mt-5">
              <Text className="text-footnote font-bold text-card-foreground">1. Scan this QR code</Text>

              {qrCode ? (
                <View className="items-center py-5">
                  <View className="bg-white rounded-2xl p-3">
                    {Platform.OS === 'web' ? (
                      // React Native Web's Image can render a blank box for SVG/data QR payloads.
                      // A native <img> is reliable in Chrome/Safari and keeps the QR crisp.
                      // @ts-ignore web-only element
                      <img
                        src={normalizeQrSource(qrCode)}
                        width={220}
                        height={220}
                        alt="Authenticator enrollment QR code"
                        style={{ display: 'block', objectFit: 'contain' }}
                      />
                    ) : (
                      <Image
                        source={{ uri: normalizeQrSource(qrCode) }}
                        style={{ width: 220, height: 220 }}
                        resizeMode="contain"
                        accessibilityLabel="Authenticator enrollment QR code"
                      />
                    )}
                  </View>
                </View>
              ) : null}

              {secret ? (
                <View className="rounded-xl border border-border bg-background p-3">
                  <Pressable onPress={() => setShowSecret((value) => !value)} className="min-h-10 justify-center">
                    <Text className="text-caption font-bold text-primary">
                      {showSecret ? 'Hide manual setup key' : 'Can\'t scan? Show manual setup key'}
                    </Text>
                  </Pressable>
                  {showSecret ? (
                    <>
                      <Text className="text-caption text-muted-foreground mt-2">Keep this key private. Do not screenshot or send it.</Text>
                      <Text selectable className="text-footnote font-bold text-foreground mt-2">{secret}</Text>
                    </>
                  ) : null}
                </View>
              ) : null}

              <Text className="text-footnote font-bold text-card-foreground mt-5">2. Enter the 6-digit code</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={THEME.muted}
                keyboardType="number-pad"
                maxLength={6}
                className="min-h-12 rounded-xl border border-border bg-background px-4 text-title3 text-foreground mt-3"
              />

              <Pressable
                onPress={verifyEnrollment}
                disabled={busy}
                className="min-h-12 rounded-xl bg-primary items-center justify-center mt-3"
              >
                <Text className="text-footnote font-bold text-primary-foreground">
                  {busy ? 'Checking…' : 'Verify & turn on MFA'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {verifiedTotp ? (
            <Pressable
              onPress={removeMfa}
              disabled={busy}
              className="min-h-11 rounded-xl border border-border flex-row items-center justify-center gap-2 mt-5"
            >
              <Trash2 size={16} color={THEME.muted} />
              <Text className="text-footnote font-semibold text-muted-foreground">Remove authenticator MFA</Text>
            </Pressable>
          ) : null}
        </View>

        <View className="rounded-3xl border border-border bg-card p-5 mb-5">
          <View className="flex-row items-center gap-3">
            <Github size={22} color={THEME.accent} />
            <View className="flex-1">
              <Text className="text-headline font-semibold text-card-foreground">GitHub login</Text>
              <Text className="text-footnote text-muted-foreground mt-1">
                Optional developer/admin identity. Links GitHub to the Platform Admin account already signed in here.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={github}
            className="min-h-12 rounded-xl border border-border bg-background flex-row items-center justify-center gap-2 mt-5"
          >
            <Github size={18} color={THEME.accent} />
            <Text className="text-footnote font-bold text-foreground">Link GitHub to this admin account</Text>
          </Pressable>
        </View>

        <View className="rounded-2xl border border-border bg-card p-4 mb-5">
          <View className="flex-row items-start gap-3">
            <KeyRound size={18} color={THEME.accent} />
            <View className="flex-1">
              <Text className="text-footnote font-bold text-card-foreground">Easy As™ rule</Text>
              <Text className="text-footnote text-muted-foreground mt-1">
                Scan QR → enter six digits → done. Keep the manual setup key private and never send it by email or screenshot.
              </Text>
            </View>
          </View>
        </View>

        {message ? (
          <View className="rounded-2xl border border-border bg-card p-4">
            <Text className="text-footnote text-muted-foreground">{message}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
