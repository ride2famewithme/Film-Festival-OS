import { CalendarDays, Flag, GitBranch, Hourglass, TriangleAlert } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function PMTimelineScreen() {
  return <OSHub eyebrow="PROJECT MANAGEMENT" title="Timeline & Milestones" subtitle="One view of delivery dates, dependencies and decision gates across the portfolio." items={[
    { title:'Timeline', detail:'Responsive project/date view for web/PWA, with mobile-friendly summary mode.', icon:CalendarDays, badge:'BUILD' },
    { title:'Milestones', detail:'Critical checkpoints, owners, due dates and evidence.', icon:Flag, badge:'BACKEND' },
    { title:'Dependencies', detail:'Project and task dependencies, hand-offs and blockers.', icon:GitBranch, badge:'BACKEND' },
    { title:'Waiting / External', detail:'Track work waiting on suppliers, approvals, customers or regulators.', icon:Hourglass, badge:'BACKEND' },
    { title:'Slippage / Exception', detail:'Surface late milestones and deliberate re-baselines rather than silently moving dates.', icon:TriangleAlert, badge:'BACKEND' },
  ]}/>;
}
