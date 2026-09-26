# Film Festival OS™ — Supervisor–Worker Automation v1.0

## Scope and priority
Project #1 remains Film Festival OS™. This workflow runs automatically on each
push to `ci/ffos-release-candidate-22sep2026` and each PR to `main`.
It operates only on the dedicated FFOS repository; the other R&D projects
are outside its scope.

## Worker contract
- Architecture: checks the GitHub project and branch scope, changeset whitespace,
  expected jury guard/test files and duplicate SQL migration version numbers.
- Implementation: installs locked npm dependencies, checks TypeScript, builds
  the web bundle using CI placeholders, and verifies the bundle entry point.
- QA/security: checks tracked secrets, runs static jury tests, checks migration 095
  in isolated PostgreSQL and typechecks every Supabase Edge Function with Deno.
- Documentation: validates this control contract and its recovery reference.
- Supervisor: waits for all four GitHub Actions jobs, writes an immutable
  per-run checkpoint artifact and fails closed (HOLD) if any worker fails.

## No Collateral Damage™
The four workers use read-only GitHub permissions and have no production
secrets. The PostgreSQL integration test runs only in a disposable CI service.
No worker changes live Supabase, submits payments, deploys code, rewrites
another project or autonomously merges branches. The workflow runs against
a Git commit and has no authority to apply production changes.

## Human approval gate
PASS is a prerequisite for controlled integration, never permission to deploy.
No live Supabase migration is performed by this workflow. Explicit human
approval remains necessary for database migrations, production deployments,
membership changes, invitations, refunds or payouts. Migration 095 is staged
but not applied. Review immutability and live-account negative security tests
are pending before the FFOS release hold can be lifted.

## Recovery
Last fully verified green checkpoint before this workflow:
`44fbec6c1ad2cbdc69e1b6eba9972f9391e54c84`.
If the Supervisor orchestration fails, revert only its workflow/documentation
commit; do not change the live database. GitHub Actions retains a consolidated
supervisor-checkpoint artifact for 30 days. Compare results with the previous
green FFOS Release CI run to isolate integration errors.

## Not yet automated
These are deterministic CI workers, **not independent AI coding agents**.
They do not create features, author fixes, deploy migrations, access secret
projects or perform work without a GitHub event. A sandboxed issue-to-patch
worker and independently reviewed integration queue are future phases, not
features claimed to exist today.
