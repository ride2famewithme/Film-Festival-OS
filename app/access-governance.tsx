import { Activity, LockKeyhole, ShieldCheck, Users } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function AccessGovernanceScreen() {
  return <OSHub
    eyebrow="SAFETY NET CENTRE™"
    title="Access & Role Governance"
    subtitle="Control who can enter each part of Film Festival OS™ and what they are authorised to see or change."
    statusTitle="Least privilege by default"
    statusText="External operators, staff, jurors, sponsors and creators should receive only the permissions required for their role and tenant."
    items={[
      { title: 'Role Catalogue', detail: 'Platform, franchise/operator, festival, staff, juror, creator and sponsor roles.', icon: Users },
      { title: 'Privileged Access', detail: 'Global HQ/admin privileges, MFA requirements, sensitive-action controls and re-authentication.', icon: LockKeyhole },
      { title: 'Access Reviews', detail: 'Periodic review, role expiry, dormant accounts, departures and emergency revocation.', icon: Activity },
      { title: 'Emergency Suspension', detail: 'Immediately suspend or reactivate compromised membership access with audit evidence.', icon: LockKeyhole, route: '/emergency-access', badge: 'PRODUCTION' },
      { title: 'Segregation & Audit', detail: 'Conflict checks, separation of duties and traceable permission changes.', icon: ShieldCheck },
    ]}
  />;
}
