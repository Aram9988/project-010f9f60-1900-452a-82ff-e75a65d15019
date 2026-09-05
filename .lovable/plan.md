# Arabic Task Management — Public Prototype Plan

This repository contains a generic public frontend prototype for an Arabic-first RTL task-management application.

## Public-demo rules

- All users, departments, comments, tasks and attachments must be obviously fictitious demo data.
- Do not commit real organization names, personnel names, ranks, internal locations, network topology, IP addressing, VPN configuration, credentials, access tokens or operational documents.
- Do not add a real backend, production credentials or private infrastructure details to the public repository.
- The public preview is not an authentication or security boundary.

## Product direction

Keep the daily workflow small and understandable:

`Create task → acknowledge → update/status → submit for approval → approve/end or return`

Primary daily areas:
- Dashboard
- Tasks
- New task
- Reports

Administration, audit and settings should remain available only to authorized demo roles and should not clutter normal navigation.

## Frontend foundations

- React + TypeScript
- TanStack Router / Start
- Tailwind CSS / shadcn/ui
- Arabic RTL and responsive layout
- Zustand-backed local demo state
- Typed service layer so a private backend can replace demo storage later

## Security boundary

Client-side roles and permissions exist only to demonstrate intended product behavior. A production deployment requires server-side authorization, real authentication, protected file storage, a database, audit controls and deployment-specific security configuration.

## Demo data

Seed data must use generic labels such as “المدير التجريبي” and generic task examples. It must never resemble a real personnel directory or disclose operational infrastructure.
