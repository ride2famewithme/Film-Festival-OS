# Film Festival OS™
# Easy As™ / SOP™ — PayPal Sandbox Account Continuity
Version 1.0 | 24 September 2026

## Purpose
Prevent lost test accounts, unnecessary password resets,
duplicate REST applications and incorrect webhook investigations.

## 1. Before testing
- Confirm the real PayPal Developer login.
- Identify the Sandbox Business account receiving payments.
- Identify the Sandbox Personal account making payments.
- Confirm the selected REST application and Sandbox environment.
- Confirm which application owns the intended webhook subscription.

## 2. Secure credential register
- Save account passwords and API secrets in a password manager.
- Record only the password-manager entry names in project notes.
- Keep Developer, Sandbox Business and Sandbox Personal accounts separate.
- Never place passwords, API secrets or recovery codes in Git,
  ordinary Notes, Word documents, screenshots or AI conversations.

## 3. When PayPal logs out
- Stop the current test.
- Sign back into the intended Developer account.
- Reconfirm the Sandbox merchant and REST application.
- Do not create another application or reset credentials
  merely because the session expired.

## 4. End-of-session handover
Record the verified workspace, Git branch and commit,
Developer account reference, Sandbox account reference,
REST application name, last test result and next unfinished action.
Use secure vault entry names, never secret values.

## 5. Exposed credentials
Flag accidentally exposed credentials for review and rotation.
Coordinate any rotation with the integration owner.
Do not change working credentials without approval.

## Safety rule
Account identity must be verified before payment or refund testing.
Never use a simulated webhook as proof of a signed provider event.
