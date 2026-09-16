-- Film Festival OS™
-- Migration 007 — Festival Dashboard SELECT grants
-- 06 Sep 2026
--
-- Purpose:
-- Restore PostgreSQL SELECT permission required by authenticated
-- festival users for the live Festival Dashboard.
--
-- Row Level Security remains responsible for tenant isolation.

grant select on table
  public.festival_profiles,
  public.festival_seasons
to authenticated;
