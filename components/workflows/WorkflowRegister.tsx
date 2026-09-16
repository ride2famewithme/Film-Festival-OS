import { goWorkspaceHome } from '@/lib/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, CirclePlus, RefreshCw } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@/constants/theme';

type Row = Record<string, any>;

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  emptyText: string;
  inputLabel: string;
  inputPlaceholder: string;
  load: () => Promise<Row[]>;
  create: (value: string) => Promise<unknown>;
  createSuccessMessage?: string;
  primary: (row: Row) => string;
  secondary: (row: Row) => string;
  status: (row: Row) => string;
  onAdvance?: (row: Row) => Promise<unknown>;
  advanceLabel?: string;
};

export function WorkflowRegister(props: Props) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const reload = useCallback(async () => {
    setBusy(true); setMessage('');
    try { setRows(await props.load()); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to load'); }
    finally { setBusy(false); }
  }, [props.load]);

  useEffect(() => { void reload(); }, [reload]);

  async function add() {
    if (!value.trim()) return;
    setBusy(true); setMessage('');
    try { await props.create(value.trim()); setValue(''); await reload(); setMessage(props.createSuccessMessage ?? 'Saved and audit event recorded.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save'); setBusy(false); }
  }

  async function advance(row: Row) {
    if (!props.onAdvance) return;
    setBusy(true); setMessage('');
    try { await props.onAdvance(row); await reload(); setMessage('Status updated and audit event recorded.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to update'); setBusy(false); }
  }

  return <View className="flex-1 bg-background"><ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 48, paddingHorizontal: 20 }}>
    <Pressable onPress={() => void goWorkspaceHome()} className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"><ArrowLeft color={THEME.accent} size={19}/></Pressable>
    <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">{props.eyebrow}</Text>
    <Text className="text-title1 font-bold text-foreground mt-1">{props.title}</Text>
    <Text className="text-subhead text-muted-foreground mt-2">{props.subtitle}</Text>

    <View className="rounded-2xl border border-border bg-card p-4 mt-6">
      <Text className="text-headline font-semibold text-card-foreground">{props.inputLabel}</Text>
      <TextInput value={value} onChangeText={setValue} placeholder={props.inputPlaceholder} placeholderTextColor={THEME.muted} className="mt-3 rounded-xl border border-border px-4 py-3 text-foreground bg-background"/>
      <Pressable onPress={() => void add()} disabled={busy || !value.trim()} className="mt-3 rounded-xl bg-primary px-4 py-3 flex-row items-center justify-center gap-2" style={{opacity: busy || !value.trim() ? .45 : 1}}>
        <CirclePlus color={THEME.background} size={18}/><Text className="font-semibold text-background">Create & Save</Text>
      </Pressable>
    </View>

    <View className="flex-row items-center justify-between mt-6 mb-3">
      <Text className="text-headline font-semibold text-foreground">Live Register</Text>
      <Pressable onPress={() => void reload()} className="p-2"><RefreshCw color={THEME.accent} size={18}/></Pressable>
    </View>
    {busy && rows.length === 0 ? <ActivityIndicator color={THEME.accent}/> : null}
    {!busy && rows.length === 0 ? <Text className="text-muted-foreground">{props.emptyText}</Text> : null}
    <View className="gap-3">
      {rows.map((row) => <View key={String(row.id)} className="rounded-2xl border border-border bg-card p-4">
        <View className="flex-row justify-between gap-3"><Text className="text-headline font-semibold text-card-foreground flex-1">{props.primary(row)}</Text><Text className="text-caption font-bold text-primary uppercase">{props.status(row)}</Text></View>
        <Text className="text-footnote text-muted-foreground mt-1">{props.secondary(row)}</Text>
        {props.onAdvance ? <Pressable onPress={() => void advance(row)} disabled={busy} className="mt-3 self-start rounded-lg border border-primary px-3 py-2"><Text className="text-footnote font-semibold text-primary">{props.advanceLabel ?? 'Advance status'}</Text></Pressable> : null}
      </View>)}
    </View>
    {message ? <View className="rounded-xl border border-border bg-card p-3 mt-5"><Text className="text-footnote text-muted-foreground">{message}</Text></View> : null}
  </ScrollView></View>;
}
