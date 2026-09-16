import { goWorkspaceHome } from '@/lib/navigation';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, Download, FileSpreadsheet, RefreshCw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@/constants/theme';
import {
  generateExportFile,
  listExportJobs,
} from '@/data/workflows/operations-hq';

export default function Screen() {
  const i = useSafeAreaInsets();
  const [rows,setRows] = useState<any[]>([]);
  const [busy,setBusy] = useState(false);

  const load = async () => {
    try {
      setRows(await listExportJobs());
    } catch(e:any) {
      Alert.alert('Exports',e.message);
    }
  };

  useEffect(() => { void load(); }, []);

  const download = async (
    type:'submissions'|'operations',
    format:'csv'|'json'
  ) => {
    try {
      setBusy(true);

      const file = await generateExportFile(type,format);

      if (typeof document === 'undefined') {
        Alert.alert(
          'Export generated',
          `${file.filename} was generated. Browser download is available in the web/PWA version.`
        );
        await load();
        return;
      }

      const blob = new Blob([file.content],{type:file.mime});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      await load();

    } catch(e:any) {
      Alert.alert('Export',e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingTop:i.top+12,
          paddingBottom:i.bottom+40,
          paddingHorizontal:20
        }}
      >
        <Pressable
          onPress={() => void goWorkspaceHome()}
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft color={THEME.accent} size={19}/>
        </Pressable>

        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
          REPORTING
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          Export Centre
        </Text>

        <Text className="text-subhead text-muted-foreground mt-1 mb-5">
          Generate real tenant-scoped files for local download with an auditable export record.
        </Text>

        <View className="flex-row gap-2 mb-5">
          <Pressable
            disabled={busy}
            onPress={() => download('submissions','csv')}
            className="flex-1 rounded-xl bg-primary px-3 py-3 items-center"
          >
            <Text className="font-semibold">
              {busy ? 'Working…' : 'Submissions CSV'}
            </Text>
          </Pressable>

          <Pressable
            disabled={busy}
            onPress={() => download('operations','json')}
            className="flex-1 rounded-xl border border-primary px-3 py-3 items-center"
          >
            <Text className="font-semibold text-primary">
              Operations JSON
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={load} className="self-end mb-3">
          <RefreshCw size={19} color={THEME.accent}/>
        </Pressable>

        {rows.map((r:any) => (
          <View
            key={r.id}
            className="rounded-2xl border border-border bg-card p-4 mb-3"
          >
            <View className="flex-row gap-2 items-center">
              <FileSpreadsheet size={17} color={THEME.accent}/>
              <Text className="text-headline font-semibold text-card-foreground">
                {r.report_type} · {String(r.format).toUpperCase()}
              </Text>
            </View>

            <Text className="text-footnote text-muted-foreground mt-1">
              {r.status} · requested {new Date(r.requested_at).toLocaleString()}
            </Text>

            {r.file_path ? (
              <View className="flex-row gap-2 items-center mt-2">
                <Download size={15} color={THEME.accent}/>
                <Text className="text-footnote text-foreground">
                  {r.file_path}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
