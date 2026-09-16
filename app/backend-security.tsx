import { DatabaseZap, Fingerprint, KeyRound, LockKeyhole, ServerCog, ShieldCheck, UsersRound } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function BackendSecurityScreen() {
  return <OSHub
    eyebrow="BACKEND · BLOCK 2"
    title="Authentication & Tenant Security"
    subtitle="Production-capable adapter path and database-side Row Level Security for the Film Festival OS™ multi-tenant architecture."
    statusTitle="CODED · REQUIRES LIVE DATABASE CONFIGURATION & TESTING"
    statusText="Supabase auth and RLS architecture is now in source. No live credentials are embedded. Policies must be applied and tested in a controlled Supabase project before production use."
    items={[
      { title: 'Production Adapter', detail: 'EXPO_PUBLIC_ADAPTER=supabase switches the shared data layer from mock storage to Supabase.', icon: DatabaseZap, badge: 'CODED' },
      { title: 'Secure Sign-In Path', detail: 'Email/password sign-in now calls the shared auth adapter rather than simply navigating past the login screen.', icon: LockKeyhole, badge: 'CODED' },
      { title: 'Tenant Membership Context', detail: 'Active tenant is selected only from the authenticated user’s active memberships.', icon: UsersRound, badge: 'CODED' },
      { title: 'Database Row Security', detail: 'SQL migration enables RLS on tenants, memberships, projects, tasks, risks, incidents, suppliers and audit events.', icon: ShieldCheck, badge: 'MIGRATION' },
      { title: 'Role Enforcement', detail: 'Platform admin, festival owner/staff and creator-owned records receive database-level policy boundaries.', icon: KeyRound, badge: 'RLS' },
      { title: 'Audit Actor Protection', detail: 'Audit inserts require actor_user_id to match the authenticated user and an authorised tenant.', icon: Fingerprint, badge: 'RLS' },
      { title: 'Next Backend Block', detail: 'Connect first persistent workflows: projects/tasks, festival profile/season, risk register, then controlled writes and audit events.', icon: ServerCog, badge: 'NEXT' },
    ]}
  />;
}
