import { Building2 } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function Screen() {
  return <OSHub
    eyebrow='GLOBAL HQ'
    title='Organisations & Tenants'
    subtitle='Control festival organisations, operators, partners, territories and account standing.'
    statusTitle="v4.0 pre-test shell"
    statusText="Workflow structure is represented here. Persistence, enforcement, automation and assurance require backend implementation and testing."
    items={[
      { title: 'Organisation Directory', detail: 'Search and review registered organisations and operating entities.', icon: Building2, badge: 'BUILD' },
      { title: 'Tenant Status', detail: 'Active, pending, suspended and archived tenancy states.', icon: Building2, badge: 'BUILD' },
      { title: 'Territory Relationships', detail: 'Link country, regional and local operators without creating separate platform silos.', icon: Building2, badge: 'BUILD' },
      { title: 'Ownership & Authority', detail: 'Record authorised owners, administrators and delegated authority.', icon: Building2, badge: 'BUILD' },
      { title: 'Suspension / Exit', detail: 'Controlled suspension, offboarding and historical record preservation.', icon: Building2, badge: 'BUILD' },
    ]}
  />;
}
