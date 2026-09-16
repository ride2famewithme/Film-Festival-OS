import { BarChart3, Link2, Megaphone, Palette, Share2, Store, Target } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function MarketingScreen(){return <OSHub eyebrow="GROWTH" title="Marketing Workspace" subtitle="Festival-controlled promotion, campaign assets, approved integrations and measurable marketplace activity." items={[
{title:'Campaign Dashboard',detail:'Plan approved festival, sponsor and membership campaigns.',icon:Megaphone},
{title:'Ad Creator',detail:'Create reusable promotional layouts, copy and campaign assets.',icon:Palette},
{title:'Marketplace',detail:'Future controlled inventory for festival and partner opportunities.',icon:Store,badge:'LATER'},
{title:'Audience & Regions',detail:'Target permitted countries, regions and festival audiences.',icon:Target,route:'/network'},
{title:'Connected Channels',detail:'Social/video/advertising providers connect explicitly through adapters.',icon:Share2,badge:'PARKED'},
{title:'Tracking Links',detail:'Campaign links, source attribution and later conversion measurement.',icon:Link2},
{title:'Performance',detail:'Evidence-based campaign analytics; no unsupported performance claims.',icon:BarChart3,route:'/reports'},
]}/>}
