-- Film Festival OS™
-- 086 Repair Global PayPal Sandbox Policy Row
-- Ensures the singleton global payment policy exists and refreshes PostgREST schema cache.

insert into public.platform_payment_policy (
  scope,
  checkout_provider,
  checkout_environment,
  paypal_checkout_enabled
)
values (
  'global',
  'paypal',
  'sandbox',
  true
)
on conflict (scope) do update
set
  checkout_provider = excluded.checkout_provider,
  checkout_environment = excluded.checkout_environment,
  paypal_checkout_enabled = excluded.paypal_checkout_enabled,
  updated_at = now();

notify pgrst, 'reload schema';
