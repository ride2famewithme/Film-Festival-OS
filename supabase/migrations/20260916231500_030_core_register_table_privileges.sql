-- Film Festival OS™
-- Migration 030 — Core operational register table privileges
--
-- RLS remains the security boundary.
-- This grants authenticated users table access so the existing
-- tenant/role RLS policies can actually evaluate the request.

grant select, insert, update, delete
on table
  public.risks,
  public.incidents,
  public.suppliers
to authenticated;
