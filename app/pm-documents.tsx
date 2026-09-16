import { FileCheck2, FileClock, FilePlus2, FolderArchive, Link2, NotebookTabs } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function PMDocumentsScreen() {
  return <OSHub eyebrow="PROJECT MANAGEMENT" title="Documents & Evidence" subtitle="Project records and evidence without losing version history." items={[
    { title:'Project Document Register', detail:'Controlled list of plans, briefs, approvals, reports and evidence.', icon:NotebookTabs, badge:'BACKEND' },
    { title:'Add Record', detail:'Upload or link a document with owner, version, status and classification.', icon:FilePlus2, badge:'BACKEND' },
    { title:'Approvals', detail:'Record approval status, approver and effective date.', icon:FileCheck2, badge:'BACKEND' },
    { title:'Version History', detail:'Preserve superseded versions and material change history.', icon:FileClock, badge:'BACKEND' },
    { title:'Evidence Links', detail:'Connect records to risks, controls, tasks, incidents and milestones.', icon:Link2, badge:'BACKEND' },
    { title:'Archive', detail:'Controlled close-out and retention classification.', icon:FolderArchive, badge:'BACKEND' },
  ]}/>;
}
