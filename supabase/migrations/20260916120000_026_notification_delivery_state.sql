-- Film Festival OS™
-- Migration 026 — Notification Delivery State
-- Adds provider/worker delivery tracking without sending email yet.

alter table public.notifications
  add column if not exists attempt_count integer not null default 0,
  add column if not exists processing_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_error text,
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists failed_at timestamptz,
  add column if not exists delivered_at timestamptz;

create index if not exists notifications_delivery_queue_idx
  on public.notifications (status, queued_at);

comment on column public.notifications.attempt_count
  is 'Number of external delivery attempts made by the notification worker';

comment on column public.notifications.provider
  is 'External delivery provider used, for example resend, smtp or other provider';

comment on column public.notifications.provider_message_id
  is 'Message identifier returned by the external delivery provider';

comment on column public.notifications.last_error
  is 'Most recent delivery error; null after successful delivery';
