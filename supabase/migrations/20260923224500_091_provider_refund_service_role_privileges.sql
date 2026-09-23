-- Film Festival OS™
-- Migration 091
-- Provider Refund Control™ service-role privileges
--
-- Edge Functions use SUPABASE_SERVICE_ROLE_KEY for controlled
-- provider-refund lifecycle reads/writes.
-- RLS bypass does not replace PostgreSQL table privileges.

begin;

grant select, insert, update, delete
on public.provider_refund_requests
to service_role;

comment on table public.provider_refund_requests is
'Server-controlled provider refund lifecycle. Authenticated finance authorities may read authorised rows; provider lifecycle writes are performed only by trusted server/service-role workflows. First controlled release supports full refunds only.';

commit;
