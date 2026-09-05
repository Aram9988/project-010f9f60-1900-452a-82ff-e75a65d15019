# القيادة الذكية

Create a polished, professional, Arabic-first internal web application prototype named:

"منظومة إدارة ومتابعة التكليفات"

Organization identity:
"وزارة الداخلية"
"قيادة الأمن الداخلي"
"فرع اتصالات ريف دمشق"

This is an internal task-command and follow-up system for a government communications branch. It will eventually be deployed locally on an internal server and accessed only through a MikroTik WireGuard VPN. For this phase, build the FRONTEND PROTOTYPE only using realistic mock data. Do not create or depend on Supabase, cloud authentication, or any external backend yet. Create a clean API/data service abstraction so the mock data can later be replaced with our own locally hosted backend.

TECHNICAL REQUIREMENTS
- React + TypeScript.
- Tailwind CSS.
- shadcn/ui components.
- Fully responsive desktop, tablet, and mobile interface.
- Arabic as the primary language.
- Full RTL support across all screens, tables, forms, dialogs, navigation, icons, and timelines.
- Structure all code cleanly with reusable components and strongly typed mock models.
- Use a mock authentication/session switcher so we can preview the system as different roles.
- Do not expose or rely on public cloud services.
- Provide a clear services layer such as taskService, userService, reportService, notificationService, and discussionService.
- Use realistic Arabic sample data.

CORE PRODUCT PRINCIPLE
Every instruction from the boss must become a formal, trackable record:
The boss issues it -> responsibility is assigned -> receipt is acknowledged -> progress is visible -> discussion is preserved -> completion is documented -> the boss approves it.

The system should feel like a simple, friendly internal command center, not a complex Jira-like project management application. It must be very easy for non-technical users.

VISUAL DIRECTION
- Institutional, modern, calm, authoritative, and professional.
- Main color: dark navy blue.
- Backgrounds: white and soft light gray.
- Muted gold as an accent for important highlights.
- Red only for overdue or critical matters.
- Green only for approved completion.
- Avoid excessive gradients, visual effects, or playful styling.
- Use an elegant Arabic font such as IBM Plex Sans Arabic, Tajawal, or Noto Kufi Arabic.
- Use modern line icons.
- Support light and dark mode.
- Keep the interface spacious, highly readable, and uncluttered.
- The ministry/branch logo area should be configurable and use a tasteful placeholder, not a permanent hard-coded official emblem.

APP SHELL
Create a professional responsive app shell with:
- Right-side navigation drawer on desktop because the interface is RTL.
- Collapsible sidebar.
- Top header containing branch identity, global search, notifications, user profile, and light/dark toggle.
- Mobile bottom navigation or compact mobile drawer.
- Breadcrumbs on internal pages.
- Clear empty states, loading skeletons, validation states, toast messages, and confirmation dialogs.

USER ROLES
Create a role switcher in the prototype so each experience can be previewed.

1. المدير / Boss
Capabilities:
- Create tasks quickly.
- Assign tasks to a department, department head, office responsible, or individual.
- Set priority and deadline.
- View all departments and all tasks.
- Add comments, reply to comments, issue formal instructions, pin comments, and request acknowledgement.
- Approve completed tasks.
- Return tasks for correction.
- Cancel tasks where authorized.
- View overdue, blocked, and waiting-for-approval tasks.
- View daily, weekly, and monthly reports.

2. معاون المدير / Boss Associate
Capabilities:
- Create tasks on behalf of the boss.
- Follow all tasks.
- Add instructions and clarifications.
- Adjust deadlines when authorized.
- Follow up departments.
- Review submissions before the boss.
- Prepare reports and summaries.

3. مسؤول المكتب / Office Responsible
Capabilities:
- Register verbal or written instructions immediately.
- Assign tasks according to instructions.
- Track acknowledgement and deadlines.
- Follow overdue or inactive tasks.
- Add coordination notes.
- Prepare daily and weekly reports.
- View complete task history.

4. رئيس القسم / Department Head
There are four departments. Use realistic placeholder names such as:
- قسم الدراسات والبنى التحتية
- قسم الشبكات والأنظمة
- قسم الصيانة والدعم الفني
- قسم الاتصالات والتجهيزات
Capabilities:
- View tasks assigned to the department.
- Acknowledge receipt.
- Assign internally to an employee.
- Add progress updates.
- Add comments and reply to the boss.
- Ask questions and request clarification.
- Upload documents, photos, reports, and supporting files.
- Mark task ready for review.
- Explain delays and blockers.

5. موظف / Employee
Capabilities:
- View tasks assigned directly to them or shared with them.
- Add updates and comments where authorized.
- Upload supporting files.
- Complete assigned subtasks.

6. مدير النظام / System Administrator
Capabilities:
- Manage users, departments, permissions, settings, password reset, backups, and audit records.
- Do not automatically grant operational task-approval authority unless separately assigned.

TASK LIFECYCLE
Implement the following statuses with clear badges and timeline representation:
- مسودة
- جديد
- تم الاستلام
- قيد التنفيذ
- بانتظار المعلومات
- متوقف / عالق
- مقدم للمراجعة
- معاد للتعديل
- مكتمل ومعتمد
- ملغى
- مؤرشف

TASK PRIORITIES
- عادي
- مهم
- عاجل
- عاجل جداً

Critical tasks must always be visually prominent and appear at the top where appropriate.

TASK DATA MODEL AND UI
Each task should include:
- Automatically generated task number, such as TK-2026-0042.
- Clear title.
- Detailed description.
- Issued by.
- Responsible department.
- Responsible department head.
- Responsible employee.
- Supporting participants.
- Issued date and time.
- Due date and time.
- Priority.
- Status.
- Progress percentage.
- Tags.
- Attachments.
- Subtasks/checklist.
- Comments and threaded replies.
- Delay/blocker reason.
- Completion summary.
- Approval information.
- Complete immutable activity history.

FAST TASK CREATION
Create a very fast task-creation experience that can be completed in under one minute.
Required quick fields:
- Task title.
- Responsible department or person.
- Deadline.
- Priority.
- Optional details.
- Create button.

Also include a prominent action named:
"تسجيل تكليف شفهي"

This opens a quick modal for immediately recording a verbal instruction before it is forgotten. Allow saving as draft or issuing immediately.

TASK DISCUSSION AND INSTRUCTIONS
This is a core feature, not an optional extra.
Every task must have a dedicated section called:
"المناقشات والتوجيهات"

Implement threaded comments:
- Users can write comments.
- Users can reply directly to a specific comment.
- Replies remain grouped under the original comment.
- Show author, role, date, and time.
- Edited comments must show "تم التعديل".
- Normal users cannot permanently delete discussion history.
- A hidden comment should display "تم إخفاء هذا التعليق بواسطة المسؤول" while preserving the original in the audit log.

COMMENT TYPES
Allow comments to be classified with a visible icon and label:
- تعليق
- توجيه
- استفسار
- تحديث
- طلب تعديل
- ملاحظة داخلية

FORMAL INSTRUCTIONS
The boss or authorized associate can mark a message as:
"توجيه رسمي"

A formal instruction must:
- Display prominently.
- Be pinnable.
- Require acknowledgement from the responsible department head.
- Record who acknowledged it and when.
- Stay visible until acknowledged.
- Trigger a notification.
- Become part of the permanent task history.

MENTIONS AND NOTIFICATIONS
Support @mentions in the UI, for example:
@رئيس قسم الدراسات

Notify a user when:
- A new task is assigned.
- They are mentioned.
- Someone replies to their comment.
- A formal instruction is issued.
- A response or acknowledgement is required.
- A task is returned for correction.
- A task is submitted for approval.
- A task is approved.
- A deadline is approaching.
- A task is overdue.

Create an in-app notification center with unread counts and direct links to the relevant task/comment.

QUESTIONS AND RESOLUTION
Questions and requests should support statuses:
- بانتظار الرد
- تم الرد
- تم الحل

Unanswered questions and unacknowledged formal instructions should appear in dashboard attention widgets.

ATTACHMENTS
Comments and tasks should support mock attachments:
- Photos.
- PDF reports.
- Word documents.
- Excel files.
- Drawings.
- Screenshots.

Attachments should remain connected to the specific comment or update that explains them.

SEPARATE FORMAL PROGRESS FROM DISCUSSION
The task page should distinguish:
1. "سجل التنفيذ" for formal system events and progress changes.
2. "المناقشات والتوجيهات" for human communication.

Allow a combined timeline view as well as separate filters.

DASHBOARDS
Create role-specific dashboards.

BOSS DASHBOARD
Show executive summary cards:
- New tasks awaiting acknowledgement.
- Tasks due today.
- Overdue tasks.
- Critical tasks.
- Tasks submitted for approval.
- Unanswered questions.
- Unacknowledged formal instructions.
- Tasks completed this week.
- Department performance summary.

Include a clean compact table/list with:
Task, department, status, deadline, priority, progress, responsible person.

Also include simple professional charts for:
- Tasks by status.
- Tasks by department.
- Completion trend.
- Overdue trend.

DEPARTMENT DASHBOARD
Show:
- New tasks.
- Tasks requiring acknowledgement.
- Tasks due today.
- In-progress tasks.
- Blocked tasks.
- Returned tasks.
- Unanswered boss comments.
- Recently completed tasks.

OFFICE RESPONSIBLE DASHBOARD
Show:
- Tasks not acknowledged.
- Tasks without an update for several days.
- Overdue tasks.
- Tasks awaiting boss approval.
- Tasks by department.
- Daily activity summary.
- Formal instructions awaiting acknowledgement.

TASK LIST PAGE
Create a professional task list with:
- Search.
- Advanced filters.
- Saved filters.
- Sorting.
- Pagination.
- Column customization.
- Quick status update where permitted.
- Bulk actions where permitted.

Saved filter examples:
- مهامي
- تكليفات اليوم
- المتأخرة
- العاجلة جداً
- بانتظار الاستلام
- بانتظار اعتماد المدير
- المعادة للتعديل

Provide three views:
- List view as the default.
- Optional Kanban board.
- Calendar view.

TASK DETAIL PAGE
Create a highly polished, information-rich but easy-to-scan task detail screen.

Desktop layout suggestion:
- Main center area: discussion, instructions, and activity timeline.
- One side panel: task summary, progress, deadline, priority, department, assignee.
- Other compact panel or tab: attachments, participants, subtasks.

Mobile order:
1. Task summary.
2. Important/formal instructions.
3. Quick comment box.
4. Discussion timeline.
5. Progress/activity timeline.
6. Attachments and task details.

At the top show:
- Task number.
- Title.
- Status.
- Priority.
- Department.
- Responsible person.
- Deadline.
- Progress percentage.
- Main actions according to role.

Include tabs or segmented filters for:
- الكل
- المناقشات
- التوجيهات الرسمية
- سجل التنفيذ
- المرفقات
- المهام الفرعية

Use realistic Arabic threaded discussion examples between the boss and a department head.

APPROVAL FLOW
A department may submit a task for review, but cannot finally approve an important task.
The boss or authorized associate can:
- Approve and mark completed.
- Return for correction with a required comment.
- Request more information.

Show a clear approval panel and confirmation dialog.

REPORTS
Create a reports area with filters by date, department, user, status, and priority.
Reports:
- تقرير الإنجاز اليومي
- تقرير الأعمال قيد التنفيذ
- تقرير الأعمال المتأخرة
- التقرير الأسبوعي للقسم
- التقرير الشهري
- تقرير التكليفات حسب القسم
- تقرير التكليفات حسب المسؤول
- تقرير التكليفات حسب الأولوية
- تقرير متوسط زمن الإنجاز
- تقرير التكليفات الصادرة عن المدير

Create report-preview screens styled as formal printable Arabic reports.
Include UI actions for:
- طباعة
- تصدير PDF
- تصدير Excel
These can be frontend-only mock actions for now.

Daily report structure:
- الأعمال المنجزة
- الأعمال قيد التنفيذ
- الأعمال المتأخرة وأسباب التأخير
- خطة العمل لليوم التالي

USERS AND DEPARTMENTS
Create admin pages for:
- User list.
- Create/edit user dialog.
- Department list.
- Role assignment.
- Account status.
- Reset password mock action.
- Permission matrix preview.

AUDIT LOG
Create an immutable-looking audit log page with filters for:
- User.
- Task.
- Action type.
- Date range.

Example events:
- Task created.
- Task assigned.
- Task acknowledged.
- Comment added.
- Reply added.
- Formal instruction issued.
- Instruction acknowledged.
- Deadline changed.
- File uploaded.
- Progress updated.
- Task submitted.
- Task returned.
- Task approved.
- Comment hidden.

Do not expose internal technical IDs in the interface.

SECURITY AND SETTINGS UI
Create frontend settings screens representing future local deployment controls:
- Session timeout.
- Password policy.
- Two-factor authentication toggle placeholder.
- Allowed file types and attachment size.
- Backup status.
- Audit retention.
- Confidential task visibility.
- VPN/internal-access information panel.

Include a clear note in settings that the intended final architecture is:
User device -> MikroTik WireGuard VPN -> Internal server -> Task management system.

CONFIDENTIAL TASKS
Allow tasks to be marked confidential.
Confidential tasks should show a lock icon and appear only to selected roles/users in the mock permission behavior.

GLOBAL SEARCH
Create a global search interface that can search mock:
- Task number.
- Task title.
- Department.
- Responsible person.
- Comment content.
- Attachment name.

USER-FRIENDLY DETAILS
- Large clear buttons.
- Very few mandatory fields.
- One-click acknowledgement.
- One-click progress update.
- Easy comment and reply controls.
- Sticky quick actions on task pages.
- Clear tooltips.
- Helpful Arabic empty states.
- Avoid technical jargon.
- Remember recently selected departments in the quick-create mock behavior.
- Make critical and overdue items immediately recognizable without making the whole interface look alarming.

MOCK DATA
Populate the prototype with realistic Arabic data for the four departments and multiple users.
Create at least 15 tasks distributed across all statuses and priorities.
Include examples related to:
- شبكات الاتصالات
- منظومات الكاميرات
- أعمال الصيانة
- الدراسات الفنية
- البنى التحتية
- تمديد الكابلات
- تجهيز غرف العمليات
- تركيب الخزائن الشبكية

Include several threaded conversations between the boss and department heads, formal instructions awaiting acknowledgement, overdue tasks, completed tasks, blocked tasks, and tasks awaiting approval.

PRIMARY PAGES TO BUILD
1. تسجيل الدخول
2. لوحة التحكم
3. جميع التكليفات
4. تكليفاتي
5. إنشاء تكليف
6. تفاصيل التكليف
7. الأقسام
8. المستخدمون والصلاحيات
9. التقارير
10. الإشعارات
11. سجل التدقيق
12. إعدادات النظام
13. الملف الشخصي

LOGIN SCREEN
Design an official and elegant Arabic login screen with:
- Organization identity.
- Configurable logo placeholder.
- Username.
- Password.
- Remember me.
- Secure internal system message.
- No public signup.

DELIVERABLE
Build the complete navigable frontend prototype with all major pages, realistic mock data, role-switching, dialogs, filters, tables, dashboards, task discussion threads, formal instruction acknowledgement, approval flow, reports preview, notifications, users, departments, settings, and audit log.

Prioritize a cohesive, production-quality user experience over backend functionality. Ensure the design is super friendly, super professional, and extremely easy to learn.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/010f9f60-1900-452a-82ff-e75a65d15019).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
