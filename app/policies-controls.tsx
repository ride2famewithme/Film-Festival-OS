import { Activity, FileWarning, ShieldCheck, Workflow } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function PoliciesControlsScreen() {
  return <OSHub
    eyebrow="SAFETY NET CENTRE™"
    title="Policies, Controls & Assurance"
    subtitle="Version policies and prove whether safeguards are merely designed, implemented, tested or remediated."
    statusTitle="No painted-wall compliance"
    statusText="A control can be marked Designed, Implemented, Tested, Failed, Remediation Required or Closed — avoiding unsupported claims of compliance."
    items={[
      { title: 'Policy Register', detail: 'Policy owner, version, approval, effective date, next review and applicable entities.', icon: Workflow },
      { title: 'Control Library', detail: 'Control purpose, owner, linked risks/obligations and implementation status.', icon: ShieldCheck },
      { title: 'Assurance & Testing', detail: 'Evidence, test result, reviewer, exceptions and retest date.', icon: Activity },
      { title: 'Remediation Queue', detail: 'Failed or missing controls, priority, owner, due date and closure evidence.', icon: FileWarning },
    ]}
  />;
}
