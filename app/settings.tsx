import { Bell, Globe2, KeyRound, Languages, Palette, PlugZap, UserRound } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function SettingsScreen(){return <OSHub eyebrow="ACCOUNT" title="Settings" subtitle="Profile, accessibility, notifications, localisation, security and connected-service controls." items={[
{title:'Profile',detail:'Account identity, organisation memberships and role switching.',icon:UserRound,route:'/login'},
{title:'Language & Locale',detail:'Translatable copy, locale-aware dates/numbers and future multilingual UI.',icon:Languages},
{title:'Region & Time Zone',detail:'Country, region, time zone and eligibility context.',icon:Globe2},
{title:'Notifications',detail:'Permitted operational and marketing communication preferences.',icon:Bell},
{title:'Appearance & Accessibility',detail:'Theme, contrast, motion preferences and accessible interaction.',icon:Palette},
{title:'Security',detail:'Password, optional MFA, active sessions and sensitive-action controls.',icon:KeyRound,badge:'BACKEND'},
{title:'Connected Services',detail:'Payment, email, video, ticket, analytics and future social integrations.',icon:PlugZap,badge:'ADAPTERS'},
]}/>}
