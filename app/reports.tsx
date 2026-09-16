import { BarChart3, Download, FileSpreadsheet, Gauge, PieChart, ShieldCheck } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function ReportsScreen(){return <OSHub eyebrow="REPORTING" title="Reports & Exports" subtitle="Operational visibility for festival performance, submissions, jury progress, finance and controlled exports." statusTitle="Adapter-backed operations" statusText="Operational counts and export job records are implemented. File generation itself remains server-side work." items={[
{title:'Operational Dashboard',detail:'Live active-workspace counts for submissions, jury, payments, awards, projects, tasks and risks.',icon:Gauge,route:'/operations-dashboard'},
{title:'Submission Reports',detail:'Category, country, status, runtime, flags and decision summaries.',icon:PieChart,badge:'NEXT'},
{title:'Jury Progress',detail:'Assignments and completion status without exposing protected information.',icon:BarChart3,route:'/(tabs)/reviews'},
{title:'CSV / XLSX Requests',detail:'Create role-scoped export jobs with auditable request records.',icon:FileSpreadsheet,route:'/export-centre'},
{title:'Export Centre',detail:'Queued/generated/expired lifecycle, expiry metadata and future download location.',icon:Download,route:'/export-centre'},
{title:'Privacy Scope',detail:'Exports remain tenant/role scoped; production retention and redaction rules require validation.',icon:ShieldCheck,route:'/risk'},
]}/>}
