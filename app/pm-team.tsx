import { BadgeCheck, CircleGauge, Handshake, UserCog, UsersRound } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function PMTeamScreen() {
  return <OSHub eyebrow="PROJECT MANAGEMENT" title="Team & Workload" subtitle="Responsibility and workload views governed by festival/franchise permissions." items={[
    { title:'Project Team', detail:'People assigned to projects and operational work.', icon:UsersRound, badge:'BACKEND' },
    { title:'Roles & Responsibility', detail:'Owner, approver, contributor, reviewer and observer boundaries.', icon:UserCog, route:'/access-governance' },
    { title:'Workload', detail:'Assigned/open actions and indicative capacity by authorised team member.', icon:CircleGauge, badge:'BACKEND' },
    { title:'Hand-offs', detail:'Track inter-team or supplier hand-offs and waiting states.', icon:Handshake, badge:'BACKEND' },
    { title:'Acknowledgements', detail:'Training, policy or project responsibility acknowledgement where required.', icon:BadgeCheck, badge:'BACKEND' },
  ]}/>;
}
