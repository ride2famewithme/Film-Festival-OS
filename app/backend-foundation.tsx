import { Database, Fingerprint, KeyRound, Layers3, ListChecks, ShieldCheck, UsersRound } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function BackendFoundationScreen() {
  return <OSHub
    eyebrow="BACKEND · BLOCK 1"
    title="Backend & Real Data Foundation"
    subtitle="The first bridge from product shell to controlled real data: tenant structure, roles, typed tables, service boundaries and audit-ready events."
    statusTitle="FOUNDATION BUILT · BLOCK 2 SECURITY PATH ADDED"
    statusText="The app now has mock and Supabase adapter paths plus a database RLS migration. A live database, migration application and security testing are still required before production use."
    items={[
      { title: 'Tenant Architecture', detail: 'HQ → territory/operator → festival data boundaries with parent/child tenant relationships.', icon: Layers3, badge: 'BUILT' },
      { title: 'Membership & Role Model', detail: 'Platform admin, festival owner/staff, juror, creator and sponsor/partner roles.', icon: UsersRound, badge: 'BUILT' },
      { title: 'Permission Matrix', detail: 'Explicit permissions for tenant, festival, submission, jury, projects, risk, audit and platform configuration.', icon: KeyRound, badge: 'DESIGNED' },
      { title: 'Core Data Contract', detail: 'Typed schema for tenants, memberships, projects, tasks, risks, incidents, suppliers and audit events.', icon: Database, badge: 'BUILT' },
      { title: 'Tenant-Scoped Service Layer', detail: 'Read/write service helpers reject cross-tenant access before a production adapter is attached.', icon: ShieldCheck, badge: 'FOUNDATION' },
      { title: 'Audit Event Foundation', detail: 'Actor, tenant, action, entity, detail and timestamp structure ready for persistent audit logging.', icon: Fingerprint, badge: 'FOUNDATION' },
      { title: 'Authentication & Tenant Security', detail: 'Supabase adapter, sign-in wiring and database RLS migration are now included.', icon: ShieldCheck, route: '/backend-security', badge: 'BLOCK 2' },
      { title: 'Next Backend Block', detail: 'Connect first real persistent workflows and controlled audited writes.', icon: ListChecks, badge: 'NEXT' },
    ]}
  />;
}
