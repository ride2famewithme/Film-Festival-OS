# Film Festival OS™ Project Management Software™ — Responsive Web/PWA Architecture

Status: APPROVED architecture / pre-test shell — 3 September 2026

## Approved delivery model
Use one responsive web/PWA-oriented codebase rather than separate Mac and Windows native codebases. The Project Management module is also exposed inside Film Festival OS™ as an optional role/tenant-scoped module.

## Core module
Portfolio | Projects | Tasks & Actions | Board | Timeline & Milestones | KPIs | Risks & Issues | Documents & Evidence | Team & Workload | Reports | AI Next Actions

## Architecture principles
- Reuse ProjectTimeline AI Control Centre concepts; do not create a disconnected management engine.
- Tenant/franchise/festival data isolation and role-based permissions are mandatory backend requirements.
- Global HQ can see only authorised roll-ups; local operators see only permitted portfolios.
- Responsive web first. PWA installation/offline behaviour must be implemented and verified in the deployment/testing phase.
- Avoid separate native Mac/Windows builds unless later justified. A native wrapper can be evaluated after the web/PWA product proves the need.
- AI suggestions are human-reviewable and overrideable.
- Project records connect to Risk, Compliance & Resilience Centre™, reports and controlled document/evidence records.

## Status boundary
This build provides product architecture and navigable shell screens. It does not yet prove persistent data, offline PWA behaviour, install prompts, background sync, notifications, tenant enforcement, security controls or production readiness.
