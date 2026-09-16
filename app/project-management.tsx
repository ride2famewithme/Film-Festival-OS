import { BarChart3, Blocks, Bot, CalendarClock, FileText, FolderKanban, Gauge, KanbanSquare, ListChecks, ShieldAlert, UsersRound } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';

export default function ProjectManagementScreen() {
  return <OSHub
    eyebrow="OPTIONAL MANAGEMENT MODULE"
    title="Film Festival OS™ Project Management Software™"
    subtitle="A franchise- and festival-aware project portfolio workspace designed for one responsive web/PWA codebase and reusable inside Film Festival OS™."
    statusTitle="Architecture status"
    statusText="Pre-test product shell. Designed to reuse the ProjectTimeline AI Control Centre pattern rather than create a separate disconnected project-management product. Backend persistence, tenant isolation, alerts and automation remain to be implemented and tested."
    items={[
      { title: 'Portfolio', detail: 'HQ, territory, franchise, festival and project roll-up with status, owner, health and next milestone.', icon: Blocks, route: '/pm-portfolio', badge: 'SHELL' },
      { title: 'Projects', detail: 'Create and manage projects, phases, objectives, owners, dates, priorities and delivery status.', icon: FolderKanban, route: '/pm-projects', badge: 'SHELL' },
      { title: 'Tasks & Actions', detail: 'Tasks, subtasks, owners, due dates, dependencies, recurring actions and approval gates.', icon: ListChecks, route: '/pm-tasks', badge: 'SHELL' },
      { title: 'Board', detail: 'Kanban-style workflow for planned, active, blocked, review and completed work.', icon: KanbanSquare, route: '/pm-board', badge: 'SHELL' },
      { title: 'Timeline & Milestones', detail: 'Milestones, deadlines, dependencies and delivery checkpoints across festival operations.', icon: CalendarClock, route: '/pm-timeline', badge: 'SHELL' },
      { title: 'KPIs & Management Dashboard', detail: 'Operational KPIs, overdue work, delivery confidence, blockers and portfolio health.', icon: Gauge, route: '/pm-kpis', badge: 'SHELL' },
      { title: 'Risks & Issues', detail: 'Connect projects to the central Risk, Compliance & Resilience Centre™ and remediation actions.', icon: ShieldAlert, route: '/risk' },
      { title: 'Documents & Evidence', detail: 'Project records, approvals, meeting actions, evidence links, versions and controlled outputs.', icon: FileText, route: '/pm-documents', badge: 'SHELL' },
      { title: 'Team & Workload', detail: 'People, roles, assignments, capacity, hand-offs and responsibility boundaries.', icon: UsersRound, route: '/pm-team', badge: 'SHELL' },
      { title: 'Reports', detail: 'Portfolio, project, KPI, risk and action reports with controlled exports.', icon: BarChart3, route: '/reports' },
      { title: 'AI Next Actions', detail: 'Human-reviewable AI suggestions for priorities, overdue work, blockers, risks and next actions.', icon: Bot, route: '/pm-ai-actions', badge: 'SHELL' },
    ]}
  />;
}
