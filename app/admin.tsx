import { Activity, BadgeCheck, Building2, Database, FileWarning, Landmark, LifeBuoy, LockKeyhole, Settings2, ShieldCheck, Users } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function AdminScreen() {
  return <OSHub
    eyebrow="GLOBAL HQ"
    title="Platform Administration"
    subtitle="Platform-wide governance for organisations, verification, moderation, finance oversight, support, configuration and audit."
    statusTitle="Least privilege"
    statusText="Platform administration is separate from festival operation and private jury work. Sensitive actions require controlled access and audit."
    items={[
      { title: 'Organisations & Tenants', detail: 'Festivals, operators, partners, territory relationships and account status.', icon: Building2, route: '/admin-organisations' },
      { title: 'Franchise / Tenant Oversight', detail: 'Global HQ hierarchy and operator status controls with audit records.', icon: Building2, route: '/hq-oversight' },
      { title: 'Verification', detail: 'Festival and partner verification queues, evidence and approval status.', icon: BadgeCheck, route: '/admin-verification' },
      { title: 'People & Roles', detail: 'Platform admins, festival staff, creator accounts and role assignments.', icon: Users, route: '/people' },
      { title: 'Moderation & Appeals', detail: 'Reported content, reviews, complaints, reasons, appeals and audit trail.', icon: FileWarning, route: '/admin-moderation' },
      { title: 'Finance Oversight', detail: 'Provider status, commissions, refunds, payouts and ledger supervision.', icon: Landmark, route: '/admin-finance' },
      { title: 'Security & Audit', detail: 'Sensitive events, access history, incidents, backups and evidence.', icon: LockKeyhole, route: '/admin-security' },
      { title: 'Risk, Compliance & Resilience', detail: 'Enterprise risk, supplier dependency, continuity, obligations, policies and control assurance.', icon: ShieldCheck, route: '/risk' },
      { title: 'Data & Integrations', detail: 'Database health, object storage, adapters, webhooks and provider status.', icon: Database, route: '/admin-data' },
      { title: 'Backend Foundation', detail: 'Tenant, role, data-contract and audit foundations for the move from shell to real operations.', icon: Database, route: '/backend-foundation' },
      { title: 'Support Centre', detail: 'Escalations, help content, operator support and service-status workflows.', icon: LifeBuoy, route: '/support' },
      { title: 'Platform Configuration', detail: 'Feature flags, regions, languages, policies and global settings.', icon: Settings2, route: '/admin-config' },
      { title: 'System Health', detail: 'Operational readiness and later production reliability indicators.', icon: Activity, route: '/admin-health' },
    ]}
  />;
}
