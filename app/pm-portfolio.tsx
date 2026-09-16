import { Building2, FolderKanban, Globe2, MapPinned, Network, PieChart } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function PMPortfolioScreen() {
  return <OSHub eyebrow="PROJECT MANAGEMENT" title="Portfolio" subtitle="Roll up work from project to festival, franchise, territory and HQ without mixing tenant data." statusTitle="Portfolio hierarchy" statusText="Global HQ → continent/region → country/territory → franchise/operator → festival → project. Visibility must follow role and tenant permissions when backend enforcement is implemented." items={[
    { title:'Global Portfolio', detail:'HQ-wide roll-up of authorised projects, status, risks, KPIs and milestones.', icon:Globe2, badge:'BACKEND' },
    { title:'Territory Portfolio', detail:'Country or regional portfolio for the authorised operator.', icon:MapPinned, badge:'BACKEND' },
    { title:'Franchise Portfolio', detail:'Projects across one franchise holder’s permitted festivals and business activities.', icon:Network, badge:'BACKEND' },
    { title:'Festival Portfolio', detail:'Operational and strategic projects for one festival.', icon:Building2, badge:'BACKEND' },
    { title:'Project Register', detail:'Portfolio-filtered project list with health, owner, next milestone and status.', icon:FolderKanban, route:'/pm-projects' },
    { title:'Portfolio Health', detail:'KPI, overdue action, risk and milestone summary.', icon:PieChart, route:'/pm-kpis' },
  ]}/>;
}
