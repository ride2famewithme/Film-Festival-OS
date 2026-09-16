import { defineSchema } from './define';

export default defineSchema({
  tenants: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true },
      name: { type: 'text', required: true },
      type: { type: 'text', required: true },
      territory: { type: 'text' },
      status: { type: 'text', required: true },
      parent_tenant_id: { type: 'uuid', ref: 'tenants.id' },
      created_at: { type: 'timestamp', required: true },
    },
    seed: [
      { id: 'tenant_hq', name: 'Film Festival OS™ Global HQ', type: 'hq', territory: 'Global', status: 'active', created_at: '2026-09-03T00:00:00Z' },
      { id: 'tenant_demo_festival', name: 'Demo Festival Operator', type: 'festival', territory: 'Australia', status: 'active', parent_tenant_id: 'tenant_hq', created_at: '2026-09-03T00:00:00Z' },
    ],
  },
  memberships: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true },
      user_id: { type: 'uuid', required: true },
      tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      role: { type: 'text', required: true },
      status: { type: 'text', required: true },
      created_at: { type: 'timestamp', required: true },
    },
    seed: [
      { id: 'membership_demo', user_id: 'demo_user', tenant_id: 'tenant_hq', role: 'platform_admin', status: 'active', created_at: '2026-09-03T00:00:00Z' },
      { id: 'membership_demo_festival', user_id: 'demo_user', tenant_id: 'tenant_demo_festival', role: 'festival_owner', status: 'active', created_at: '2026-09-03T00:00:00Z' },
    ],
  },
  projects: {
    owned: true,
    fields: {
      id: { type: 'uuid', pk: true },
      tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      owner_id: { type: 'uuid', owner: true, required: true },
      name: { type: 'text', required: true },
      status: { type: 'text', required: true },
      priority: { type: 'text' },
      due_date: { type: 'timestamp' },
    },
    seed: [
      { id: 'project_demo_1', tenant_id: 'tenant_demo_festival', owner_id: 'demo_user', name: '2026 Festival Delivery', status: 'active', priority: 'high', due_date: '2026-12-31T00:00:00Z' },
    ],
  },
  tasks: {
    owned: true,
    fields: {
      id: { type: 'uuid', pk: true },
      tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      project_id: { type: 'uuid', required: true, ref: 'projects.id' },
      owner_id: { type: 'uuid', owner: true, required: true },
      title: { type: 'text', required: true },
      status: { type: 'text', required: true },
      priority: { type: 'text' },
      due_date: { type: 'timestamp' },
    },
    seed: [
      { id: 'task_demo_1', tenant_id: 'tenant_demo_festival', project_id: 'project_demo_1', owner_id: 'demo_user', title: 'Complete backend foundation', status: 'in_progress', priority: 'high', due_date: '2026-09-10T00:00:00Z' },
    ],
  },
  risks: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true },
      tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      category: { type: 'text', required: true },
      description: { type: 'text', required: true },
      rating: { type: 'text', required: true },
      owner_id: { type: 'uuid' },
      status: { type: 'text', required: true },
    },
    seed: [
      { id: 'risk_demo_1', tenant_id: 'tenant_hq', category: 'Operational', description: 'Critical provider outage disrupts core service', rating: 'high', owner_id: 'demo_user', status: 'open' },
    ],
  },
  incidents: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true },
      tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      severity: { type: 'text', required: true },
      summary: { type: 'text', required: true },
      status: { type: 'text', required: true },
      owner_id: { type: 'uuid' },
      occurred_at: { type: 'timestamp', required: true },
    },
    seed: [],
  },
  suppliers: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true },
      tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      name: { type: 'text', required: true },
      service_type: { type: 'text', required: true },
      criticality: { type: 'text', required: true },
      status: { type: 'text', required: true },
    },
    seed: [
      { id: 'supplier_demo_1', tenant_id: 'tenant_hq', name: 'Hosting provider - configure', service_type: 'hosting', criticality: 'critical', status: 'planned' },
    ],
  },

  festival_profiles: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true },
      tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      festival_name: { type: 'text', required: true },
      country: { type: 'text' },
      status: { type: 'text', required: true },
      updated_at: { type: 'timestamp', required: true },
    },
    seed: [],
  },
  festival_seasons: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true },
      tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      label: { type: 'text', required: true },
      status: { type: 'text', required: true },
      opens_at: { type: 'timestamp' },
      notification_at: { type: 'timestamp' },
      event_start_at: { type: 'timestamp' },
      event_end_at: { type: 'timestamp' },
      updated_at: { type: 'timestamp', required: true },
    },
    seed: [],
  },
  submissions: {
    owned: true,
    fields: {
      id: { type: 'uuid', pk: true },
      tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      owner_id: { type: 'uuid', owner: true, required: true },
      title: { type: 'text', required: true },
      filmmaker_name: { type: 'text', required: true },
      email: { type: 'text' },
      country: { type: 'text' },
      category: { type: 'text' },
      status: { type: 'text', required: true },
      submitted_at: { type: 'timestamp', required: true },
    },
    seed: [
      { id: 'submission_demo_1', tenant_id: 'tenant_demo_festival', owner_id: 'demo_user', title: 'The Last Lantern', filmmaker_name: 'Demo Filmmaker', email: 'demo@example.com', country: 'Australia', category: 'Short Film', status: 'received', submitted_at: '2026-09-03T00:00:00Z' },
    ],
  },
  jury_assignments: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true },
      tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      submission_id: { type: 'uuid', required: true, ref: 'submissions.id' },
      juror_user_id: { type: 'uuid', required: true },
      status: { type: 'text', required: true },
      assigned_at: { type: 'timestamp', required: true },
    },
    seed: [],
  },
  jury_reviews: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true },
      tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      assignment_id: { type: 'uuid', required: true, ref: 'jury_assignments.id' },
      submission_id: { type: 'uuid', required: true, ref: 'submissions.id' },
      juror_user_id: { type: 'uuid', required: true },
      score: { type: 'number' },
      recommendation: { type: 'text' },
      notes: { type: 'text' },
      status: { type: 'text', required: true },
      submitted_at: { type: 'timestamp' },
    },
    seed: [],
  },
  notifications: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true },
      tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      submission_id: { type: 'uuid', ref: 'submissions.id' },
      recipient_email: { type: 'text', required: true },
      template_key: { type: 'text', required: true },
      subject: { type: 'text', required: true },
      body: { type: 'text', required: true },
      status: { type: 'text', required: true },
      queued_at: { type: 'timestamp', required: true },
      sent_at: { type: 'timestamp' },
    },
    seed: [],
  },

  festival_categories: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true }, tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      name: { type: 'text', required: true }, status: { type: 'text', required: true }, currency: { type: 'text', required: true },
      regular_fee: { type: 'number', required: true }, runtime_max_minutes: { type: 'number' }, completion_year_min: { type: 'number' },
      rules_version: { type: 'text' }, updated_at: { type: 'timestamp', required: true },
    },
    seed: [
      { id: 'cat_short_demo', tenant_id: 'tenant_demo_festival', name: 'Short Film', status: 'open', currency: 'USD', regular_fee: 35, runtime_max_minutes: 40, completion_year_min: 2024, rules_version: '2026.1', updated_at: '2026-09-03T00:00:00Z' },
    ],
  },
  benefit_codes: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true }, tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' }, code: { type: 'text', required: true },
      kind: { type: 'text', required: true }, value: { type: 'number', required: true }, status: { type: 'text', required: true },
      usage_limit: { type: 'number' }, uses_count: { type: 'number', required: true }, expires_at: { type: 'timestamp' }, category_id: { type: 'uuid', ref: 'festival_categories.id' },
      updated_at: { type: 'timestamp', required: true },
    },
    seed: [
      { id: 'benefit_demo_1', tenant_id: 'tenant_demo_festival', code: 'MEMBER20', kind: 'percent', value: 20, status: 'active', usage_limit: 100, uses_count: 0, updated_at: '2026-09-03T00:00:00Z' },
    ],
  },
  submission_payments: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true }, tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' }, submission_id: { type: 'uuid', required: true, ref: 'submissions.id' },
      category_id: { type: 'uuid', ref: 'festival_categories.id' }, base_amount: { type: 'number', required: true }, discount_amount: { type: 'number', required: true },
      amount_due: { type: 'number', required: true }, currency: { type: 'text', required: true }, benefit_code: { type: 'text' },
      eligibility_status: { type: 'text', required: true }, payment_status: { type: 'text', required: true }, provider_reference: { type: 'text' },
      updated_at: { type: 'timestamp', required: true },
    },
    seed: [],
  },
  awards: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true }, tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' }, submission_id: { type: 'uuid', required: true, ref: 'submissions.id' },
      award_name: { type: 'text', required: true }, result_status: { type: 'text', required: true }, publication_status: { type: 'text', required: true },
      decided_at: { type: 'timestamp' }, published_at: { type: 'timestamp' }, updated_at: { type: 'timestamp', required: true },
    },
    seed: [],
  },
  communication_templates: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true }, tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      name: { type: 'text', required: true }, template_key: { type: 'text', required: true }, subject: { type: 'text', required: true },
      body: { type: 'text', required: true }, status: { type: 'text', required: true }, updated_at: { type: 'timestamp', required: true },
    },
    seed: [
      { id: 'tmpl_received_demo', tenant_id: 'tenant_demo_festival', name: 'Submission Received', template_key: 'submission_received', subject: 'Submission received', body: 'Thank you. Your submission has been received.', status: 'active', updated_at: '2026-09-03T00:00:00Z' },
    ],
  },
  export_jobs: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true }, tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' }, requested_by: { type: 'uuid', required: true },
      report_type: { type: 'text', required: true }, format: { type: 'text', required: true }, status: { type: 'text', required: true },
      requested_at: { type: 'timestamp', required: true }, generated_at: { type: 'timestamp' }, expires_at: { type: 'timestamp' }, file_path: { type: 'text' },
    },
    seed: [],
  },

  moderation_cases: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true }, tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      title: { type: 'text', required: true }, case_type: { type: 'text', required: true }, status: { type: 'text', required: true },
      priority: { type: 'text', required: true }, decision_reason: { type: 'text' }, created_by: { type: 'uuid', required: true },
      created_at: { type: 'timestamp', required: true }, updated_at: { type: 'timestamp', required: true },
    }, seed: [],
  },
  refund_requests: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true }, tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      reference: { type: 'text', required: true }, amount: { type: 'number', required: true }, currency: { type: 'text', required: true },
      reason: { type: 'text', required: true }, status: { type: 'text', required: true }, requested_by: { type: 'uuid', required: true },
      created_at: { type: 'timestamp', required: true }, updated_at: { type: 'timestamp', required: true },
    }, seed: [],
  },
  support_cases: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true }, tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      subject: { type: 'text', required: true }, category: { type: 'text', required: true }, priority: { type: 'text', required: true },
      status: { type: 'text', required: true }, opened_by: { type: 'uuid', required: true }, created_at: { type: 'timestamp', required: true }, updated_at: { type: 'timestamp', required: true },
    }, seed: [],
  },
  platform_settings: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true }, tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      setting_key: { type: 'text', required: true }, setting_value: { type: 'text', required: true }, status: { type: 'text', required: true },
      updated_by: { type: 'uuid', required: true }, updated_at: { type: 'timestamp', required: true },
    }, seed: [
      { id: 'setting_demo_release', tenant_id: 'tenant_hq', setting_key: 'release_channel', setting_value: 'pre-test', status: 'active', updated_by: 'demo_user', updated_at: '2026-09-04T00:00:00Z' },
    ],
  },
  service_health_checks: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true }, tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      service_name: { type: 'text', required: true }, status: { type: 'text', required: true }, detail: { type: 'text' },
      checked_by: { type: 'uuid', required: true }, checked_at: { type: 'timestamp', required: true },
    }, seed: [],
  },
  audit_events: {
    owned: false,
    fields: {
      id: { type: 'uuid', pk: true },
      tenant_id: { type: 'uuid', required: true, ref: 'tenants.id' },
      actor_user_id: { type: 'uuid', required: true },
      action: { type: 'text', required: true },
      entity_type: { type: 'text', required: true },
      entity_id: { type: 'uuid' },
      detail: { type: 'json' },
      created_at: { type: 'timestamp', required: true },
    },
    seed: [
      { id: 'audit_demo_1', tenant_id: 'tenant_hq', actor_user_id: 'demo_user', action: 'backend.foundation.loaded', entity_type: 'system', detail: { mode: 'mock' }, created_at: '2026-09-03T00:00:00Z' },
    ],
  },
});
