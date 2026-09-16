import { CircleCheckBig, CircleDashed, CircleDot, CirclePause, Eye } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function PMBoardScreen() {
  return <OSHub eyebrow="PROJECT MANAGEMENT" title="Board" subtitle="KISS Kanban workflow for project and operational actions." items={[
    { title:'Planned', detail:'Approved work not yet started.', icon:CircleDashed, badge:'DATA' },
    { title:'Active', detail:'Work currently in progress.', icon:CircleDot, badge:'DATA' },
    { title:'Blocked / Waiting', detail:'Dependency, approval, supplier or information prevents progress.', icon:CirclePause, badge:'DATA' },
    { title:'Review', detail:'Awaiting QA, management approval or stakeholder confirmation.', icon:Eye, badge:'DATA' },
    { title:'Completed', detail:'Finished work with evidence/history retained.', icon:CircleCheckBig, badge:'DATA' },
  ]}/>;
}
