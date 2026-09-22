import { db } from '@/data/db';
import { getActiveContext } from '@/data/session';
import { can, type Permission } from '@/data/access';
import { writeAuditEvent } from '@/data/services';
import { requireSupabaseClient } from '@/data/supabase-client';

export type FranchiseLevel =
  | 'global_master'
  | 'continent_master'
  | 'country_master'
  | 'region_master'
  | 'capital_city'
  | 'regional_capital'
  | 'city_operator'
  | 'festival_operator'
  | 'global_pool';

export type FranchiseStatus =
  | 'prospect'
  | 'onboarding'
  | 'active'
  | 'suspended'
  | 'expired'
  | 'terminated';

async function ctx(permission: Permission) {
  const c = await getActiveContext();

  if (!c) throw new Error('Authentication required');
  if (!can(c.role, permission)) throw new Error('Permission denied');

  return c;
}

export async function listFranchiseNetwork() {
  const c = await ctx('tenant.read');

  const profileQuery =
    c.role === 'platform_admin'
      ? db.from<any>('franchise_profiles').select('*')
      : db
          .from<any>('franchise_profiles')
          .select('*')
          .eq('tenant_id', c.tenantId);

  const [profilesResult, tenantsResult] =
    await Promise.all([
      profileQuery,
      db.from<any>('tenants').select('*').order('name'),
    ]);

  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }

  if (tenantsResult.error) {
    throw new Error(tenantsResult.error.message);
  }

  const profiles = profilesResult.data ?? [];
  const tenants = tenantsResult.data ?? [];

  const tenantMap = new Map(
    tenants.map((row: any) => [
      String(row.id),
      row,
    ])
  );

  return profiles.map((profile: any) => {
    const tenant = tenantMap.get(
      String(profile.tenant_id)
    );

    const parent = tenant?.parent_tenant_id
      ? tenantMap.get(
          String(tenant.parent_tenant_id)
        )
      : null;

    return {
      ...profile,
      tenant_name:
        tenant?.name ??
        String(profile.tenant_id),
      tenant_type:
        tenant?.type ?? null,
      parent_tenant_name:
        parent?.name ?? null,
    };
  });
}

export async function createFranchiseProfile(values: {
  tenant_id: string;
  franchise_level: FranchiseLevel;
  territory_name: string;
  continent_name?: string;
  country_name?: string;
  country_code?: string;
  region_name?: string;
  region_code?: string;
  city_name?: string;
  exclusive_territory?: boolean;
  population_reference?: number | null;
  notes?: string;
}) {
  await ctx('platform.configure');

  const result = await db
    .from<any>('franchise_profiles')
    .insert({
      tenant_id: values.tenant_id,
      franchise_level: values.franchise_level,
      territory_name:
        values.territory_name.trim(),
      continent_name:
        values.continent_name?.trim() || null,
      country_name:
        values.country_name?.trim() || null,
      country_code:
        values.country_code
          ?.trim()
          .toUpperCase() || null,
      region_name:
        values.region_name?.trim() || null,
      city_name:
        values.city_name?.trim() || null,
      exclusive_territory:
        Boolean(values.exclusive_territory),
      population_reference:
        values.population_reference ?? null,
      notes:
        values.notes?.trim() || null,
      status: 'onboarding',
      updated_at:
        new Date().toISOString(),
    });

  if (result.error) {
    throw new Error(result.error.message);
  }

  const row = (result.data ?? [])[0];

  await writeAuditEvent(
    'franchise.profile_created',
    'franchise_profile',
    row?.id,
    {
      tenantId: values.tenant_id,
      level: values.franchise_level,
      territory:
        values.territory_name,
    }
  );

  return row;
}

export async function updateFranchiseStatus(
  id: string,
  status: FranchiseStatus
) {
  await ctx('platform.configure');

  const result = await db
    .from<any>('franchise_profiles')
    .update({
      status,
      updated_at:
        new Date().toISOString(),
    })
    .eq('id', id);

  if (result.error) {
    throw new Error(result.error.message);
  }

  await writeAuditEvent(
    'franchise.status_changed',
    'franchise_profile',
    id,
    { status }
  );

  return (result.data ?? [])[0];
}

export async function listFranchiseOnboarding(
  tenantId: string
) {
  const c = await ctx('tenant.read');

  if (
    c.role !== 'platform_admin' &&
    tenantId !== c.tenantId
  ) {
    throw new Error(
      'Cross-tenant access denied'
    );
  }

  const result = await db
    .from<any>('franchise_onboarding_steps')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at');

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? [];
}

export async function seedFranchiseOnboarding(
  tenantId: string
) {
  await ctx('platform.configure');

  const existing =
    await db
      .from<any>('franchise_onboarding_steps')
      .select('*')
      .eq('tenant_id', tenantId);

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const existingKeys = new Set(
    (existing.data ?? []).map(
      (row: any) =>
        String(row.step_key)
    )
  );

  const defaults = [
    [
      'territory_profile',
      'Confirm territory profile',
    ],
    [
      'agreement_record',
      'Record executed agreement reference',
    ],
    [
      'operator_access',
      'Create operator access',
    ],
    [
      'brand_pack',
      'Issue approved brand pack',
    ],
    [
      'training_complete',
      'Complete operator training',
    ],
    [
      'festival_setup',
      'Configure first festival workspace',
    ],
    [
      'compliance_pack',
      'Issue compliance and governance pack',
    ],
    [
      'launch_readiness',
      'Complete launch-readiness review',
    ],
  ];

  let created = 0;

  for (const [stepKey, label] of defaults) {
    if (existingKeys.has(stepKey)) {
      continue;
    }

    const result = await db
      .from<any>(
        'franchise_onboarding_steps'
      )
      .insert({
        tenant_id: tenantId,
        step_key: stepKey,
        label,
        status: 'pending',
        updated_at:
          new Date().toISOString(),
      });

    if (result.error) {
      throw new Error(
        result.error.message
      );
    }

    created += 1;
  }

  await writeAuditEvent(
    'franchise.onboarding_seeded',
    'tenant',
    tenantId,
    { created }
  );

  return created;
}

export async function bootstrapGlobalHqProfile() {
  const c = await ctx('platform.configure');

  const tenantResult = await db
    .from<any>('tenants')
    .select('*')
    .eq('id', c.tenantId);

  if (tenantResult.error) {
    throw new Error(tenantResult.error.message);
  }

  const tenant = (tenantResult.data ?? [])[0];

  if (!tenant) {
    throw new Error('Active tenant could not be found.');
  }

  if (tenant.type !== 'hq') {
    throw new Error(
      'Switch to the Global HQ workspace before initialising the Global Master profile.'
    );
  }

  const existing = await db
    .from<any>('franchise_profiles')
    .select('*')
    .eq('tenant_id', c.tenantId);

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if ((existing.data ?? []).length > 0) {
    return (existing.data ?? [])[0];
  }

  const result = await db
    .from<any>('franchise_profiles')
    .insert({
      tenant_id: c.tenantId,
      franchise_level: 'global_master',
      territory_name: 'Global',
      status: 'active',
      exclusive_territory: false,
      notes:
        'Film Festival OS™ Global HQ — root franchise / operator network profile.',
      updated_at: new Date().toISOString(),
    });

  if (result.error) {
    throw new Error(result.error.message);
  }

  const row = (result.data ?? [])[0];

  await writeAuditEvent(
    'franchise.global_hq_initialised',
    'franchise_profile',
    row?.id,
    {
      tenantId: c.tenantId,
      level: 'global_master',
    }
  );

  return row;
}

export type CreateFranchiseOperatorValues = {
  name: string;
  franchise_level: FranchiseLevel;
  territory_name: string;
  parent_tenant_id: string;
  continent_name?: string;
  country_name?: string;
  country_code?: string;
  region_name?: string;
  region_code?: string;
  city_name?: string;
  exclusive_territory?: boolean;
  population_reference?: number | null;
  notes?: string;
};

export async function createFranchiseOperatorAtomic(
  values: CreateFranchiseOperatorValues
) {
  await ctx('platform.configure');

  const name = values.name.trim();
  const territory = values.territory_name.trim();

  if (!name) {
    throw new Error('Operator / tenant name is required');
  }

  if (!territory) {
    throw new Error('Territory name is required');
  }

  if (!values.parent_tenant_id) {
    throw new Error('Parent franchise / territory is required');
  }

  const client = requireSupabaseClient();

  const result = await client.rpc(
    'create_franchise_operator',
    {
      p_name: name,
      p_franchise_level:
        values.franchise_level,
      p_territory_name:
        territory,
      p_parent_tenant_id:
        values.parent_tenant_id,
      p_continent_name:
        values.continent_name?.trim() || null,
      p_country_name:
        values.country_name?.trim() || null,
      p_country_code:
        values.country_code
          ?.trim()
          .toUpperCase() || null,
      p_region_name:
        values.region_name?.trim() || null,
      p_region_code:
        values.region_code
          ?.trim()
          .toUpperCase() || null,
      p_city_name:
        values.city_name?.trim() || null,
      p_exclusive_territory:
        Boolean(values.exclusive_territory),
      p_population_reference:
        values.population_reference ?? null,
      p_notes:
        values.notes?.trim() || null,
    }
  );

  if (result.error) {
    throw new Error(result.error.message);
  }

  const row = Array.isArray(result.data)
    ? result.data[0]
    : result.data;

  if (
    !row?.new_tenant_id ||
    !row?.new_profile_id
  ) {
    throw new Error(
      'Franchise creation completed without returning tenant/profile identifiers'
    );
  }

  return {
    tenant_id:
      String(row.new_tenant_id),
    profile_id:
      String(row.new_profile_id),
  };
}

