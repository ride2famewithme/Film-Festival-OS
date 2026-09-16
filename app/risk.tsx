import { Activity, Building2, FileWarning, LockKeyhole, ShieldCheck, Workflow } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function RiskScreen() {
  return <OSHub
    eyebrow="RISK • COMPLIANCE • RESILIENCE"
    title="Safety Net Centre™"
    subtitle="A controlled governance layer for operational risk, incidents, suppliers, continuity, compliance obligations and access governance."
    statusTitle="Framework-first — not a regulatory claim"
    statusText="This workspace is designed as a practical safety-net inspired by recognised risk-management principles. It does not claim Film Festival OS™ is APRA-regulated or certified against CPS/SPS standards."
    items={[
      { title: 'Enterprise Risk Register', detail: 'Record risk, likelihood, impact, owner, controls, residual rating, actions and review dates.', icon: FileWarning, route: '/risk-register' },
      { title: 'Incidents & Remediation', detail: 'Capture incidents, severity, containment, owner, recovery, root cause and lessons learned.', icon: Activity, route: '/incidents' },
      { title: 'Critical Suppliers & Dependencies', detail: 'Track hosting, payments, email, AI, storage, ticketing and other material service dependencies.', icon: Building2, route: '/suppliers' },
      { title: 'Business Continuity & Recovery', detail: 'Critical operations, outage tolerances, recovery priorities, backup/restore and alternate-provider plans.', icon: Workflow, route: '/continuity' },
      { title: 'Compliance Obligations Register', detail: 'Map obligations by country, regulator, subject, owner, evidence, review date and activation status.', icon: ShieldCheck, route: '/compliance' },
      { title: 'Access & Role Governance', detail: 'Least privilege, MFA policy, privileged access, role expiry, separation of duties and periodic review.', icon: LockKeyhole, route: '/access-governance' },
      { title: 'Policies, Controls & Assurance', detail: 'Policy versions, approvals, control design, implementation status, evidence and remediation tracking.', icon: ShieldCheck, route: '/policies-controls' },
    ]}
  />;
}
