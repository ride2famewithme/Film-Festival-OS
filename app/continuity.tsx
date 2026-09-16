import { Activity, Database, LifeBuoy, Workflow } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function ContinuityScreen() {
  return <OSHub
    eyebrow="SAFETY NET CENTRE™"
    title="Business Continuity & Recovery"
    subtitle="Protect critical festival operations and define how service is restored after disruption."
    statusTitle="Critical operations first"
    statusText="Submissions, authentication, jury work, payments, notifications, award records and core data should each have recovery priorities and tolerances."
    items={[
      { title: 'Critical Operations', detail: 'Services that must be restored first and their responsible owners.', icon: Workflow },
      { title: 'Tolerance & Recovery Targets', detail: 'Maximum tolerable disruption, recovery objectives and escalation thresholds.', icon: Activity },
      { title: 'Backup & Restore', detail: 'Backup policy, retention, restore evidence and recovery checkpoints.', icon: Database, route: '/backup-evidence', badge: 'PRODUCTION' },
      { title: 'Continuity Playbooks', detail: 'Outage, cyber, payment, provider and communications response playbooks.', icon: LifeBuoy },
    ]}
  />;
}
