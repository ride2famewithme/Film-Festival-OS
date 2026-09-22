import { Database, Fingerprint, KeyRound, Layers3, ListChecks, ShieldCheck, UsersRound } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function BackendFoundationScreen() {
  return <OSHub
    eyebrow="BACKEND · BLOCK 1"
    title="Backend & Real Data Foundation"
    subtitle="The first bridge from product shell to controlled real data: tenant structure, roles, typed tables, service boundaries and audit-ready events."
    statusTitle="LIVE TEST FOUNDATION · SUPABASE + RLS + AUDITED WORKFLOWS"
    statusText="The local/test build is connected to Supabase with applied migrations, authenticated tenant memberships, database Row Level Security and persistent audited workflows. Public production deployment, external provider integrations and release hardening remain separate release tasks."
    items={[
      { title: 'Tenant Architecture', detail: 'HQ → territory/operator → festival data boundaries with parent/child tenant relationships.', icon: Layers3, badge: 'BUILT' },
      { title: 'Membership & Role Model', detail: 'Platform admin, festival owner/staff, juror, creator and sponsor/partner roles.', icon: UsersRound, badge: 'BUILT' },
      { title: 'Permission Matrix', detail: 'Explicit role permissions now govern tenant, festival, submission, jury, projects, risk, finance, audit and platform operations.', icon: KeyRound, badge: 'BUILT' },
      { title: 'Core Data Contract', detail: 'Typed schema for tenants, memberships, projects, tasks, risks, incidents, suppliers and audit events.', icon: Database, badge: 'BUILT' },
      { title: 'Tenant-Scoped Service Layer', detail: 'Shared workflows enforce authenticated tenant context and permissions alongside database RLS boundaries.', icon: ShieldCheck, badge: 'ACTIVE' },
      { title: 'Persistent Audit Events', detail: 'Actor, tenant, action, entity, detail and timestamp records are written by controlled operational workflows.', icon: Fingerprint, badge: 'ACTIVE' },
      { title: 'Authentication & Tenant Security', detail: 'Supabase authentication, tenant membership context, MFA paths and applied database RLS controls are integrated.', icon: ShieldCheck, route: '/backend-security', badge: 'ACTIVE' },
      { title: 'Release Hardening', detail: 'Remaining work focuses on production deployment, provider integrations, monitoring and final release verification.', icon: ListChecks, badge: 'RELEASE' },
    ]}
  />;
}
