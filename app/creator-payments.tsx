import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  RefreshCw,
  WalletCards,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { goWorkspaceHome } from '@/lib/navigation';
import { THEME } from '@/constants/theme';

import {
  listSubmissionPayments,
} from '@/data/workflows/commercial-awards';

import {
  createPayPalSandboxCheckout,
  capturePayPalSandboxOrder,
  listPayPalSandboxCheckouts,
  type PayPalSandboxCheckoutSession,
} from '@/data/workflows/paypal-checkout';

export default function Screen() {
  const i = useSafeAreaInsets();

  const [rows, setRows] =
    useState<any[]>([]);

  const [busyId, setBusyId] =
    useState<string | null>(null);

  const [checkoutSessions, setCheckoutSessions] =
    useState<Record<string, PayPalSandboxCheckoutSession>>({});

  const load = async () => {
    try {
      const paymentRows =
        await listSubmissionPayments();

      setRows(paymentRows);

      const checkoutRows =
        await listPayPalSandboxCheckouts(
          paymentRows.map((row: any) =>
            String(row.id),
          ),
        );

      setCheckoutSessions(
        checkoutRows.reduce(
          (
            acc: Record<
              string,
              PayPalSandboxCheckoutSession
            >,
            row,
          ) => {
            acc[
              String(row.submission_payment_id)
            ] = row;
            return acc;
          },
          {},
        ),
      );
    } catch (e: any) {
      Alert.alert(
        'Payments',
        e?.message ?? 'Unable to load payments.',
      );
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startPayPal = async (payment: any) => {
    try {
      setBusyId(String(payment.id));

      const checkout =
        await createPayPalSandboxCheckout(
          String(payment.id),
        );

      setCheckoutSessions((old) => ({
        ...old,
        [String(payment.id)]: {
          id: String(
            checkout.checkout_session_id,
          ),
          submission_payment_id:
            String(payment.id),
          status: 'approval_pending',
          approval_url:
            String(checkout.approval_url),
          provider_order_id:
            checkout.order_id
              ? String(checkout.order_id)
              : null,
          provider_capture_id: null,
          amount_due: Number(
            checkout.amount ??
              payment.amount_due ??
              0,
          ),
          currency: String(
            checkout.currency ??
              payment.currency ??
              '',
          ),
          created_at:
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
        },
      }));

      await Linking.openURL(
        String(checkout.approval_url),
      );

      Alert.alert(
        'PayPal Sandbox',
        'Complete the test payment in PayPal. Then return to Film Festival OS™ and press CAPTURE APPROVED PAYMENT.',
      );
    } catch (e: any) {
      Alert.alert(
        'PayPal Sandbox',
        e?.message ?? 'Unable to start checkout.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const capturePayPal = async (
    payment: any,
  ) => {
    const checkout =
      checkoutSessions[String(payment.id)];

    const checkoutId =
      checkout?.id;

    if (!checkoutId) {
      Alert.alert(
        'PayPal Sandbox',
        'Start PayPal checkout first.',
      );
      return;
    }

    try {
      setBusyId(String(payment.id));

      const result =
        await capturePayPalSandboxOrder(
          checkoutId,
        );

      await load();

      Alert.alert(
        'Capture requested',
        result?.waiting_for_verified_webhook
          ? 'PayPal capture was requested. FFOS is waiting for the verified PayPal webhook before marking the payment PAID.'
          : 'PayPal capture request completed.',
      );
    } catch (e: any) {
      Alert.alert(
        'PayPal Sandbox',
        e?.message ?? 'Unable to capture payment.',
      );
    } finally {
      setBusyId(null);
    }
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
          PAYMENT RECORDS
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          Payments & Receipts
        </Text>

        <Text className="text-subhead text-muted-foreground mt-1">
          Auditable fee, discount and payment-state records.
          Raw card or PayPal credentials are never stored here.
        </Text>

        <View className="rounded-xl border border-primary p-3 mt-4 mb-5">
          <Text className="font-bold text-primary">
            PAYPAL SANDBOX TEST MODE
          </Text>
          <Text className="text-footnote text-muted-foreground mt-1">
            Test transactions only. No real money is processed.
          </Text>
        </View>

        <Pressable
          onPress={() => void load()}
          className="self-end mb-3"
        >
          <RefreshCw
            size={19}
            color={THEME.accent}
          />
        </Pressable>

        {rows.map((r: any) => {
          const paymentId =
            String(r.id);

          const pending =
            String(r.payment_status) ===
              'pending' &&
            Number(r.amount_due) > 0;

          const checkout =
            checkoutSessions[paymentId];

          const checkoutId =
            checkout?.id;

          const busy =
            busyId === paymentId;

          return (
            <View
              key={r.id}
              className="rounded-2xl border border-border bg-card p-4 mb-3"
            >
              <View className="flex-row gap-2 items-center">
                <WalletCards
                  size={17}
                  color={THEME.accent}
                />

                <Text className="text-headline font-semibold text-card-foreground">
                  {r.currency}{' '}
                  {Number(
                    r.amount_due,
                  ).toFixed(2)}
                </Text>
              </View>

              <Text className="text-footnote text-muted-foreground mt-1">
                Payment: {r.payment_status}
                {' · '}
                Eligibility: {r.eligibility_status}
              </Text>

              {!!checkout && (
                <Text className="text-footnote text-muted-foreground mt-2">
                  PayPal Sandbox checkout: {String(checkout.status).toUpperCase()}
                </Text>
              )}

              <Text className="text-footnote text-foreground mt-2">
                Base{' '}
                {Number(
                  r.base_amount,
                ).toFixed(2)}
                {' · '}
                Discount{' '}
                {Number(
                  r.discount_amount,
                ).toFixed(2)}
                {r.benefit_code
                  ? ` · ${r.benefit_code}`
                  : ''}
              </Text>

              {pending && (
                <>
                  <Pressable
                    disabled={busy}
                    onPress={() =>
                      void startPayPal(r)
                    }
                    className="mt-4 rounded-xl bg-primary px-4 py-3 items-center"
                  >
                    <Text className="font-bold text-primary-foreground">
                      PAY WITH PAYPAL — SANDBOX
                    </Text>
                  </Pressable>

                  {!!checkout?.approval_url && (
                    <Pressable
                      disabled={busy}
                      onPress={() =>
                        void Linking.openURL(
                          String(checkout.approval_url),
                        )
                      }
                      className="mt-2 rounded-xl border border-border px-4 py-3 items-center"
                    >
                      <Text className="font-bold text-foreground">
                        CONTINUE PAYPAL APPROVAL — SANDBOX
                      </Text>
                    </Pressable>
                  )}

                  {!!checkoutId &&
                    !['completed', 'denied', 'cancelled', 'refunded', 'error'].includes(
                      String(checkout?.status ?? ''),
                    ) && (
                    <Pressable
                      disabled={busy}
                      onPress={() =>
                        void capturePayPal(r)
                      }
                      className="mt-2 rounded-xl border border-primary px-4 py-3 items-center"
                    >
                      <Text className="font-bold text-primary">
                        CAPTURE APPROVED PAYMENT
                      </Text>
                    </Pressable>
                  )}
                </>
              )}

              {String(
                r.payment_status,
              ) === 'paid' && (
                <Text className="text-footnote font-bold text-primary mt-3">
                  PAID · VERIFIED PAYMENT RECORD
                </Text>
              )}

              {String(
                r.payment_status,
              ) === 'waived' && (
                <Text className="text-footnote font-semibold text-muted-foreground mt-3">
                  FEE WAIVED
                </Text>
              )}
            </View>
          );
        })}

        {rows.length === 0 && (
          <Text className="text-muted-foreground">
            No payment records yet.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
