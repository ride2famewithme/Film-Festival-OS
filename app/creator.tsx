import { Award, BadgeDollarSign, FileBadge2, FolderKanban, Heart, Mail, Search, WalletCards } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function CreatorScreen() {
  return <OSHub
    eyebrow="FILMMAKER / CREATOR"
    title="Creator Workspace"
    subtitle="One reusable creator profile for projects, submissions, press kits, payments, messages and festival opportunities."
    statusTitle="Creator-first principle"
    statusText="Keep project data reusable so filmmakers do not repeatedly rebuild the same press kit and credits for every festival."
    items={[
      { title: 'My Projects', detail: 'Films, scripts, music, animation and photo projects with reusable metadata.', icon: FolderKanban, route: '/(tabs)/films' },
      { title: 'Project Management™', detail: 'Optional planning workspace for projects, tasks, milestones, KPIs, risks and AI next actions.', icon: FolderKanban, route: '/project-management', badge: 'OPTIONAL' },
      { title: 'Discover Festivals', detail: 'Browse eligible festivals, regions, categories, deadlines and Global Pool opportunities.', icon: Search, route: '/network' },
      { title: 'My Submissions', detail: 'Track submitted, in-review, selected, awarded and archived entries.', icon: FileBadge2, route: '/submissions' },
      { title: 'Press Kit', detail: 'Synopsis, credits, stills, poster, trailer, subtitles, rights declarations and links.', icon: Heart, route: '/press-kit' },
      { title: 'Payments & Receipts', detail: 'Fees, discounts, waivers, receipts, refunds and transaction history.', icon: WalletCards, route: '/creator-payments', badge: 'SHELL' },
      { title: 'Messages', detail: 'Festival communications, status notices and approved support conversations.', icon: Mail, route: '/communications' },
      { title: 'Awards & Laurels', detail: 'Selections, nominations, awards and downloadable approved laurels.', icon: Award, route: '/(tabs)/awards' },
      { title: 'Credits & Benefits', detail: 'Membership benefits, Festival Credits™ and eligible discounts.', icon: BadgeDollarSign, route: '/membership' },
    ]}
  />;
}
