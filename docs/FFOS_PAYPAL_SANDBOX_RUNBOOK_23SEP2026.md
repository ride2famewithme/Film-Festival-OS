# Film Festival OS™ — PayPal Sandbox Runbook

**Reference:** PayPal Sandbox — BLOCK 214B  
**Date:** 23 Sep 2026  
**Purpose:** Single source of truth for the current FFOS PayPal Sandbox E2E test. No secrets are stored here.

## Fixed identities

### REAL / DEVELOPER ACCOUNT
- Role: PayPal Developer / real account
- Email: `admin@filmfestivalos.com`
- Do **not** use this account as the Sandbox buyer.

### SANDBOX SELLER
- Role: SELLER / Business sandbox account
- Email: `sb-8dozc52997370@business.example.com`

### SANDBOX BUYER
- Role: BUYER / Personal sandbox account
- Email: `sb-wzfuz52997372@personal.example.com`
- Buyer name shown by PayPal: `John DoeskipKYC`
- Type: Personal
- Status: Verified
- Sandbox balance observed: AUD 5,000
- Password: stored only in PayPal Developer Sandbox Accounts. **Never commit or paste it into ChatGPT.**

## Supabase / FFOS

- Supabase project ref: `htvmmciewewcdavgsdxe`
- PayPal webhook URL: `https://htvmmciewewcdavgsdxe.supabase.co/functions/v1/paypal-webhook`
- Checkout function: `create-checkout-session`
- Capture function: `capture-paypal-order`
- Webhook function: `paypal-webhook`
- Checkout environment: `sandbox`
- Test payment: USD 15.00 pending payment under Colortape International Film Festival, season 2026.

## Current checkpoint

PASS:
- FFOS payment record visible.
- PayPal sandbox policy repaired.
- service_role runtime grants repaired.
- Sandbox Client ID and Client Secret replaced in Supabase.
- PayPal OAuth reached successfully after secret correction.
- PayPal Sandbox checkout page opened for USD 15.00.

NEXT:
1. Open FFOS `/creator-payments`.
2. Click the top `PAY WITH PAYPAL — SANDBOX` button once.
3. Confirm destination host starts with `sandbox.paypal.com`.
4. Click `Log in`.
5. Use the SANDBOX BUYER email above plus its Sandbox password.
6. Stop at PayPal final review / Pay Now screen before final approval.
7. Complete payment only after confirming the final review screen.
8. Return to FFOS and verify checkout/payment state, capture/webhook, and final PAID state.

## Do not confuse these

- `admin@filmfestivalos.com` = REAL / developer account.
- `sb-8dozc52997370@business.example.com` = SANDBOX SELLER.
- `sb-wzfuz52997372@personal.example.com` = SANDBOX BUYER.
- Never use real card details in Sandbox.
- Never paste PayPal Client Secret, Sandbox password, webhook secret/ID, or private credentials into chat or Git.
