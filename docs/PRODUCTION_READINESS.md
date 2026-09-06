# Production readiness — متابعة فرع اتصالات ريف دمشق

This repository currently contains a functional **frontend prototype/demo**. The UI and domain model are prepared for migration to a real internal server and database, but the current GitHub Pages build is **not a production security boundary**.

## Current frontend domain model

The application already models:

- Branch organizational hierarchy: branch head → department heads → office responsibles → members.
- Editable roles and permissions.
- Departments, offices, direct managers, users, active/inactive accounts and profile images.
- Projects and tasks with assignment, location, reference, priority and workflow state.
- Acceptance workflow: newly assigned work stays `new` until the assignee confirms receipt, then becomes `active`.
- Reassignment returns work to `new`, so the new assignee must accept it before it becomes active.
- Live topology where pulse/activity is based only on `active` work.
- Active, pending and completed work displayed on each person's node.
- Call requests between permitted hierarchy levels.
- Notifications per user.
- Work updates with audited correction metadata (`originalText`, `editedAt`, `editedById`).
- Private reminders and notes for the allowed workspace.
- Reminder date filters and overdue state.
- Reports and export UI.

## Authorization invariants for the real backend

These rules must be enforced server-side on every API endpoint and database query. The frontend is not enough.

1. **رئيس الفرع**
   - Can see the complete branch operational tree.
   - Can see all projects/tasks, notifications and live work states.
   - Can administer structure/users/roles according to granted permissions.

2. **رئيس قسم**
   - Can see only their department/team subtree.
   - Can assign/reassign work only inside their authorized team.
   - Work delegated to a subordinate remains `new` until that subordinate accepts it.

3. **مسؤول مكتب**
   - Can see only their office/team subtree when the role has `view_team_tree`.
   - Can delegate only to authorized descendants when the role has `assign_team_tasks`.
   - Delegated work remains `new` until the receiver accepts it.

4. **عنصر / إداري / آليات**
   - Must receive only explicitly allowed operational data.
   - Assignment must never grant cross-department access by itself.

5. **ديوان**
   - Reports-only unless permissions are explicitly changed.
   - Must not receive operational task/project content by default.

6. Unauthorized item IDs/routes must return a neutral `404` or equivalent and must not reveal titles, numbers, user names, attachments or metadata.

## Workflow invariants

- `new`: assigned but **not yet accepted**. Never generate live topology pulse.
- `active`: receiver confirmed receipt / execution started. Live topology pulse is enabled.
- `waiting`: temporarily waiting. No active pulse.
- `review`: submitted for review/approval. No active pulse.
- `returned`: returned for correction. No active pulse until implementation explicitly resumes it through an allowed transition.
- `done`: completed/approved. No active pulse.
- Reassignment always resets status to `new`.
- Acceptance event should be recorded in an immutable audit log.
- Completion must immediately remove active/pulse state.

## Notifications required on the server

Persist notifications in the database and create them transactionally for:

- New assignment awaiting acceptance.
- Acceptance / work becoming active.
- Reassignment.
- Work update.
- Submission for review.
- Return for correction.
- Completion/approval.
- Update correction/edit.
- Call request and call request resolution.
- Optional reminder due/overdue events.

Notifications must include user ID, related work ID where applicable, type, message, created time, read time and actor ID.

## Update editing / audit policy

- System-generated updates are immutable.
- A normal user may correct their own non-system update.
- رئيس الفرع may correct a non-system update when operationally required.
- Never overwrite history silently.
- Store the original text, corrected text, editor, edit timestamp and ideally an immutable revision table.

Recommended table: `work_update_revisions(id, update_id, previous_text, new_text, edited_by, edited_at)`.

## Recommended database entities

- `users`
- `roles`
- `permissions`
- `role_permissions`
- `departments`
- `offices`
- `work_items` (project/task)
- `work_updates`
- `work_update_revisions`
- `notifications`
- `call_requests`
- `reminders`
- `notes`
- `attachments`
- `audit_events`
- `sessions` or refresh-token records if applicable

Foreign keys should preserve organizational integrity. Prefer archive/disable over destructive deletes where history exists.

## Authentication requirements

Current demo passwords/session storage must be replaced completely.

Production requirements:

- Passwords hashed with Argon2id or bcrypt using a mature authentication library.
- Secure, HttpOnly, SameSite cookies or another approved server-managed session mechanism.
- CSRF protection where applicable.
- Login rate limiting and lockout/backoff.
- Session expiration and revocation.
- Optional TOTP for privileged accounts.
- No plaintext passwords in API responses, browser storage or logs.

## File and image storage

Current demo attachment handling/profile images are browser-oriented. Production should use central storage:

- Local protected filesystem or MinIO/S3-compatible internal storage.
- Database stores object metadata/path only.
- Allowlisted MIME types and size limits.
- Randomized server-side object names.
- Authorization check on every download.
- Malware scanning if the environment supports it.
- Profile images should be centrally stored instead of browser base64/localStorage.

## Reminders and private notes

Current browser storage must move to database records.

The backend must decide and enforce whether the allowed users share one workspace or each user owns private records. At minimum each record should have `owner_user_id`, timestamps, and access policy. Overdue is derived from `due_at < current_time AND completed_at IS NULL`.

Recommended reminder query presets:

- overdue
- today
- tomorrow
- next 7 days
- later
- no date
- completed

## Live topology

Do not poll the entire database aggressively. Recommended production design:

- REST API for initial tree/work data.
- WebSocket or Server-Sent Events for assignment/status/call-request changes.
- Recompute active path from work items with `status = active` only.
- Finished, waiting, review, returned and unaccepted/new work must not create pulse traffic.

## Recommended deployment architecture

- Frontend: built static React application served by Nginx.
- API: FastAPI or NestJS.
- Database: PostgreSQL.
- Attachments/profile images: protected local storage or MinIO.
- Reverse proxy/internal TLS: Nginx.
- Packaging: Docker Compose.
- Optional Redis for sessions/events only if needed.
- Network exposure: internal network / WireGuard VPN only.
- Automated encrypted PostgreSQL + attachment backups with restore testing.

## Production blockers in the current demo

Do **not** put real operational data into the current GitHub Pages demo because it still uses:

- localStorage for operational data.
- localStorage for organization data.
- localStorage for reminders/notes/call requests.
- sessionStorage for authentication session identity.
- browser-side plaintext demo passwords.
- frontend-only RBAC checks.
- browser-local profile image data.
- filename-only attachment prototype behavior.

These are expected prototype limitations, not database/server implementation defects.

## Handoff status

The frontend domain and workflows are suitable to use as the specification for the server/database phase. Production deployment with real data should happen only after the backend implements the authorization, authentication, persistence, audit, file-storage and backup requirements above.