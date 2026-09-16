import { goWorkspaceHome } from '@/lib/navigation';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ChevronDown, Globe2, Map, MapPinned, Trophy } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@/constants/theme';

const layers=[
  {name:'Global HQ', detail:'Shared platform, IP, standards and global programmes', icon:Globe2},
  {name:'Continental / Regional Layer', detail:'Configurable coordination, cultural and market settings', icon:Map},
  {name:'Country / Territory Layer', detail:'Local operator network, language and approved commercial configuration', icon:MapPinned},
  {name:'Independent Festival', detail:'Own identity, programme, jury, categories, rules and operations', icon:Trophy},
  {name:'Global Pool', detail:'Optional direct-entry / advancement pathway with traceable rules', icon:Globe2},
];
export default function NetworkScreen(){const insets=useSafeAreaInsets();return <View className="flex-1 bg-background"><ScrollView contentContainerStyle={{paddingTop:insets.top+12,paddingBottom:insets.bottom+32,paddingHorizontal:20}}>
  <Pressable onPress={()=>void goWorkspaceHome()} className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"><ArrowLeft color={THEME.accent} size={19}/></Pressable>
  <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">GLOBAL ARCHITECTURE</Text><Text className="text-title1 font-bold text-foreground mt-1">One platform. Local independence.</Text><Text className="text-subhead text-muted-foreground mt-2 mb-6">Visual placeholder for the approved multi-tenant regional / continental model and optional Global Pool.</Text>
  <View className="gap-2">{layers.map(({name,detail,icon:Icon},i)=><View key={name}><View className="rounded-2xl border border-border bg-card p-4 flex-row gap-3 items-start"><Icon color={THEME.accent} size={21}/><View className="flex-1"><Text className="text-headline font-semibold text-card-foreground">{name}</Text><Text className="text-footnote text-muted-foreground mt-1">{detail}</Text></View></View>{i<layers.length-1&&<View className="items-center py-1"><ChevronDown color={THEME.muted} size={18}/></View>}</View>)}</View>
</ScrollView></View>}
