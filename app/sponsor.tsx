import { BarChart3, BriefcaseBusiness, Globe2, Image, Megaphone, ShieldCheck } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function SponsorScreen() {
  return <OSHub
    eyebrow="SPONSOR / PARTNER"
    title="Partner Workspace"
    subtitle="A controlled commercial workspace for approved sponsors, affiliates and industry partners without access to private jury decisions."
    items={[
      { title: 'Organisation Profile', detail: 'Partner identity, contacts, territories, approvals and campaign permissions.', icon: BriefcaseBusiness, route: '/partner-profile' },
      { title: 'Campaigns', detail: 'Approved sponsorship and promotional campaigns with dates and audience scope.', icon: Megaphone, route: '/marketing' },
      { title: 'Regions & Festivals', detail: 'View eligible regional, national and network opportunities.', icon: Globe2, route: '/network' },
      { title: 'Creative Assets', detail: 'Logos, artwork, copy, placement approvals and brand-safety evidence.', icon: Image, route: '/partner-assets' },
      { title: 'Analytics', detail: 'Approved campaign delivery, engagement and reporting once production data exists.', icon: BarChart3, route: '/reports' },
      { title: 'Governance Boundary', detail: 'Sponsors do not receive private jury scores or undisclosed selection influence.', icon: ShieldCheck, route: '/partner-governance' },
    ]}
  />;
}
