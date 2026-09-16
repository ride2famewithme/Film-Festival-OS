-- Film Festival OS™
-- Migration 009 — Authenticated Workflow Grants
-- 07 Sep 2026
-- RLS remains responsible for tenant isolation.

grant select, insert, update on table
  public.festival_profiles,
  public.festival_seasons,
  public.festival_categories,
  public.submissions,
  public.notifications,
  public.submission_payments
to authenticated;

grant select on table
  public.benefit_codes
to authenticated;
