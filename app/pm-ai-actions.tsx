import { Bot, CircleCheck, Lightbulb, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function PMAIActionsScreen() {
  return <OSHub eyebrow="PROJECT MANAGEMENT" title="AI Next Actions" subtitle="Human-reviewable management assistance — suggestions, not autonomous management decisions." statusTitle="AI governance boundary" statusText="AI may summarise, prioritise, flag, draft and suggest. Authorised humans approve consequential changes, risk acceptance, legal conclusions, financial commitments and access decisions." items={[
    { title:'Suggested Priorities', detail:'Propose the next most useful work based on status, due dates and blockers.', icon:Sparkles, badge:'BACKEND' },
    { title:'Blocker Detection', detail:'Flag stalled work, overdue dependencies and missing ownership.', icon:TriangleAlert, badge:'BACKEND' },
    { title:'Management Brief', detail:'Draft a compact portfolio or project status summary.', icon:Bot, badge:'BACKEND' },
    { title:'Improvement Suggestions', detail:'Suggest simplifications, sequencing or reusable templates.', icon:Lightbulb, badge:'BACKEND' },
    { title:'Human Review Queue', detail:'Accept, edit or reject AI recommendations before changes are applied.', icon:CircleCheck, badge:'BACKEND' },
    { title:'AI Governance', detail:'Review AI boundaries, evidence and override principles.', icon:ShieldCheck, route:'/policies-controls' },
  ]}/>;
}
