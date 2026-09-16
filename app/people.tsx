import { useCallback } from 'react';

import { WorkflowRegister } from '@/components/workflows/WorkflowRegister';
import { getActiveContext } from '@/data/session';
import { can } from '@/data/access';
import { requireSupabaseClient } from '@/data/supabase-client';

export default function People() {

  const load = useCallback(async () => {
    const ctx = await getActiveContext();

    if (!ctx) throw new Error('Authentication required');
    if (!can(ctx.role, 'people.manage')) throw new Error('Permission denied');

    const client = requireSupabaseClient();

    const { data, error } = await client.rpc('people_register', {
      p_tenant_id: ctx.tenantId,
    });

    if (error) throw new Error(error.message);

    return data ?? [];
  }, []);

  const create = useCallback(async (value: string) => {
    const ctx = await getActiveContext();

    if (!ctx) throw new Error('Authentication required');
    if (!can(ctx.role, 'people.manage')) throw new Error('Permission denied');

    const client = requireSupabaseClient();

    const { data, error } = await client.functions.invoke('invite-staff', {
      body: {
        email: value.trim().toLowerCase(),
        tenant_id: ctx.tenantId,
      },
    });

    if (error) {
      let message = error.message;

      try {
        const body = await (error as any).context?.json();
        if (body?.error) message = String(body.error);
      } catch {}

      throw new Error(message);
    }

    if (data?.error) throw new Error(String(data.error));

    return data;
  }, []);

  const advance = useCallback(
    async (row: any) => {
      const ctx = await getActiveContext();

      if (!ctx) throw new Error('Authentication required');
      if (!can(ctx.role, 'people.manage')) {
        throw new Error('Permission denied');
      }

      const status =
        row.status === 'suspended'
          ? 'active'
          : row.status === 'invited'
            ? 'active'
            : 'suspended';

      const client = requireSupabaseClient();

      const { data,error } = await client.rpc(
        'set_membership_emergency_status',
        {
          p_membership_id:String(row.id),
          p_status:status,
        }
      );

      if (error) throw new Error(error.message);

      return data;
    },
    []
  );

  return (
    <WorkflowRegister
      eyebrow="PEOPLE & ACCESS"
      title="Staff & Role Administration"
      subtitle="Tenant-scoped people and membership access. Least privilege remains the rule; server RLS is the production boundary."
      emptyText="No staff memberships in this workspace."
      inputLabel="Invite Staff Member"
      inputPlaceholder="staff@example.com"
      load={load}
      create={create}
      createSuccessMessage="Invitation sent and staff membership created."
      primary={(r) => String(r.email ?? 'Unknown user')}
      secondary={(r) =>
        `Role: ${r.role ?? 'festival_staff'} · ${r.tenant_name ?? 'Tenant'}`
      }
      status={(r) => String(r.status ?? 'invited')}
      onAdvance={advance}
      advanceLabel="Advance access state"
    />
  );
}
