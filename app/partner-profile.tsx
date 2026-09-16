import { BriefcaseBusiness } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function Screen() {
  return <OSHub
    eyebrow='SPONSOR / PARTNER'
    title='Organisation Profile'
    subtitle='Controlled partner identity and campaign authority record.'
    statusTitle="v4.0 pre-test shell"
    statusText="Workflow structure is represented here. Persistence, enforcement, automation and assurance require backend implementation and testing."
    items={[
      { title: 'Identity & Contacts', detail: 'Legal/trading name, authorised contacts and operating territories.', icon: BriefcaseBusiness, badge: 'BUILD' },
      { title: 'Approval Status', detail: 'Verification and partnership approval state.', icon: BriefcaseBusiness, badge: 'BUILD' },
      { title: 'Campaign Authority', detail: 'Who may create, approve or change campaign materials.', icon: BriefcaseBusiness, badge: 'BUILD' },
      { title: 'Commercial Contacts', detail: 'Billing and operational contacts when enabled.', icon: BriefcaseBusiness, badge: 'BUILD' },
      { title: 'Renewal & Review', detail: 'Agreement/review dates and required evidence.', icon: BriefcaseBusiness, badge: 'BUILD' },
    ]}
  />;
}
