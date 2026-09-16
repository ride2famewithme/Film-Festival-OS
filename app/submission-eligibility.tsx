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
import { ArrowLeft, ChevronDown, RefreshCw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import { listSubmissions } from '@/data/workflows/festival-core';
import {
  assessSubmission,
  listCategories,
  listSubmissionPayments,
  markPaymentStatus,
} from '@/data/workflows/commercial-awards';

export default function Screen() {
  const i = useSafeAreaInsets();

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [benefit, setBenefit] = useState('');
  const [selectedCats, setSelectedCats] = useState<Record<string, string>>({});
  const [openSelector, setOpenSelector] = useState<string | null>(null);

  const load = async () => {
    try {
      const [s, c, p] = await Promise.all([
        listSubmissions(),
        listCategories(),
        listSubmissionPayments(),
      ]);

      setSubmissions(s);
      setCats(c);
      setPayments(p);
    } catch (e: any) {
      Alert.alert('Eligibility & payment', e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCats = cats.filter((c) => c.status === 'open');

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
          Eligibility & Payment State
        </Text>

        <Text className="text-subhead text-muted-foreground mt-1 mb-5">
          Choose the submission category, calculate the applicable fee and
          record payment state without storing card details.
        </Text>

        <TextInput
          value={benefit}
          onChangeText={setBenefit}
          autoCapitalize="characters"
          placeholder="Optional waiver / benefit code"
          placeholderTextColor={THEME.muted}
          className="rounded-xl border border-border bg-card px-4 py-3 text-foreground mb-4"
        />

        <Pressable onPress={load} className="self-end mb-3">
          <RefreshCw size={19} color={THEME.accent} />
        </Pressable>

        {submissions.map((s) => {
          const p = payments.find((x) => x.submission_id === s.id);
          const selectedId =
            selectedCats[s.id] ||
            p?.category_id ||
            '';
          const selectedCategory = cats.find((c) => c.id === selectedId);
          const isDemo = s.entry_classification === 'demo_test';
          const isBlocked = s.coi_status === 'blocked';
          const restricted = isDemo || isBlocked;

          return (
            <View
              key={s.id}
              className="rounded-2xl border border-border bg-card p-4 mb-3"
            >
              <Text className="text-headline font-semibold text-card-foreground">
                {s.title}
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                {s.filmmaker_name} · submission {s.status}
              </Text>

              {restricted && (
                <View className="rounded-xl border border-primary p-3 mt-4">
                  <Text className="font-bold text-primary">
                    {isDemo
                      ? 'DEMO / TEST ONLY — NOT ELIGIBLE FOR COMPETITION OR AWARDS'
                      : 'CONFLICT OF INTEREST — COMPETITION ACCESS BLOCKED'}
                  </Text>
                  {!!s.restriction_reason && (
                    <Text className="text-footnote text-muted-foreground mt-2">
                      {s.restriction_reason}
                    </Text>
                  )}
                </View>
              )}

              {!p && !restricted && (
                <>
                  <Text className="text-footnote font-semibold text-foreground mt-4 mb-2">
                    Competition category
                  </Text>

                  <Pressable
                    onPress={() =>
                      setOpenSelector(openSelector === s.id ? null : s.id)
                    }
                    className="rounded-xl border border-border bg-background px-4 py-3 flex-row justify-between items-center"
                  >
                    <Text className="text-foreground">
                      {selectedCategory
                        ? `${selectedCategory.name} — ${selectedCategory.currency} ${Number(
                            selectedCategory.regular_fee
                          ).toFixed(2)}`
                        : 'Select category'}
                    </Text>

                    <ChevronDown size={18} color={THEME.accent} />
                  </Pressable>

                  {openSelector === s.id && (
                    <View className="rounded-xl border border-border bg-background mt-2 overflow-hidden">
                      {openCats.map((cat) => (
                        <Pressable
                          key={cat.id}
                          onPress={() => {
                            setSelectedCats((old) => ({
                              ...old,
                              [s.id]: cat.id,
                            }));
                            setOpenSelector(null);
                          }}
                          className="px-4 py-3 border-b border-border"
                        >
                          <Text className="text-foreground font-semibold">
                            {cat.name}
                          </Text>
                          <Text className="text-footnote text-muted-foreground">
                            {cat.currency}{' '}
                            {Number(cat.regular_fee).toFixed(2)}
                          </Text>
                        </Pressable>
                      ))}

                      {openCats.length === 0 && (
                        <Text className="px-4 py-3 text-muted-foreground">
                          No open categories available.
                        </Text>
                      )}
                    </View>
                  )}

                  <Pressable
                    disabled={!selectedId}
                    onPress={async () => {
                      if (!selectedId) {
                        return Alert.alert(
                          'Category required',
                          'Choose a competition category first.'
                        );
                      }

                      try {
                        await assessSubmission(
                          s.id,
                          selectedId,
                          benefit
                        );
                        await load();
                      } catch (e: any) {
                        Alert.alert('Assessment', e.message);
                      }
                    }}
                    className="self-start rounded-full border border-primary px-3 py-2 mt-3"
                  >
                    <Text className="text-footnote text-primary">
                      Assess Eligibility & Fee
                    </Text>
                  </Pressable>
                </>
              )}

              {p && !restricted && (
                <>
                  <Text className="text-footnote text-foreground mt-3">
                    Category:{' '}
                    {cats.find((c) => c.id === p.category_id)?.name ??
                      'Category'}
                  </Text>

                  <Text className="text-footnote text-foreground mt-1">
                    Eligibility: {p.eligibility_status} · Payment:{' '}
                    {p.payment_status}
                  </Text>

                  <Text className="text-footnote text-foreground">
                    Due: {p.currency} {Number(p.amount_due).toFixed(2)} ·
                    Discount: {Number(p.discount_amount).toFixed(2)}
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-1">
                    Benefit code: {p.benefit_code || 'none'}
                  </Text>

                  <Pressable
                    onPress={async () => {
                      try {
                        await assessSubmission(
                          s.id,
                          p.category_id,
                          benefit
                        );
                        await load();
                      } catch (e: any) {
                        Alert.alert('Benefit recalculation', e.message);
                      }
                    }}
                    className="self-start rounded-full border border-primary px-3 py-2 mt-3"
                  >
                    <Text className="text-footnote text-primary">
                      Apply / Recalculate Benefit
                    </Text>
                  </Pressable>

                  <View className="flex-row gap-2 mt-3">
                    {p.payment_status !== 'paid' && (
                      <Pressable
                        onPress={async () => {
                          await markPaymentStatus(
                            p.id,
                            s.id,
                            'paid'
                          );
                          await load();
                        }}
                        className="rounded-full border border-primary px-3 py-2"
                      >
                        <Text className="text-footnote text-primary">
                          Mark paid
                        </Text>
                      </Pressable>
                    )}

                    {p.payment_status === 'paid' && (
                      <Pressable
                        onPress={async () => {
                          await markPaymentStatus(
                            p.id,
                            s.id,
                            'refunded'
                          );
                          await load();
                        }}
                        className="rounded-full border border-border px-3 py-2"
                      >
                        <Text className="text-footnote text-foreground">
                          Record refund
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
