import { Image } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function Screen() {
  return <OSHub
    eyebrow='SPONSOR / PARTNER'
    title='Creative Assets'
    subtitle='Approved brand materials and placement evidence for sponsor/partner campaigns.'
    statusTitle="v4.0 pre-test shell"
    statusText="Workflow structure is represented here. Persistence, enforcement, automation and assurance require backend implementation and testing."
    items={[
      { title: 'Logo Library', detail: 'Approved logo variants and usage status.', icon: Image, badge: 'BUILD' },
      { title: 'Campaign Artwork', detail: 'Creative supplied for approved campaigns.', icon: Image, badge: 'BUILD' },
      { title: 'Copy & Messaging', detail: 'Approved promotional text and disclosures.', icon: Image, badge: 'BUILD' },
      { title: 'Placement Approval', detail: 'Where assets may appear and who approved them.', icon: Image, badge: 'BUILD' },
      { title: 'Archive', detail: 'Retain superseded campaign evidence for audit/history.', icon: Image, badge: 'BUILD' },
    ]}
  />;
}
