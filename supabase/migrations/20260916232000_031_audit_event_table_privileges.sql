-- Film Festival OS™
-- Migration 031 — Audit Event Register privileges
--
-- RLS remains the security boundary.
-- Authenticated actors may INSERT according to audit_insert policy.
-- Only authorised roles may SELECT according to audit_select policy.
-- No UPDATE or DELETE privilege is granted: audit history is immutable.

grant select, insert
on table public.audit_events
to authenticated;
