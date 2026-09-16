import { Database } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function Screen() {
  return <OSHub
    eyebrow='GLOBAL HQ'
    title='Data & Integrations'
    subtitle='Platform data, storage and provider integration governance.'
    statusTitle="v4.0 pre-test shell"
    statusText="Workflow structure is represented here. Persistence, enforcement, automation and assurance require backend implementation and testing."
    items={[
      { title: 'Backend & Real Data Foundation', detail: 'Tenant model, roles, typed core data, service boundaries and audit-ready events.', icon: Database, route: '/backend-foundation', badge: 'BLOCK 1' },
      { title: 'Database & Storage', detail: 'Production data stores, object storage and health status.', icon: Database, badge: 'NEXT' },
      { title: 'Integration Registry', detail: 'Approved APIs, webhooks and external providers.', icon: Database, badge: 'BUILD' },
      { title: 'Data Flows', detail: 'What information moves between systems and territories.', icon: Database, badge: 'BUILD' },
      { title: 'Provider Credentials', detail: 'Controlled secret/configuration ownership; never expose secrets in UI.', icon: Database, badge: 'BUILD' },
      { title: 'Change Control', detail: 'Record integration changes and rollback requirements.', icon: Database, badge: 'BUILD' },
    ]}
  />;
}
