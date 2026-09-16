import { Activity, FileWarning, LifeBuoy, ShieldCheck } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function IncidentsScreen() {
  return <OSHub
    eyebrow="SAFETY NET CENTRE™"
    title="Incidents & Remediation"
    subtitle="Operational, security, privacy, payment, supplier and service incidents with accountable recovery and follow-up."
    statusTitle="Evidence before closure"
    statusText="An incident should not be marked closed until containment, remediation, owner sign-off and required evidence are recorded."
    items={[
      { title: 'Active Incidents', detail: 'Severity, affected operation, start time, owner, containment and current status.', icon: FileWarning },
      { title: 'Response Actions', detail: 'Immediate containment, user communication, supplier escalation and recovery actions.', icon: LifeBuoy },
      { title: 'Root Cause & Lessons', detail: 'Cause analysis, recurrence prevention and control improvements.', icon: Activity },
      { title: 'Closure & Evidence', detail: 'Approvals, attachments, audit record and post-incident review.', icon: ShieldCheck },
    ]}
  />;
}
