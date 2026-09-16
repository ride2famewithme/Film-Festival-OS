import { CalendarDays, FileText, Gift, Megaphone, Settings2, ShieldCheck, Trophy, UsersRound, Workflow } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
import { festivalInfo } from '@/constants/data';

export default function FestivalScreen() {
  return <OSHub
    eyebrow="FESTIVAL WORKSPACE"
    title={festivalInfo.name}
    subtitle={`${festivalInfo.edition} · ${festivalInfo.city} · View, Edit, Manage and Marketing from one controlled workspace.`}
    statusTitle="Festival operations shell"
    statusText="Major festival-management rooms are now represented. Production persistence, payments and external-provider actions remain backend gates."
    items={[
      { title: 'View Public Festival', detail: 'Preview the public identity, programme summary, deadlines, venue and contact information.', icon: FileText, route: '/festival-profile' },
      { title: 'Edit Festival Profile', detail: 'Identity, description, organisers, contacts, venue, links and published information.', icon: Settings2, route: '/festival-profile' },
      { title: 'Season, Dates & Deadlines', detail: 'Opening, early, regular, late, extended, notification and event dates.', icon: CalendarDays, route: '/season' },
      { title: 'Categories, Rules & Fees', detail: 'Competition categories, eligibility, fee bands, qualifiers and member pricing.', icon: Trophy, route: '/categories' },
      { title: 'People & Staff', detail: 'Owners, staff roles, permissions, assigned responsibilities and contacts.', icon: UsersRound, route: '/people' },
      { title: 'Jury Management', detail: 'Private panel, assignments, conflicts, weighting, scoring progress and AI-juror boundary.', icon: ShieldCheck, route: '/jury' },
      { title: 'Submissions & Intake', detail: 'Entries, filters, flags, statuses, bulk workflow and submission records.', icon: Workflow, route: '/submissions' },
      { title: 'Waivers, Discounts & Benefits', detail: 'Waiver codes, campaign discounts, eligibility, usage limits and membership benefits.', icon: Gift, route: '/waivers' },
      { title: 'Notifications & Communications', detail: 'Submitter, jury and staff messages, templates and delivery workflow.', icon: Megaphone, route: '/communications' },
      { title: 'Awards & Laurels', detail: 'Selections, nominations, winners, approved laurels and publishing controls.', icon: Trophy, route: '/laurels' },
      { title: 'Reports & Exports', detail: 'Operational reports, jury progress, CSV/XLSX outputs and controlled export history.', icon: FileText, route: '/reports' },
      { title: 'Marketing & Growth', detail: 'Campaigns, sponsor assets, promotion controls and network opportunities.', icon: Megaphone, route: '/marketing' },
      { title: 'Integrations', detail: 'Payment, email, video, ticket, analytics and future connected-channel adapters.', icon: Workflow, route: '/integrations' },
      { title: 'Support & Help', detail: 'Operator help, workflow guidance, service status and escalation pathways.', icon: ShieldCheck, route: '/support' },
    ]}
  />;
}
