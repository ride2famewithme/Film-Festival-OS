import { Activity, Gauge, ListTodo, Target, TimerReset, TriangleAlert } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function PMKPIsScreen() {
  return <OSHub eyebrow="PROJECT MANAGEMENT" title="KPIs & Management Dashboard" subtitle="Management-by-exception: show what needs attention rather than burying operators in charts." items={[
    { title:'Delivery Health', detail:'Project status, confidence, milestone health and overdue actions.', icon:Gauge, badge:'BACKEND' },
    { title:'KPI Register', detail:'KPI definition, target, actual, owner, frequency and trend.', icon:Target, badge:'BACKEND' },
    { title:'Action Health', detail:'Open, overdue, blocked and awaiting-approval actions.', icon:ListTodo, badge:'BACKEND' },
    { title:'Cycle / Response Time', detail:'Optional operational service and workflow timing metrics.', icon:TimerReset, badge:'BACKEND' },
    { title:'Exceptions', detail:'Risks, missed milestones and indicators outside tolerance.', icon:TriangleAlert, route:'/risk' },
    { title:'Management Pulse', detail:'Compact executive roll-up for authorised franchise/HQ users.', icon:Activity, badge:'BACKEND' },
  ]}/>;
}
