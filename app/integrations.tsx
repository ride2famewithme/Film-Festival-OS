import { BarChart3, CreditCard, Mail, PlugZap, Ticket, Video } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function Integrations(){return <OSHub eyebrow="ADAPTERS" title="Integrations" subtitle="External providers connect through controlled adapters so Film Festival OS™ is not locked to one service." items={[
{title:'Payments',detail:'Provider-neutral payment, refund and payout adapter boundary.',icon:CreditCard,badge:'BACKEND'},
{title:'Transactional Email',detail:'Submission confirmations, notifications and delivery-status integration.',icon:Mail,badge:'BACKEND'},
{title:'Video & Media',detail:'Approved secure-video links and media-provider connections.',icon:Video,badge:'BACKEND'},
{title:'Ticketing',detail:'Initial third-party ticket links/adapters before any native ticketing build.',icon:Ticket,badge:'LATER'},
{title:'Analytics',detail:'Privacy-aware operational and campaign analytics integration.',icon:BarChart3,badge:'BACKEND'},
{title:'Social / Advertising',detail:'Explicitly connected channels only; META/Facebook remains parked for the later integration milestone.',icon:PlugZap,badge:'PARKED'},
]}/>}
