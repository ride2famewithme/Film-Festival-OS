import { BarChart3, CreditCard, Mail, PlugZap, Ticket, Video } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function Integrations(){return <OSHub eyebrow="ADAPTERS" title="Integrations" subtitle="External providers connect through controlled adapters so Film Festival OS™ is not locked to one service." items={[
{title:'Payments',detail:'Provider-neutral payment, refund and payout adapter boundary for native checkout.',icon:CreditCard,badge:'BACKEND'},
{title:'Transactional Email',detail:'Submission confirmations, ticket receipts, notifications and delivery-status integration.',icon:Mail,badge:'BACKEND'},
{title:'Video & Media',detail:'Approved secure-video links, native streaming entitlements and media-provider connections.',icon:Video,badge:'BACKEND'},
{title:'Ticketing',detail:'Native event, venue, inventory and order foundation with optional Ticketebo, Eventbrite and future provider adapters.',icon:Ticket,badge:'FOUNDATION'},
{title:'Analytics',detail:'Privacy-aware operational, ticket-sales and campaign analytics integration.',icon:BarChart3,badge:'BACKEND'},
{title:'Social / Advertising',detail:'Explicitly connected channels only; META/Facebook remains parked for the later integration milestone.',icon:PlugZap,badge:'PARKED'},
]}/>}
