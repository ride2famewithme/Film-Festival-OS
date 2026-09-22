-- Film Festival OS™
-- 087 Server-side PayPal runtime grants
-- Grants only the table privileges required by Supabase Edge Functions using service_role.

begin;

grant select
on public.platform_payment_policy
to service_role;

grant select, insert, update
on public.payment_checkout_sessions
to service_role;

grant select, insert, update
on public.payment_provider_events
to service_role;

grant select, update
on public.submission_payments
to service_role;

notify pgrst, 'reload schema';

commit;
