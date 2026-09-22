import { DatabaseZap, Fingerprint, KeyRound, LockKeyhole, ServerCog, ShieldCheck, UsersRound } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function BackendSecurityScreen() {
  return <OSHub
    eyebrow="BACKEND · BLOCK 2"
    title="Authentication & Tenant Security"
    subtitle="Production-capable adapter path and database-side Row Level Security for the Film Festival OS™ multi-tenant architecture."
    statusTitle="LIVE TEST SECURITY FOUNDATION · SUPABASE + RLS ACTIVE"
    statusText="Supabase authentication, memberships and database RLS are active in the controlled Film Festival OS™ test environment. Production deployment, production secrets, external providers and final release verification remain separate release tasks."
    items={[
      { title: 'Supabase Data Layer', detail: 'The current controlled test build uses Supabase-backed authentication and persistent operational data.', icon: DatabaseZap, badge: 'ACTIVE' },
      { title: 'Secure Sign-In Path', detail: 'Authenticated sign-in, tenant membership selection and additional security paths are integrated with Supabase.', icon: LockKeyhole, badge: 'ACTIVE' },
      { title: 'Tenant Membership Context', detail: 'Active tenant access is resolved from the authenticated user’s authorised memberships.', icon: UsersRound, badge: 'ACTIVE' },
      { title: 'Database Row Security', detail: 'Applied migrations enforce tenant and role boundaries across core operational tables using Row Level Security.', icon: ShieldCheck, badge: 'ACTIVE' },
      { title: 'Role Enforcement', detail: 'Platform admin, festival owner/staff and creator-owned records receive database-level policy boundaries.', icon: KeyRound, badge: 'RLS' },
      { title: 'Audit Actor Protection', detail: 'Audit inserts require actor_user_id to match the authenticated user and an authorised tenant.', icon: Fingerprint, badge: 'RLS' },
      { title: 'Release Security Work', detail: 'Remaining work includes production environment configuration, provider secrets, monitoring and final release assurance.', icon: ServerCog, badge: 'RELEASE' },
    ]}
  />;
}
