import { Bot, ClipboardCheck, Gauge, LockKeyhole, Scale, ShieldAlert, UsersRound } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function Jury(){return <OSHub eyebrow="PRIVATE JURY" title="Jury Management" subtitle="Private assignments, scoring and conflict controls with human authority retained over consequential festival decisions." statusTitle="Protected workspace" statusText="Juror identities, assignments, notes and scores remain private by default and separate from sponsor/public influence." items={[
{title:'Panel & Assignments',detail:'Approved jurors, assigned projects, completion status and reassignment.',icon:UsersRound,route:'/jury-panel'},
{title:'Scoring Forms',detail:'Versioned criteria, score scales, recommendations and required comments.',icon:ClipboardCheck,route:'/jury-scoring-forms'},
{title:'Weight Set',detail:'Controlled juror weighting and tie behaviour for the active competition configuration.',icon:Scale},
{title:'AI Juror',detail:'Criterion scores, reasoning, confidence and model/prompt provenance with human review.',icon:Bot,route:'/(tabs)/reviews'},
{title:'Integrity & Interference',detail:'Conflicts, recusal, canvassing, contact attempts, inducements, lobbying and score disclosure.',icon:ShieldAlert,route:'/jury-integrity'},
{title:'Progress Dashboard',detail:'Completion and workload status without leaking protected deliberations.',icon:Gauge,route:'/reports'},
{title:'Audit & Privacy',detail:'Versioned assignments, score submissions, overrides and sensitive access events.',icon:LockKeyhole,badge:'BACKEND'},
]}/>}
