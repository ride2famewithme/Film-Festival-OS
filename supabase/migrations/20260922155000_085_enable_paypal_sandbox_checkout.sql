-- Film Festival OS™
-- Enable PayPal checkout in SANDBOX only.
-- No live PayPal processing is enabled.

update public.platform_payment_policy
set
  checkout_provider = 'paypal',
  checkout_environment = 'sandbox',
  paypal_checkout_enabled = true
where scope = 'global';
