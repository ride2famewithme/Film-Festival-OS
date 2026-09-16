import { BellRing, Inbox, MailCheck, MessageSquareText, Send, UsersRound } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function CommunicationsScreen(){return <OSHub eyebrow="COMMUNICATIONS" title="Message Centre" subtitle="Role-aware communication for submitters, jurors, staff and approved contacts." statusTitle="Workflow-backed" statusText="Template records and notification queue are persistent through the active data adapter. External sending remains provider/server-worker dependent." items={[
{title:'Submitter Messages',detail:'Operational messages and support conversations linked to submissions.',icon:Inbox,badge:'NEXT'},
{title:'Notification Manager',detail:'Selection, rejection, award and status notification queue.',icon:BellRing,route:'/notification-queue'},
{title:'Templates',detail:'Create, pause and reuse approved tenant-scoped communication templates.',icon:MessageSquareText,route:'/communication-templates'},
{title:'Jury & Staff',detail:'Private operational communication without exposing jury identities publicly.',icon:UsersRound,badge:'NEXT'},
{title:'Delivery Audit',detail:'Queued communication records plus workflow audit evidence.',icon:MailCheck,route:'/audit-log'},
{title:'External Send Worker',detail:'Email provider connection, retries and delivery webhooks remain a production integration block.',icon:Send,badge:'PROVIDER'},
]}/>}
