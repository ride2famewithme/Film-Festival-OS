import { Building2, FileWarning, ShieldCheck, Workflow } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function ComplianceScreen() {
  return <OSHub
    eyebrow="SAFETY NET CENTRE™"
    title="Compliance Obligations Register"
    subtitle="A jurisdiction-aware register of obligations, owners, evidence, applicability and review status."
    statusTitle="Country-gated"
    statusText="Requirements can be activated by jurisdiction and business activity rather than assuming one global rule applies everywhere."
    items={[
      { title: 'Obligations', detail: 'Requirement, source, owner, applicability, due/review date and evidence.', icon: ShieldCheck },
      { title: 'Jurisdiction Matrix', detail: 'Global HQ, country, region and local-festival requirements and activation status.', icon: Building2 },
      { title: 'Exceptions & Gaps', detail: 'Known gaps, legal-review flags, compensating controls and remediation owner.', icon: FileWarning },
      { title: 'Evidence & Attestations', detail: 'Policies, approvals, licences, insurance, declarations and review records.', icon: Workflow },
    ]}
  />;
}
