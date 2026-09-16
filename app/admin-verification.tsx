import { BadgeCheck } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function Screen() {
  return <OSHub
    eyebrow='GLOBAL HQ'
    title='Verification Centre'
    subtitle='Evidence-led approval workflow for festivals, operators and approved partners.'
    statusTitle="v4.0 pre-test shell"
    statusText="Workflow structure is represented here. Persistence, enforcement, automation and assurance require backend implementation and testing."
    items={[
      { title: 'Verification Queue', detail: 'Pending, approved, rejected and review-required applications.', icon: BadgeCheck, badge: 'BUILD' },
      { title: 'Evidence Checklist', detail: 'Entity, contact, festival, territory and supporting evidence requirements.', icon: BadgeCheck, badge: 'BUILD' },
      { title: 'Decision Record', detail: 'Reviewer, reason, evidence and timestamp for each verification decision.', icon: BadgeCheck, badge: 'BUILD' },
      { title: 'Renewal / Re-check', detail: 'Time-based or risk-triggered reverification.', icon: BadgeCheck, badge: 'BUILD' },
      { title: 'Escalation', detail: 'Route uncertain or higher-risk cases for management/professional review.', icon: BadgeCheck, badge: 'BUILD' },
    ]}
  />;
}
