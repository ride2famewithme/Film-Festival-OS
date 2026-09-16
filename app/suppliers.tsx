import { Building2, Database, LockKeyhole, Workflow } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function SuppliersScreen() {
  return <OSHub
    eyebrow="SAFETY NET CENTRE™"
    title="Critical Suppliers & Dependencies"
    subtitle="Know which external services the platform depends on, what they support and what happens if they fail."
    statusTitle="Third-party brick-wall defence"
    statusText="Each critical dependency can be linked to an owner, supported operation, contract, data exposure, fallback and recovery plan."
    items={[
      { title: 'Supplier Register', detail: 'Hosting, payments, email, AI, media/storage, analytics, ticketing and communications providers.', icon: Building2 },
      { title: 'Dependency Map', detail: 'Critical operation → provider → data/service dependency → impact if unavailable.', icon: Workflow },
      { title: 'Security & Data Review', detail: 'Access, data handling, permissions, secrets, retention and supplier-risk evidence.', icon: LockKeyhole },
      { title: 'Fallback & Exit Plan', detail: 'Alternate provider, export requirements, migration owner and service recovery path.', icon: Database },
    ]}
  />;
}
