export type PlatformRole =
  | 'platform_admin'
  | 'festival_owner'
  | 'festival_staff'
  | 'juror'
  | 'creator'
  | 'sponsor_partner';

export type Permission =
  | 'tenant.read'
  | 'tenant.manage'
  | 'festival.manage'
  | 'submission.manage'
  | 'jury.review'
  | 'jury.manage'
  | 'project.manage'
  | 'risk.manage'
  | 'audit.read'
  | 'people.manage'
  | 'moderation.manage'
  | 'finance.manage'
  | 'support.manage'
  | 'health.manage'
  | 'platform.configure';

const rolePermissions: Record<PlatformRole, Permission[]> = {
  platform_admin: ['tenant.read','tenant.manage','festival.manage','submission.manage','jury.manage','project.manage','risk.manage','audit.read','people.manage','moderation.manage','finance.manage','support.manage','health.manage','platform.configure'],
  festival_owner: ['tenant.read','festival.manage','submission.manage','jury.manage','project.manage','risk.manage','people.manage','finance.manage','support.manage'],
  festival_staff: ['tenant.read','festival.manage','submission.manage','project.manage','support.manage'],
  juror: ['tenant.read','jury.review'],
  creator: ['tenant.read','project.manage'],
  sponsor_partner: ['tenant.read'],
};

export function can(role: PlatformRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function assertTenantScope(recordTenantId: string, activeTenantId: string): void {
  if (recordTenantId !== activeTenantId) throw new Error('Cross-tenant access denied');
}

// Client checks improve UX. Supabase Row Level Security is the production security boundary.
export const ACCESS_MODEL_STATUS = 'CLIENT_GUARDS_PLUS_DATABASE_RLS_DESIGNED' as const;
