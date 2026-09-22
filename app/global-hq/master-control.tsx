import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  KeyRound,
  LockKeyhole,
  QrCode,
  ShieldCheck,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import { can } from '@/data/access';
import { getActiveContext } from '@/data/session';
import {
  verifyGlobalMasterPassword,
  verifyGlobalMasterTotp,
} from '@/data/workflows/global-master-auth';
import {
  getGlobalPlatformState,
  setGlobalPlatformState,
  type GlobalPlatformState,
} from '@/data/workflows/global-platform-state';

export default function GlobalMasterControlScreen() {
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(0.35)).current;

  const [authorised, setAuthorised] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [masterUnlocked, setMasterUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [platformState, setPlatformState] =
    useState<GlobalPlatformState | null>(null);
  const [pendingState, setPendingState] =
    useState<GlobalPlatformState | null>(null);
  const [stateReason, setStateReason] = useState('');
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [changingState, setChangingState] = useState(false);
  const [stateMessage, setStateMessage] = useState('');
  const [showOperatorGuide, setShowOperatorGuide] = useState(false);

  useEffect(() => {
    void (async () => {
      const ctx = await getActiveContext();

      setRole(ctx?.role ?? null);

      setAuthorised(
        !!ctx &&
        ctx.role === 'platform_admin' &&
        can(ctx.role, 'platform.configure')
      );
    })();
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 1300,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    if (!masterUnlocked) return;

    const timer = setTimeout(() => {
      setMasterUnlocked(false);
      setPasswordVerified(false);
      setPassword('');
      setTotpCode('');
      setMessage('GLOBAL MASTER KEY™ automatically re-locked after 10 minutes.');
    }, 10 * 60 * 1000);

    return () => clearTimeout(timer);
  }, [masterUnlocked]);

  useEffect(() => {
    void (async () => {
      try {
        const current = await getGlobalPlatformState();
        setPlatformState(current.state);
      } catch (error: any) {
        setStateMessage(
          error?.message ?? 'GLOBAL PLATFORM STATE could not be loaded.'
        );
      }
    })();
  }, []);

  const applyPlatformState = async () => {
    if (!masterUnlocked || !pendingState) return;

    if (!stateReason.trim()) {
      setStateMessage('Enter a reason / audit note before changing state.');
      return;
    }

    try {
      setChangingState(true);
      setStateMessage('');

      const result: any = await setGlobalPlatformState(
        pendingState,
        stateReason,
        typedConfirmation
      );

      setPlatformState(
        (result?.state ?? pendingState) as GlobalPlatformState
      );

      setPendingState(null);
      setStateReason('');
      setTypedConfirmation('');

      setStateMessage(
        `GLOBAL PLATFORM STATE™ changed to ${String(
          result?.state ?? pendingState
        ).toUpperCase()}.`
      );
    } catch (error: any) {
      setStateMessage(
        error?.message ?? 'GLOBAL PLATFORM STATE could not be changed.'
      );
    } finally {
      setChangingState(false);
    }
  };

  const verifyPassword = async () => {
    try {
      setBusy(true);
      setMessage('');
      await verifyGlobalMasterPassword(password);
      setPassword('');
      setPasswordVerified(true);
      setMasterUnlocked(false);
      setMessage('Password verified. Complete MFA verification.');
    } catch (error: any) {
      setPasswordVerified(false);
      setMasterUnlocked(false);
      setMessage(error?.message ?? 'Password verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const verifyMfa = async () => {
    try {
      setBusy(true);
      setMessage('');
      await verifyGlobalMasterTotp(totpCode);
      setTotpCode('');
      setMasterUnlocked(true);
      setMessage('GLOBAL MASTER KEY™ authenticated and unlocked.');
    } catch (error: any) {
      setMasterUnlocked(false);
      setMessage(error?.message ?? 'MFA verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#050807' }}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 60,
        paddingHorizontal: 24,
        alignItems: 'center',
      }}
    >
      <View style={{ width: '100%', maxWidth: 820 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ marginBottom: 22 }}
        >
          <ArrowLeft size={22} color="#63f5ad" />
        </Pressable>

        <Text
          style={{
            color: '#63f5ad',
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 3,
          }}
        >
          FFOS™ GLOBAL HQ
        </Text>

        <Text
          style={{
            color: '#ffffff',
            fontSize: 30,
            fontWeight: '900',
            marginTop: 8,
          }}
        >
          GLOBAL MASTER KEY™
        </Text>

        <Text
          style={{
            color: '#8fa39a',
            fontSize: 14,
            marginTop: 7,
          }}
        >
          SCHILLER™ Global Master Control
        </Text>

        <View
          style={{
            marginTop: 28,
            borderWidth: 1,
            borderColor: '#1f6f4a',
            borderRadius: 22,
            padding: 26,
            backgroundColor: '#07100c',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={{
              position: 'absolute',
              width: 280,
              height: 280,
              borderRadius: 140,
              borderWidth: 2,
              borderColor: '#16f28b',
              opacity: pulse,
              top: -55,
            }}
          />

          <Animated.View
            style={{
              position: 'absolute',
              width: 210,
              height: 210,
              borderRadius: 105,
              borderWidth: 1,
              borderColor: '#16f28b',
              opacity: pulse,
              top: -20,
            }}
          />

          <View
            style={{
              width: 94,
              height: 94,
              borderRadius: 47,
              backgroundColor: '#03140d',
              borderWidth: 1,
              borderColor: '#16f28b',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LockKeyhole size={48} color="#27f59a" />
          </View>

          <Text
            style={{
              color: '#ffffff',
              fontSize: 20,
              fontWeight: '900',
              letterSpacing: 2,
              marginTop: 22,
            }}
          >
            MASTER CONTROL LOCKED
          </Text>

          <Text
            style={{
              color: '#8fa39a',
              textAlign: 'center',
              marginTop: 8,
              maxWidth: 540,
              lineHeight: 20,
            }}
          >
            Global platform controls require Global Master authority,
            password re-verification and MFA step-up authentication.
          </Text>
        </View>

        <View
          style={{
            marginTop: 18,
            borderWidth: 1,
            borderColor: '#25352e',
            borderRadius: 16,
            padding: 18,
            backgroundColor: '#090d0b',
          }}
        >
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <ShieldCheck size={20} color="#63f5ad" />
            <Text style={{ color: '#ffffff', fontWeight: '800' }}>
              Authority
            </Text>
          </View>

          <Text style={{ color: '#9baaa3', marginTop: 8 }}>
            Current role: {role ?? 'not authenticated'}
          </Text>

          <Text
            style={{
              color: authorised ? '#63f5ad' : '#ff8a8a',
              marginTop: 4,
              fontWeight: '800',
            }}
          >
            {authorised
              ? 'GLOBAL MASTER AUTHORITY DETECTED'
              : 'GLOBAL MASTER AUTHORITY REQUIRED'}
          </Text>
        </View>

        <View
          style={{
            marginTop: 18,
            flexDirection: 'row',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <View
            style={{
              flex: 1,
              minWidth: 240,
              borderWidth: 1,
              borderColor: '#25352e',
              borderRadius: 16,
              padding: 18,
              backgroundColor: '#090d0b',
            }}
          >
            <KeyRound size={22} color="#63f5ad" />
            <Text style={{ color: '#fff', fontWeight: '800', marginTop: 10 }}>
              Password Re-Verification
            </Text>
            <Text style={{ color: '#8fa39a', marginTop: 6 }}>
              Server-side step-up authentication will be connected next.
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              minWidth: 240,
              borderWidth: 1,
              borderColor: '#25352e',
              borderRadius: 16,
              padding: 18,
              backgroundColor: '#090d0b',
            }}
          >
            <QrCode size={22} color="#63f5ad" />
            <Text style={{ color: '#fff', fontWeight: '800', marginTop: 10 }}>
              MFA / QR Verification
            </Text>
            <Text style={{ color: '#8fa39a', marginTop: 6 }}>
              Existing FFOS MFA will be reused — no fake QR security.
            </Text>
          </View>
        </View>

        {authorised ? (
          <View
            style={{
              marginTop: 22,
              borderWidth: 1,
              borderColor: '#25352e',
              borderRadius: 16,
              padding: 18,
              backgroundColor: '#090d0b',
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '900' }}>
              STEP 1 — MASTER PASSWORD
            </Text>

            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter Global Master password"
              placeholderTextColor="#607168"
              editable={!busy && !passwordVerified}
              style={{
                marginTop: 12,
                borderWidth: 1,
                borderColor: passwordVerified ? '#16f28b' : '#31443a',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: '#ffffff',
                backgroundColor: '#050807',
              }}
            />

            <Pressable
              onPress={verifyPassword}
              disabled={busy || passwordVerified || !password.trim()}
              style={{
                marginTop: 10,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                backgroundColor: passwordVerified ? '#16452f' : '#146b45',
                opacity: busy || (!password.trim() && !passwordVerified) ? 0.55 : 1,
              }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '900' }}>
                {passwordVerified ? 'PASSWORD VERIFIED ✓' : 'VERIFY PASSWORD'}
              </Text>
            </Pressable>

            <Text
              style={{
                color: '#ffffff',
                fontWeight: '900',
                marginTop: 22,
              }}
            >
              STEP 2 — AUTHENTICATOR MFA
            </Text>

            <TextInput
              value={totpCode}
              onChangeText={(value) =>
                setTotpCode(value.replace(/[^0-9]/g, '').slice(0, 6))
              }
              keyboardType="number-pad"
              placeholder="6-digit authenticator code"
              placeholderTextColor="#607168"
              editable={!busy && passwordVerified && !masterUnlocked}
              style={{
                marginTop: 12,
                borderWidth: 1,
                borderColor: masterUnlocked ? '#16f28b' : '#31443a',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: '#ffffff',
                backgroundColor: '#050807',
                letterSpacing: 4,
              }}
            />

            <Pressable
              onPress={verifyMfa}
              disabled={
                busy ||
                !passwordVerified ||
                masterUnlocked ||
                totpCode.length !== 6
              }
              style={{
                marginTop: 10,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                backgroundColor: masterUnlocked ? '#16452f' : '#146b45',
                opacity:
                  busy ||
                  !passwordVerified ||
                  (totpCode.length !== 6 && !masterUnlocked)
                    ? 0.55
                    : 1,
              }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '900' }}>
                {masterUnlocked
                  ? 'MFA VERIFIED ✓'
                  : 'VERIFY MFA & UNLOCK'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/security-centre')}
              style={{
                marginTop: 12,
                alignItems: 'center',
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: '#63f5ad', fontWeight: '800' }}>
                SET UP / REVIEW MFA IN SECURITY CENTRE
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowOperatorGuide((current) => !current)}
              style={{
                marginTop: 8,
                borderWidth: 1,
                borderColor: '#31443a',
                borderRadius: 12,
                paddingVertical: 11,
                paddingHorizontal: 14,
                backgroundColor: '#050807',
              }}
            >
              <Text
                style={{
                  color: '#63f5ad',
                  textAlign: 'center',
                  fontWeight: '900',
                }}
              >
                {showOperatorGuide
                  ? 'HIDE GLOBAL MASTER OPERATOR™ QUICK GUIDE'
                  : 'GLOBAL MASTER OPERATOR™ QUICK GUIDE'}
              </Text>
            </Pressable>

            {showOperatorGuide ? (
              <View
                style={{
                  marginTop: 10,
                  borderWidth: 1,
                  borderColor: '#25352e',
                  borderRadius: 12,
                  padding: 14,
                  backgroundColor: '#07100c',
                }}
              >
                <Text
                  style={{
                    color: '#ffffff',
                    fontWeight: '900',
                    marginBottom: 8,
                  }}
                >
                  GLOBAL MASTER KEY™ — MFA QUICK GUIDE
                </Text>

                <Text style={{ color: '#c4d0ca', lineHeight: 21 }}>
                  1. Enter the Platform Admin password and press VERIFY PASSWORD.
                  {'\n'}2. Open the authenticator app on the iPhone.
                  {'\n'}3. Find the Film Festival OS / Platform Admin entry.
                  {'\n'}4. Enter the current 6-digit code shown in the app.
                  {'\n'}5. Press VERIFY MFA & UNLOCK.
                  {'\n\n'}NO QR SHOWING? THAT IS NORMAL IF MFA IS ALREADY PROTECTED.
                  {'\n'}A QR code is normally shown only during first-time MFA setup or controlled re-enrollment.
                  {'\n\n'}If Security Centre says “Protected”, do not remove MFA just because no QR is visible.
                  {'\n\n'}The Global Master Key™ automatically re-locks after 10 minutes.
                  {'\n\n'}If FFOS is SUSPENDED, use OPEN GLOBAL MASTER CONTROL or OPEN GLOBAL HQ RECOVERY, switch to Platform Admin if required, authenticate again, then restore ACTIVE.
                </Text>
              </View>
            ) : null}

            {!!message && (
              <Text
                style={{
                  marginTop: 10,
                  color: masterUnlocked ? '#63f5ad' : '#c4d0ca',
                  textAlign: 'center',
                }}
              >
                {message}
              </Text>
            )}
          </View>
        ) : null}

        {masterUnlocked ? (
          <View
            style={{
              marginTop: 22,
              borderWidth: 1,
              borderColor: '#16f28b',
              borderRadius: 18,
              padding: 20,
              backgroundColor: '#07100c',
            }}
          >
            <Text
              style={{
                color: '#63f5ad',
                fontSize: 12,
                fontWeight: '900',
                letterSpacing: 2,
              }}
            >
              GLOBAL PLATFORM STATE™
            </Text>

            <Text
              style={{
                color: '#ffffff',
                fontSize: 24,
                fontWeight: '900',
                marginTop: 8,
              }}
            >
              CURRENT STATE: {(platformState ?? 'loading').toUpperCase()}
            </Text>

            <Text
              style={{
                color: '#8fa39a',
                marginTop: 6,
                lineHeight: 20,
              }}
            >
              Select a platform state. A reason and explicit confirmation
              are required. Historical data is preserved.
            </Text>

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 10,
                marginTop: 18,
              }}
            >
              {(
                [
                  'active',
                  'restricted',
                  'suspended',
                  'retired',
                ] as GlobalPlatformState[]
              ).map((item) => {
                const selected = pendingState === item;
                const current = platformState === item;

                return (
                  <Pressable
                    key={item}
                    disabled={changingState || current}
                    onPress={() => {
                      setPendingState(item);
                      setStateMessage('');
                    }}
                    style={{
                      minWidth: 140,
                      paddingVertical: 13,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor:
                        selected || current ? '#16f28b' : '#31443a',
                      backgroundColor:
                        current
                          ? '#16452f'
                          : selected
                            ? '#103524'
                            : '#090d0b',
                      opacity: changingState ? 0.55 : 1,
                    }}
                  >
                    <Text
                      style={{
                        color: '#ffffff',
                        textAlign: 'center',
                        fontWeight: '900',
                        letterSpacing: 1,
                      }}
                    >
                      {item.toUpperCase()}
                      {current ? ' ✓' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {pendingState ? (
              <View
                style={{
                  marginTop: 20,
                  borderTopWidth: 1,
                  borderTopColor: '#25352e',
                  paddingTop: 18,
                }}
              >
                <Text
                  style={{
                    color: '#ffffff',
                    fontWeight: '900',
                  }}
                >
                  CONFIRM CHANGE TO {pendingState.toUpperCase()}
                </Text>

                <TextInput
                  value={stateReason}
                  onChangeText={setStateReason}
                  multiline
                  placeholder="Reason / Global Master audit note"
                  placeholderTextColor="#607168"
                  editable={!changingState}
                  style={{
                    marginTop: 12,
                    minHeight: 82,
                    borderWidth: 1,
                    borderColor: '#31443a',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: '#ffffff',
                    backgroundColor: '#050807',
                    textAlignVertical: 'top',
                  }}
                />

                {pendingState === 'suspended' ||
                pendingState === 'retired' ? (
                  <View style={{ marginTop: 14 }}>
                    <Text
                      style={{
                        color: '#f5b942',
                        fontWeight: '900',
                      }}
                    >
                      TYPE EXACTLY:{' '}
                      {pendingState === 'suspended'
                        ? 'SUSPEND FFOS'
                        : 'RETIRE FFOS'}
                    </Text>

                    <TextInput
                      value={typedConfirmation}
                      onChangeText={setTypedConfirmation}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      placeholder={
                        pendingState === 'suspended'
                          ? 'SUSPEND FFOS'
                          : 'RETIRE FFOS'
                      }
                      placeholderTextColor="#607168"
                      editable={!changingState}
                      style={{
                        marginTop: 8,
                        borderWidth: 1,
                        borderColor: '#7a5b16',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        color: '#ffffff',
                        backgroundColor: '#050807',
                        fontWeight: '900',
                        letterSpacing: 1,
                      }}
                    />
                  </View>
                ) : null}

                <Pressable
                  onPress={applyPlatformState}
                  disabled={
                    changingState ||
                    !stateReason.trim() ||
                    (
                      pendingState === 'suspended' &&
                      typedConfirmation.trim().toUpperCase() !== 'SUSPEND FFOS'
                    ) ||
                    (
                      pendingState === 'retired' &&
                      typedConfirmation.trim().toUpperCase() !== 'RETIRE FFOS'
                    )
                  }
                  style={{
                    marginTop: 12,
                    borderRadius: 12,
                    paddingVertical: 13,
                    alignItems: 'center',
                    backgroundColor: '#146b45',
                    opacity:
                      changingState || !stateReason.trim() ? 0.55 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: '#ffffff',
                      fontWeight: '900',
                      letterSpacing: 1,
                    }}
                  >
                    {changingState
                      ? 'APPLYING...'
                      : `CONFIRM ${pendingState.toUpperCase()} STATE`}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={changingState}
                  onPress={() => {
                    setPendingState(null);
                    setStateReason('');
                    setTypedConfirmation('');
                    setStateMessage('');
                  }}
                  style={{
                    marginTop: 8,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#8fa39a',
                      fontWeight: '800',
                    }}
                  >
                    CANCEL STATE CHANGE
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {!!stateMessage && (
              <Text
                style={{
                  color: '#63f5ad',
                  textAlign: 'center',
                  marginTop: 14,
                  fontWeight: '700',
                }}
              >
                {stateMessage}
              </Text>
            )}
          </View>
        ) : null}

        <Pressable
          disabled
          style={{
            marginTop: 22,
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: 'center',
            backgroundColor: '#163326',
            opacity: 0.55,
          }}
        >
          <Text
            style={{
              color: '#ffffff',
              fontWeight: '900',
              letterSpacing: 1.5,
            }}
          >
            {masterUnlocked
              ? 'GLOBAL MASTER CONSOLE UNLOCKED ✓'
              : 'ACTIVATE GLOBAL MASTER KEY™'}
          </Text>
        </Pressable>

        <Text
          style={{
            color: '#607168',
            textAlign: 'center',
            marginTop: 12,
            fontSize: 12,
          }}
        >
          {masterUnlocked
            ? 'GLOBAL STATE CONTROL LIVE — full FFOS enforcement is not connected yet.'
            : 'SAFE MODE — authenticate to access Global Master controls.'}
        </Text>
      </View>
    </ScrollView>
  );
}
