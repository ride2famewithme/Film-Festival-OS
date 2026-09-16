-- Film Festival OS™
-- Migration 034 — Correct QA backup evidence status
--
-- The 16 Sep 2026 backup was verified, but a full restore test
-- was NOT performed. Correct RESTORE_TESTED back to VERIFIED
-- and preserve an explicit audit record explaining why.

with corrected as (
  update public.backup_evidence
  set status = 'verified'
  where label = 'FFOS Full Recovery Backup — 16 Sep 2026'
    and status = 'restore_tested'
  returning id, tenant_id, created_by
)
insert into public.audit_events (
  tenant_id,
  actor_user_id,
  action,
  entity_type,
  entity_id,
  detail,
  created_at
)
select
  tenant_id,
  created_by,
  'backup_evidence.status_corrected',
  'backup_evidence',
  id,
  jsonb_build_object(
    'from', 'restore_tested',
    'to', 'verified',
    'reason', 'QA advancement corrected because a full restore test was not actually performed'
  ),
  now()
from corrected
where created_by is not null;
