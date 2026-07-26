# منظومة إدارة ومتابعة التكليفات — Frontend Prototype Plan

A polished Arabic-first, RTL, institutional web app for وزارة الداخلية / قيادة الأمن الداخلي / فرع اتصالات ريف دمشق. Frontend-only prototype with realistic mock data and a clean service layer so a local backend can plug in later.

## Scope of this build

Build the full navigable prototype in one pass. No Supabase, no cloud. Mock auth via a role switcher. All data lives in an in-memory `mockDb` behind typed services.

## Tech & foundations

- TanStack Start (existing template), React + TS, Tailwind v4, shadcn/ui.
- RTL: set `<html dir="rtl" lang="ar">` in `__root.tsx`; sidebar on the right; icons mirrored where directional.
- Font: Tajawal via `<link>` in root head. Add `--font-sans` in `@theme`.
- Theme tokens in `src/styles.css`: navy primary, soft gray surfaces, muted gold accent, semantic red (overdue) / green (approved). Light + dark.
- Dark mode toggle stored in `localStorage`.

## Data layer

`src/lib/mock/` — seed data (users, departments, tasks, comments, activity, notifications, audit).
`src/services/` — `taskService`, `userService`, `departmentService`, `reportService`, `notificationService`, `discussionService`, `auditService`, `authService`. All async, Promise-based, so a REST/RPC backend can replace them later.
State: `Zustand` store for session (current role/user), notifications badge, theme, saved filters. React Query for reads/mutations against the services.

Models: `Task`, `TaskStatus`, `TaskPriority`, `Comment` (with `type`, `isFormalInstruction`, `acknowledgedBy`, `parentId`), `ActivityEvent`, `Attachment`, `User`, `Role`, `Department`, `Notification`, `AuditEntry`.

Task numbers auto-generated as `TK-2026-XXXX`.

## App shell

`src/components/shell/` — `AppShell`, `Sidebar` (right-side, collapsible, icon mini-mode), `TopBar` (branch identity block, global search, notifications popover, role switcher, profile menu, theme toggle), `MobileBottomNav`, `Breadcrumbs`.

Role switcher: prominent dropdown in the top bar; changes the active mock user and re-renders permitted nav/actions.

## Routes (TanStack file-based)

- `/login` — official Arabic login screen (public, no gate).
- `/` — redirects to `/dashboard`.
- `/dashboard` — role-aware dashboard (Boss / Associate / Office / Dept Head / Employee / Admin variants).
- `/tasks` — all tasks (list / kanban / calendar tabs, filters, saved filters, search, sort, columns, bulk actions).
- `/tasks/mine` — tasks for current mock user.
- `/tasks/new` — fast create form + prominent «تسجيل تكليف شفهي» modal trigger.
- `/tasks/$taskId` — detail page: header, side summary, tabs (الكل / المناقشات / التوجيهات الرسمية / سجل التنفيذ / المرفقات / المهام الفرعية), approval panel, sticky quick actions.
- `/departments` — list + drill-in.
- `/users` — admin users & permission matrix preview.
- `/reports` — filters + list of report types + printable preview screen (`/reports/$reportId`) with mock print/PDF/Excel buttons.
- `/notifications` — center with unread grouping and links.
- `/audit` — filterable immutable-looking log.
- `/settings` — session/password/2FA/attachments/backup/audit retention/confidential visibility + VPN architecture note.
- `/profile` — current user profile.

Each route has its own `head()` metadata in Arabic.

## Discussion & instructions (core)

`DiscussionThread` component:
- Threaded replies (parent/child), author + role + timestamp.
- Comment-type chips: تعليق / توجيه / استفسار / تحديث / طلب تعديل / ملاحظة داخلية.
- Compose bar with type selector, @mention picker, attachment mock, «تحويل إلى توجيه رسمي» toggle for authorized roles.
- Formal instruction card: pinned to top, gold border, «بانتظار الاستلام» state → one-click «تأكيد الاستلام» button for the assigned dept head; records acknowledger + timestamp.
- Edited comments show «تم التعديل»; hidden comments show placeholder but persist in audit.

`ActivityTimeline` component for سجل التنفيذ (system events only). Combined view merges both, sorted by time.

## Task lifecycle & badges

Status + priority badge components using semantic tokens. Critical tasks get a subtle left border and pin to top of relevant lists. Overdue = red; approved = green; everything else stays calm.

## Approval flow

On detail page for tasks in `مقدم للمراجعة`, boss/associate see an ApprovalPanel with: «اعتماد وإنهاء» (green), «إعادة للتعديل» (requires comment), «طلب معلومات إضافية». Confirmation dialogs on all three.

## Notifications

`notificationService` seeds a mix of assignment / mention / reply / formal instruction / approval / deadline / overdue events. Popover in top bar + full page. Unread badge count from Zustand.

## Reports

Report index page → click opens a formal Arabic printable preview (A4-style card, ministry header block, table, signature line). Print/PDF/Excel are UI-only actions that toast «قيد التنفيذ في النسخة النهائية».

## Mock seed

- 4 departments as listed.
- ~12 users covering all 6 roles.
- 18 tasks spread across all statuses & priorities, tagged with the requested topics (شبكات، كاميرات، صيانة، دراسات، بنى تحتية، كابلات، غرف عمليات، خزائن شبكية).
- Several tasks with threaded boss↔dept-head conversations, pending formal instructions, overdue items, blocked items, awaiting approval, completed & approved.
- Audit log entries covering all listed event types.

## Visual system

- Primary navy `oklch(0.28 0.06 260)`, gold accent `oklch(0.75 0.12 85)`, danger `oklch(0.58 0.22 27)`, success `oklch(0.55 0.14 155)`.
- Surfaces: white / `oklch(0.98 0.005 250)`; borders soft; radius 0.75rem; shadow subtle.
- Typography: Tajawal 400/500/600/700; numeric tabular.
- Dark mode: deep navy background, elevated surfaces.

## Out of scope for this pass

- Real auth, real file upload, real print/export, real search backend.
- SEO — internal app.
- Sitemap/robots — internal app, skip.

## Delivery

Ship all pages navigable with realistic content in a single build. Prioritize breadth + polish of common flows (dashboard, task list, task detail with discussion + formal instruction + approval) over exhaustive admin CRUD.
