import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Banknote,
  BookOpenCheck,
  RefreshCw,
  RotateCcw,
  WalletCards,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import {
  loadPaymentsSettlementCentre,
  prepareFestivalSettlement,
  reconcileFestivalSettlement,
  scheduleFestivalPayout,
  confirmFestivalPayoutPaid,
  createPayoutDestination,
} from '@/data/workflows/finance-settlements';

function money(value:any,currency='USD'){
  return `${currency} ${Number(value ?? 0).toFixed(2)}`;
}

export default function Screen(){
  const insets=useSafeAreaInsets();

  const [ledger,setLedger]=useState<any[]>([]);
  const [settlements,setSettlements]=useState<any[]>([]);
  const [destinations,setDestinations]=useState<any[]>([]);
  const [adjustments,setAdjustments]=useState<any[]>([]);
  const [policy,setPolicy]=useState<any>(null);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);

  const [periodStart,setPeriodStart]=useState(
    new Date().toISOString().slice(0,7) + '-01'
  );

  const [destinationType,setDestinationType]=useState<
    'paypal'|'bank_transfer'|'crypto_wallet'
  >('paypal');

  const [destinationLabel,setDestinationLabel]=useState('');
  const [destinationAccount,setDestinationAccount]=useState('');
  const [cryptoNetwork,setCryptoNetwork]=useState('');
  const [providerReference,setProviderReference]=useState('');

  const load=useCallback(async()=>{
    try{
      setLoading(true);

      const data=await loadPaymentsSettlementCentre();

      setLedger(data.ledger ?? []);
      setSettlements(data.settlements ?? []);
      setDestinations(data.destinations ?? []);
      setAdjustments(data.adjustments ?? []);
      setPolicy(data.policy ?? null);

    }catch(e:any){
      Alert.alert(
        'Payments & Settlements',
        e?.message ?? 'Unable to load finance records.'
      );
    }finally{
      setLoading(false);
    }
  },[]);

  useEffect(()=>{
    void load();
  },[load]);

  const latest=settlements[0] ?? null;

  const activeDestination =
    destinations.find(
      (d:any)=>
        d.status==='active' &&
        d.verification_status==='verified'
    ) ?? null;

  const runAction=async(
    label:string,
    fn:()=>Promise<any>
  )=>{
    try{
      setBusy(true);
      await fn();
      await load();
      Alert.alert(label,'Completed successfully.');
    }catch(e:any){
      Alert.alert(label,e?.message ?? 'Action failed.');
    }finally{
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingTop:insets.top+12,
          paddingBottom:insets.bottom+50,
          paddingHorizontal:20,
        }}
      >
        <View className="flex-row items-center justify-between mb-5">
          <Pressable
            onPress={()=>router.back()}
            className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center"
          >
            <ArrowLeft color={THEME.accent} size={19}/>
          </Pressable>

          <Pressable
            onPress={()=>void load()}
            disabled={loading}
            className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center"
          >
            <RefreshCw color={THEME.accent} size={19}/>
          </Pressable>
        </View>

        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
          FESTIVAL FINANCE
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          Payments & Settlements Centre™
        </Text>

        <Text className="text-subhead text-muted-foreground mt-2 mb-6">
          Entry fees, FFOS commission, refunds, carry-forward balances,
          payout destinations and monthly festival settlements.
        </Text>


        {/* PAYMENT POLICY */}
        <View className="rounded-2xl border border-border bg-card p-4 mb-5">
          <Text className="text-headline font-bold text-card-foreground">
            FFOS Payment Policy
          </Text>

          <Text className="text-footnote text-foreground mt-3">
            Commission: {Number(policy?.commission_rate ?? 0.11)*100}% ·
            Minimum payout: {policy?.minimum_payout_currency ?? 'USD'} {Number(policy?.minimum_payout_threshold ?? 50).toFixed(2)}
          </Text>

          <Text className="text-footnote text-muted-foreground mt-1">
            Payout day: {policy?.settlement_day ?? 10}th ·
            Carry forward: {policy?.carry_forward_below_threshold === false ? 'OFF' : 'ON'}
          </Text>
        </View>

        {/* PREPARE STATEMENT */}
        <View className="rounded-2xl border border-border bg-card p-4 mb-5">
          <Text className="text-headline font-bold text-card-foreground">
            Prepare Monthly Statement™
          </Text>

          <Text className="text-footnote text-muted-foreground mt-1 mb-3">
            Use the first day of the accounting month.
          </Text>

          <TextInput
            value={periodStart}
            onChangeText={setPeriodStart}
            placeholder="2026-09-01"
            placeholderTextColor="#6B7280"
            className="border border-border rounded-xl px-3 py-3 text-foreground bg-background"
          />

          <Pressable
            disabled={busy}
            onPress={()=>void runAction(
              'Prepare Settlement',
              ()=>prepareFestivalSettlement(periodStart,'USD')
            )}
            className="mt-3 rounded-xl bg-primary px-4 py-3 items-center"
          >
            <Text className="font-bold text-primary-foreground">
              PREPARE / REFRESH MONTHLY STATEMENT
            </Text>
          </Pressable>
        </View>

        {/* SUMMARY */}
        <View className="rounded-2xl border border-border bg-card p-4 mb-5">
          <View className="flex-row items-center gap-2">
            <Banknote size={18} color={THEME.accent}/>
            <Text className="text-headline font-bold text-card-foreground">
              Finance Snapshot
            </Text>
          </View>

          <Text className="text-footnote text-muted-foreground mt-3">
            Entry Ledger records: {ledger.length}
          </Text>

          <Text className="text-footnote text-muted-foreground mt-1">
            Monthly settlements: {settlements.length}
          </Text>

          <Text className="text-footnote text-muted-foreground mt-1">
            Payout destinations: {destinations.length}
          </Text>

          <Text className="text-footnote text-muted-foreground mt-1">
            Adjustments/refunds: {adjustments.length}
          </Text>

          {latest && (
            <View className="mt-4 pt-3 border-t border-border">
              <Text className="text-footnote font-bold text-foreground">
                Latest settlement
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                {latest.period_start} → {latest.period_end}
              </Text>

              <Text className="text-footnote text-foreground mt-1">
                {latest.status === 'draft' ? 'Draft net: ' : ''}
                {money(latest.status === 'draft' ? latest.net_festival_payout : (latest.available_for_payout ?? latest.net_festival_payout),latest.currency)}
                {' · '}
                {String(latest.status).toUpperCase()}
              </Text>
            </View>
          )}
        </View>


        {/* ENTRY LEDGER */}
        <View className="flex-row items-center gap-2 mb-3">
          <BookOpenCheck size={18} color={THEME.accent}/>
          <Text className="text-headline font-bold text-foreground">
            Entry Ledger™
          </Text>
        </View>

        {ledger.slice(0,10).map((r:any)=>(
          <View
            key={r.id}
            className="rounded-2xl border border-border bg-card p-4 mb-3"
          >
            <Text className="text-subhead font-semibold text-card-foreground">
              {money(r.gross_collected_amount,r.currency)}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Entry: {r.entry_fee_type}
              {' · '}
              Fee status: {r.fee_calculation_status}
            </Text>

            <Text className="text-footnote text-foreground mt-2">
              FFOS commission {money(r.ffos_commission_amount,r.currency)}
              {' · '}
              Festival {money(r.festival_entitlement_amount,r.currency)}
            </Text>

            {Number(r.refund_amount ?? 0) > 0 && (
              <Text className="text-footnote text-muted-foreground mt-2">
                Refunded {money(r.refund_amount,r.currency)}
                {' · '}
                Commission recorded {money(r.ffos_commission_amount,r.currency)}
              </Text>
            )}
          </View>
        ))}

        {ledger.length===0 && (
          <Text className="text-footnote text-muted-foreground mb-5">
            No Entry Ledger records for the active season.
          </Text>
        )}


        {/* SETTLEMENTS */}
        <View className="flex-row items-center gap-2 mt-4 mb-3">
          <Banknote size={18} color={THEME.accent}/>
          <Text className="text-headline font-bold text-foreground">
            Monthly Settlements™
          </Text>
        </View>

        {settlements.slice(0,8).map((r:any)=>(
          <View
            key={r.id}
            className="rounded-2xl border border-border bg-card p-4 mb-3"
          >
            <Text className="text-subhead font-semibold text-card-foreground">
              {r.period_start} → {r.period_end}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Status: {String(r.status).toUpperCase()}
              {' · '}
              Due: {r.payout_due_date}
            </Text>

            <Text className="text-footnote text-foreground mt-2">
              Net {money(r.net_festival_payout,r.currency)}
            </Text>

            <Text className="text-footnote text-foreground mt-1">
              Carry-in {money(r.prior_carry_forward,r.currency)}
              {' · '}
              Carry-out {money(r.carry_forward_out,r.currency)}
            </Text>

            <Text className="text-footnote font-semibold text-primary mt-2">
              {r.payout_eligible
                ? `PAYOUT ELIGIBLE · ${money(r.payout_amount,r.currency)}`
                : r.payout_hold_reason || 'Not yet payout eligible'}
            </Text>

            {r.status==='draft' && (
              <Pressable
                disabled={busy}
                onPress={()=>void runAction(
                  'Reconcile Settlement',
                  ()=>reconcileFestivalSettlement(r.id)
                )}
                className="mt-3 rounded-xl border border-border px-4 py-3 items-center"
              >
                <Text className="font-bold text-foreground">
                  RECONCILE / FREEZE MONTH
                </Text>
              </Pressable>
            )}

            {r.status==='reconciled' && r.payout_eligible && (
              <Pressable
                disabled={busy || !activeDestination}
                onPress={()=>void runAction(
                  'Schedule Payout',
                  ()=>scheduleFestivalPayout(
                    r.id,
                    activeDestination?.id
                  )
                )}
                className="mt-3 rounded-xl border border-border px-4 py-3 items-center"
              >
                <Text className="font-bold text-foreground">
                  SCHEDULE PAYOUT
                </Text>
              </Pressable>
            )}

            {r.status==='reconciled' &&
             r.payout_eligible &&
             !activeDestination && (
              <Text className="text-caption text-muted-foreground mt-2">
                Payout blocked until an ACTIVE + VERIFIED destination exists.
              </Text>
            )}

            {r.status==='scheduled' && (
              <View className="mt-3">
                <TextInput
                  value={providerReference}
                  onChangeText={setProviderReference}
                  placeholder="PayPal / bank / provider reference"
                  placeholderTextColor="#6B7280"
                  className="border border-border rounded-xl px-3 py-3 text-foreground bg-background"
                />

                <Pressable
                  disabled={busy || !providerReference.trim()}
                  onPress={()=>void runAction(
                    'Mark Settlement Paid',
                    async()=>{
                      await confirmFestivalPayoutPaid(
                        r.id,
                        providerReference
                      );
                      setProviderReference('');
                    }
                  )}
                  className="mt-2 rounded-xl bg-primary px-4 py-3 items-center"
                >
                  <Text className="font-bold text-primary-foreground">
                    MARK PAID
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}

        {settlements.length===0 && (
          <Text className="text-footnote text-muted-foreground mb-5">
            No monthly settlement statements prepared yet.
          </Text>
        )}


        {/* PAYOUT DESTINATIONS */}
        <View className="flex-row items-center gap-2 mt-4 mb-3">
          <WalletCards size={18} color={THEME.accent}/>
          <Text className="text-headline font-bold text-foreground">
            Payout Destinations™
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-card p-4 mb-4">
          <Text className="text-subhead font-semibold text-card-foreground">
            Add Payout Destination
          </Text>

          <View className="flex-row gap-2 mt-3">
            {[
              ['paypal','PayPal'],
              ['bank_transfer','Bank'],
              ['crypto_wallet','Crypto'],
            ].map(([value,label])=>(
              <Pressable
                key={value}
                onPress={()=>setDestinationType(value as any)}
                className="border border-border rounded-xl px-3 py-2"
              >
                <Text className="text-foreground font-semibold">
                  {destinationType===value ? '✓ ' : ''}{label}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={destinationLabel}
            onChangeText={setDestinationLabel}
            placeholder="Display label"
            placeholderTextColor="#6B7280"
            className="mt-3 border border-border rounded-xl px-3 py-3 text-foreground bg-background"
          />

          <TextInput
            value={destinationAccount}
            onChangeText={setDestinationAccount}
            placeholder={
              destinationType==='paypal'
                ? 'PayPal email'
                : destinationType==='crypto_wallet'
                ? 'Public wallet address'
                : 'Bank/provider reference'
            }
            placeholderTextColor="#6B7280"
            className="mt-2 border border-border rounded-xl px-3 py-3 text-foreground bg-background"
          />

          {destinationType==='crypto_wallet' && (
            <TextInput
              value={cryptoNetwork}
              onChangeText={setCryptoNetwork}
              placeholder="Network e.g. Ethereum"
              placeholderTextColor="#6B7280"
              className="mt-2 border border-border rounded-xl px-3 py-3 text-foreground bg-background"
            />
          )}

          <Pressable
            disabled={busy || !destinationLabel.trim()}
            onPress={()=>void runAction(
              'Add Payout Destination',
              async()=>{
                await createPayoutDestination({
                  destination_type:destinationType,
                  display_label:destinationLabel,
                  account_reference:destinationAccount,
                  crypto_network:
                    destinationType==='crypto_wallet'
                      ? cryptoNetwork
                      : undefined,
                  payout_currency:'USD',
                });

                setDestinationLabel('');
                setDestinationAccount('');
                setCryptoNetwork('');
              }
            )}
            className="mt-3 rounded-xl border border-border px-4 py-3 items-center"
          >
            <Text className="font-bold text-foreground">
              SAVE AS INACTIVE / UNVERIFIED
            </Text>
          </Pressable>

          <Text className="text-caption text-muted-foreground mt-2">
            New payout destinations cannot send money until separately verified and activated.
          </Text>
        </View>

        {destinations.map((r:any)=>(
          <View
            key={r.id}
            className="rounded-2xl border border-border bg-card p-4 mb-3"
          >
            <Text className="text-subhead font-semibold text-card-foreground">
              {r.display_label}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              {String(r.destination_type).replaceAll('_',' ')}
              {' · '}
              {String(r.status).toUpperCase()}
              {' · '}
              {String(r.verification_status).toUpperCase()}
            </Text>

            <Text className="text-footnote text-foreground mt-2">
              {r.account_reference || 'No account/wallet configured'}
            </Text>

            {r.crypto_network && (
              <Text className="text-footnote text-muted-foreground mt-1">
                Network: {r.crypto_network}
              </Text>
            )}
          </View>
        ))}


        {/* REFUNDS / ADJUSTMENTS */}
        <View className="flex-row items-center gap-2 mt-4 mb-3">
          <RotateCcw size={18} color={THEME.accent}/>
          <Text className="text-headline font-bold text-foreground">
            Refunds & Adjustments
          </Text>
        </View>

        {adjustments.slice(0,8).map((r:any)=>(
          <View
            key={r.id}
            className="rounded-2xl border border-border bg-card p-4 mb-3"
          >
            <Text className="text-subhead font-semibold text-card-foreground">
              {String(r.adjustment_type).replaceAll('_',' ')}
            </Text>

            <Text className="text-footnote text-foreground mt-1">
              {money(r.amount,r.currency)}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-2">
              {r.reason}
            </Text>

            {r.adjustment_type === 'refund' &&
             r.provider === 'paypal' &&
             r.environment === 'sandbox' &&
             r.provider_reference && (
              <View className="mt-3 rounded-xl border border-border bg-background p-3">
                <Text className="text-footnote font-bold text-foreground">
                  PAYPAL SANDBOX REFUND RECEIPT
                </Text>

                <Text className="text-footnote text-foreground mt-2">
                  Refund ID: {r.provider_reference}
                </Text>

                <Text className="text-footnote text-muted-foreground mt-1">
                  FFOS commission retained: {r.ffos_commission_retained ? 'YES' : 'NO'}
                </Text>
              </View>
            )}
          </View>
        ))}

        {adjustments.length===0 && (
          <Text className="text-footnote text-muted-foreground">
            No refund or adjustment records yet.
          </Text>
        )}

        <Text className="text-caption text-muted-foreground mt-7">
          Financial records are auditable. Raw card details, PayPal passwords,
          crypto private keys and wallet seed phrases are never stored here.
        </Text>
      </ScrollView>
    </View>
  );
}
