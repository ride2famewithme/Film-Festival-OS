import { ShieldCheck } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function Screen() {
  return <OSHub
    eyebrow='SPONSOR / PARTNER'
    title='Governance Boundary'
    subtitle='Protect festival independence while allowing transparent commercial partnerships.'
    statusTitle="v4.0 pre-test shell"
    statusText="Workflow structure is represented here. Persistence, enforcement, automation and assurance require backend implementation and testing."
    items={[
      { title: 'Jury Independence', detail: 'No access to private scores, deliberations or undisclosed influence.', icon: ShieldCheck, badge: 'BUILD' },
      { title: 'Conflict Declarations', detail: 'Record relevant sponsor/festival/juror conflicts.', icon: ShieldCheck, badge: 'BUILD' },
      { title: 'Permitted Benefits', detail: 'Document approved sponsorship benefits and placements.', icon: ShieldCheck, badge: 'BUILD' },
      { title: 'Prohibited Influence', detail: 'Escalate attempts to alter selections, awards or private jury decisions.', icon: ShieldCheck, badge: 'BUILD' },
      { title: 'Audit Record', detail: 'Preserve approvals, exceptions and governance decisions.', icon: ShieldCheck, badge: 'BUILD' },
    ]}
  />;
}
