import { Captions, FileText, Image, Link2, ShieldCheck, Users, Video } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function PressKit(){return <OSHub eyebrow="CREATOR ASSETS" title="Reusable Press Kit" subtitle="One project package that can be reused across eligible festival submissions instead of rebuilding the same materials repeatedly." items={[
{title:'Synopsis & Project Notes',detail:'Short/long synopsis, logline, director statement and project notes.',icon:FileText},
{title:'Credits & Team',detail:'Director, producer, cast, crew and production credits.',icon:Users},
{title:'Poster & Stills',detail:'Approved poster, stills, key art and captions.',icon:Image},
{title:'Trailer / Screener Links',detail:'Trailer and approved viewing links with later secure-provider support.',icon:Video},
{title:'Subtitles',detail:'English and translated subtitle assets, language and version records.',icon:Captions},
{title:'Rights & Declarations',detail:'Ownership, permissions, music/media declarations and required consent.',icon:ShieldCheck},
{title:'Public / Private Links',detail:'Reusable project links with visibility controls.',icon:Link2},
]}/>}
