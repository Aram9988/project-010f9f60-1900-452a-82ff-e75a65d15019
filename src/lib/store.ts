import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_ROLE_PERMISSIONS,
  type ActivityEvent,
  type ActivityType,
  type AppNotification,
  type Attachment,
  type AuditEntry,
  type Comment,
  type CommentType,
  type Department,
  type NotificationType,
  type PasswordChangeRequest,
  type Permission,
  type Role,
  type Subtask,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type User,
} from "./types";
import {
  users as seedUsers,
  departments as seedDepartments,
  tasks as seedTasks,
  comments as seedComments,
  activity as seedActivity,
} from "./mock/seed";

/**
 * Central persisted application store (mock in-memory + localStorage).
 * This is the ONLY source of truth for structured data.
 * Services consume it via selectors; a future backend can replace the
 * body of each action with a fetch call without touching UI.
 */

export interface UISession {
  currentUserId: string;
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  recentDepartments: string[];
}

export interface AppData {
  users: User[];
  departments: Department[];
  tasks: Task[];
  comments: Comment[];
  activity: ActivityEvent[];
  notifications: AppNotification[];
  audit: AuditEntry[];
  passwordRequests: PasswordChangeRequest[];
  rolePermissions: Record<Role, Permission[]>;
  taskCounter: number;
  seeded: boolean;
}

type Store = UISession & AppData & {
  // ui
  setCurrentUser: (id: string) => void;
  setTheme: (t: "light" | "dark") => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  pushRecentDepartment: (id: string) => void;
  // data
  resetDemo: () => void;
  // dept
  createDepartment: (input: Omit<Department, "id">) => Department;
  updateDepartment: (id: string, patch: Partial<Department>) => void;
  archiveDepartment: (id: string) => void;
  restoreDepartment: (id: string) => void;
  deleteDepartment: (id: string) => { ok: boolean; reason?: string };
  // users
  createUser: (input: Omit<User, "id">) => User;
  updateUser: (id: string, patch: Partial<User>) => void;
  setUserActive: (id: string, active: boolean) => void;
  archiveUser: (id: string) => void;
  // permissions
  setRolePermissions: (role: Role, perms: Permission[]) => void;
  resetPermissionsToDefaults: () => void;
  // password
  requestPasswordChange: (userId: string, requestedById: string) => PasswordChangeRequest;
  resolvePasswordChange: (requestId: string, userId: string) => void;
  // tasks
  createTask: (input: Partial<Task> & { title: string; departmentId: string; issuedById: string }) => Task;
  updateTaskStatus: (id: string, status: TaskStatus, actorId: string, detail?: string) => void;
  updateTaskProgress: (id: string, progress: number, actorId: string) => void;
  updateTaskFields: (id: string, patch: Partial<Task>, actorId: string) => void;
  acknowledgeTask: (id: string, actorId: string) => void;
  submitTask: (id: string, actorId: string, summary?: string) => void;
  approveTask: (id: string, actorId: string) => void;
  returnTask: (id: string, actorId: string, reason: string) => void;
  archiveTask: (id: string, actorId: string, reason: string) => void;
  restoreTask: (id: string, actorId: string) => void;
  permanentlyDeleteTask: (id: string, actorId: string) => void;
  // comments
  addComment: (input: {
    taskId: string; authorId: string; body: string; type: CommentType;
    parentId?: string; isFormalInstruction?: boolean; mentions?: string[];
    attachments?: Attachment[];
  }) => Comment;
  acknowledgeInstruction: (commentId: string, userId: string) => void;
  hideComment: (commentId: string, actorId: string) => void;
  editComment: (commentId: string, actorId: string, newBody: string) => void;
  markQuestionAnswered: (commentId: string, actorId: string) => void;
  // attachments
  addAttachment: (taskId: string, actorId: string, att: Attachment) => void;
  removeAttachment: (taskId: string, actorId: string, attId: string) => void;
  // notifications
  markNotifRead: (id: string) => void;
  markAllNotifsRead: (userId: string) => void;
  markNotifUnread: (id: string) => void;
};

function nid(prefix: string) { return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
function nowIso() { return new Date().toISOString(); }

function defaultRolePerms(): Record<Role, Permission[]> {
  // shallow-clone to avoid persisting reference to constant object
  const out = {} as Record<Role, Permission[]>;
  for (const r of Object.keys(DEFAULT_ROLE_PERMISSIONS) as Role[]) {
    out[r] = [...DEFAULT_ROLE_PERMISSIONS[r]];
  }
  return out;
}

function initialData(): AppData {
  return {
    users: seedUsers.map((u) => ({ ...u, active: u.active ?? true })),
    departments: seedDepartments.map((d) => ({ ...d })),
    tasks: seedTasks.map((t) => ({ ...t, archived: t.status === "archived" })),
    comments: seedComments.map((c) => ({ ...c })),
    activity: seedActivity.map((a) => ({ ...a })),
    notifications: seedDemoNotifications(),
      audit: seedActivity.map((e) => ({
        id: "log_" + e.id, actorId: e.actorId, taskId: e.taskId,
        action: e.type, detail: e.detail, createdAt: e.createdAt,
      } as AuditEntry)),
    passwordRequests: [],
    rolePermissions: defaultRolePerms(),
    taskCounter: seedTasks.length,
    seeded: true,
  };
}

function seedDemoNotifications(): AppNotification[] {
  const t = (d: number) => new Date(Date.now() - d * 3_600_000).toISOString();
  return [
    { id: "seed_n1", userId: "u1", type: "submitted", title: "تكليف بانتظار الاعتماد", body: "TK-2026-0005 — تركيب خزانتين شبكيتين في مركز البيانات", taskId: "t5", createdAt: t(2), read: false },
    { id: "seed_n2", userId: "u1", type: "update", title: "تحديث تنفيذي", body: "TK-2026-0003: تم تحديد سبب العطل: تلف بطاقة تغذية.", taskId: "t3", commentId: "c11", createdAt: t(5), read: false },
    { id: "seed_n3", userId: "u1", type: "assignment", title: "تم استلام التكليف", body: "TK-2026-0001: تأكيد استلام التكليف", taskId: "t1", createdAt: t(24), read: true },
    { id: "seed_n4", userId: "u2", type: "submitted", title: "تكليف بانتظار الاعتماد", body: "TK-2026-0014 — تحديث خطة الطوارئ لغرفة العمليات", taskId: "t14", createdAt: t(6), read: false },
  ];
}

/**
 * Normalize / repair whatever shape came from localStorage so a partial or
 * stale persisted state can never crash the UI.
 */
function normalizePersistedState(s: any): any {
  const out: any = { ...(s ?? {}) };
  const arr = (v: any) => (Array.isArray(v) ? v : []);
  out.users = arr(out.users);
  out.departments = arr(out.departments);
  out.tasks = arr(out.tasks);
  out.comments = arr(out.comments);
  out.activity = arr(out.activity);
  out.notifications = arr(out.notifications);
  out.audit = arr(out.audit);
  out.passwordRequests = arr(out.passwordRequests);

  // Users: ensure valid users list; if empty, reseed users/departments/tasks.
  if (out.users.length === 0) {
    const seeded = initialData();
    out.users = seeded.users;
    out.departments = seeded.departments;
    if (out.tasks.length === 0) out.tasks = seeded.tasks;
    if (out.comments.length === 0) out.comments = seeded.comments;
    if (out.activity.length === 0) out.activity = seeded.activity;
    if (out.audit.length === 0) out.audit = seeded.audit;
    if (out.notifications.length === 0) out.notifications = seeded.notifications;
  }

  const validStatuses = new Set(["draft","new","received","in_progress","waiting_info","blocked","submitted","returned","approved","cancelled","archived"]);
  const validPriorities = new Set(["normal","important","urgent","critical"]);
  out.tasks = out.tasks.map((t: any) => ({
    id: String(t?.id ?? nid("t")),
    number: String(t?.number ?? ""),
    title: String(t?.title ?? "بدون عنوان"),
    description: String(t?.description ?? ""),
    issuedById: String(t?.issuedById ?? ""),
    departmentId: String(t?.departmentId ?? ""),
    deptHeadId: t?.deptHeadId,
    assigneeId: t?.assigneeId,
    participantIds: Array.isArray(t?.participantIds) ? t.participantIds.filter(Boolean) : [],
    issuedAt: typeof t?.issuedAt === "string" ? t.issuedAt : new Date().toISOString(),
    priority: validPriorities.has(t?.priority) ? t.priority : "normal",
    status: validStatuses.has(t?.status) ? t.status : "new",
    progress: typeof t?.progress === "number" && isFinite(t.progress) ? Math.max(0, Math.min(100, t.progress)) : 0,
    tags: Array.isArray(t?.tags) ? t.tags.filter((x: any) => typeof x === "string") : [],
    attachments: Array.isArray(t?.attachments) ? t.attachments.filter(Boolean) : [],
    subtasks: Array.isArray(t?.subtasks) ? t.subtasks.filter(Boolean) : [],
    delayReason: t?.delayReason,
    completionSummary: t?.completionSummary,
    approvedById: t?.approvedById,
    approvedAt: t?.approvedAt,
    archived: typeof t?.archived === "boolean" ? t.archived : t?.status === "archived",
    archivedById: t?.archivedById,
    archivedAt: t?.archivedAt,
    archiveReason: t?.archiveReason,
    deletedById: t?.deletedById,
    deletedAt: t?.deletedAt,
  }));

  out.comments = out.comments.map((c: any) => ({
    id: String(c?.id ?? nid("c")),
    taskId: String(c?.taskId ?? ""),
    parentId: c?.parentId,
    authorId: String(c?.authorId ?? ""),
    type: c?.type ?? "comment",
    body: String(c?.body ?? ""),
    createdAt: typeof c?.createdAt === "string" ? c.createdAt : new Date().toISOString(),
    edited: !!c?.edited,
    originalBody: c?.originalBody,
    editedAt: c?.editedAt,
    hidden: !!c?.hidden,
    pinned: !!c?.pinned,
    isFormalInstruction: !!c?.isFormalInstruction,
    acknowledgedByUserId: c?.acknowledgedByUserId,
    acknowledgedAt: c?.acknowledgedAt,
    questionStatus: c?.questionStatus,
    attachments: Array.isArray(c?.attachments) ? c.attachments : [],
    mentions: Array.isArray(c?.mentions) ? c.mentions : [],
  }));

  out.notifications = out.notifications
    .filter((n: any) => n && typeof n === "object")
    .map((n: any) => ({
      id: String(n.id ?? nid("n")),
      userId: String(n.userId ?? ""),
      type: n.type ?? "comment",
      title: String(n.title ?? ""),
      body: String(n.body ?? ""),
      taskId: typeof n.taskId === "string" ? n.taskId : undefined,
      commentId: typeof n.commentId === "string" ? n.commentId : undefined,
      eventId: n.eventId,
      createdAt: typeof n.createdAt === "string" ? n.createdAt : new Date().toISOString(),
      read: !!n.read,
    }));

  out.audit = out.audit
    .filter((e: any) => e && typeof e === "object")
    .map((e: any) => ({
      id: String(e.id ?? nid("log")),
      actorId: String(e.actorId ?? ""),
      taskId: typeof e.taskId === "string" ? e.taskId : undefined,
      action: e.action ?? "status_changed",
      detail: typeof e.detail === "string" ? e.detail : undefined,
      createdAt: typeof e.createdAt === "string" ? e.createdAt : new Date().toISOString(),
    }));

  out.activity = out.activity
    .filter((e: any) => e && typeof e === "object")
    .map((e: any) => ({
      id: String(e.id ?? nid("e")),
      taskId: String(e.taskId ?? ""),
      type: e.type ?? "status_changed",
      actorId: String(e.actorId ?? ""),
      createdAt: typeof e.createdAt === "string" ? e.createdAt : new Date().toISOString(),
      detail: typeof e.detail === "string" ? e.detail : undefined,
    }));

  // Merge missing permission keys from defaults.
  const defaults = defaultRolePerms();
  const perms: any = { ...defaults, ...(out.rolePermissions ?? {}) };
  for (const r of Object.keys(defaults)) {
    if (!Array.isArray(perms[r])) perms[r] = defaults[r as keyof typeof defaults];
  }
  // Admins must always retain manage_permissions.
  if (Array.isArray(perms.admin) && !perms.admin.includes("manage_permissions")) {
    perms.admin = [...perms.admin, "manage_permissions"];
  }
  out.rolePermissions = perms;

  // Fallback for currentUserId → boss if missing/inactive.
  const cu = out.users.find((u: any) => u.id === out.currentUserId && u.active !== false && !u.archived);
  if (!cu) out.currentUserId = out.users.find((u: any) => u.role === "boss" && u.active !== false)?.id ?? out.users[0]?.id ?? "u1";

  if (typeof out.taskCounter !== "number") out.taskCounter = out.tasks.length;
  out.seeded = true;
  return out;
}

function logActivity(state: Store, taskId: string, type: ActivityType, actorId: string, detail?: string) {
  const e: ActivityEvent = { id: nid("e"), taskId, type, actorId, createdAt: nowIso(), detail };
  state.activity.unshift(e);
  state.audit.unshift({ id: "log_" + e.id, actorId, taskId, action: type, detail, createdAt: e.createdAt });
}

function notify(state: Store, userId: string, n: Omit<AppNotification, "id" | "userId" | "createdAt" | "read">) {
  if (!userId) return;
  // Dedupe by (userId + eventId) primarily, or by content fingerprint fallback.
  const key = n.eventId ? `${userId}:${n.eventId}` : `${userId}:${n.type}:${n.taskId ?? ""}:${n.commentId ?? ""}:${n.body}`;
  const exists = state.notifications.some((x) => {
    const xk = x.eventId ? `${x.userId}:${x.eventId}` : `${x.userId}:${x.type}:${x.taskId ?? ""}:${x.commentId ?? ""}:${x.body}`;
    return xk === key;
  });
  if (exists) return;
  state.notifications.unshift({
    id: nid("n"), userId, createdAt: nowIso(), read: false, ...n,
  });
}

function notifyMany(state: Store, userIds: (string | undefined)[], actorId: string, n: Omit<AppNotification, "id" | "userId" | "createdAt" | "read">) {
  const set = new Set(userIds.filter(Boolean).filter((u) => u !== actorId) as string[]);
  set.forEach((u) => notify(state, u, n));
}

/**
 * Authorized audience for a task — only users who CAN access the task get
 * notified. Central authorization is mirrored here to avoid a circular
 * import with authz.ts (which reads the store).
 */
function taskAudience(task: Task, state: AppData): string[] {
  const perms = state.rolePermissions;
  const dept = state.departments.find((d) => d.id === task.departmentId);
  const ids = new Set<string>();
  for (const u of state.users) {
    if (u.active === false || u.archived) continue;
    if (u.role === "diwan") continue; // Diwan never receives operational notifications
    const p = perms[u.role] ?? [];
    if (p.includes("view_all_tasks")) { ids.add(u.id); continue; }
    if (u.departmentId === task.departmentId && p.includes("view_department_tasks")) { ids.add(u.id); continue; }
    if (task.issuedById === u.id) { ids.add(u.id); continue; }
    if (task.deptHeadId === u.id) { ids.add(u.id); continue; }
    if (task.assigneeId === u.id) { ids.add(u.id); continue; }
    if (task.participantIds.includes(u.id)) { ids.add(u.id); continue; }
    if (dept?.officeResponsibleId === u.id) { ids.add(u.id); continue; }
  }
  return Array.from(ids);
}

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      // ui defaults
      currentUserId: "u1",
      theme: "light",
      sidebarCollapsed: false,
      recentDepartments: [],
      // data
      ...initialData(),

      setCurrentUser: (id) => set({ currentUserId: id }),
      setTheme: (t) => set({ theme: t }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      pushRecentDepartment: (id) => set((s) => ({
        recentDepartments: [id, ...s.recentDepartments.filter((x) => x !== id)].slice(0, 3),
      })),

      resetDemo: () => set(() => ({ ...initialData() })),

      // ------ Departments ------
      createDepartment: (input) => {
        const d: Department = { ...input, id: nid("d") };
        set((s) => ({ departments: [...s.departments, d] }));
        return d;
      },
      updateDepartment: (id, patch) => set((s) => {
        const departments = s.departments.map((d) => (d.id === id ? { ...d, ...patch } : d));
        // Sync assigned head/office → departmentId & role
        let users = s.users;
        if (patch.headId) {
          users = users.map((u) => u.id === patch.headId
            ? { ...u, departmentId: id, role: u.role === "boss" || u.role === "associate" || u.role === "admin" ? u.role : "dept_head" }
            : u);
        }
        if (patch.officeResponsibleId) {
          users = users.map((u) => u.id === patch.officeResponsibleId ? { ...u, departmentId: id, role: "office" } : u);
        }
        return { departments, users };
      }),
      archiveDepartment: (id) => set((s) => ({
        departments: s.departments.map((d) => (d.id === id ? { ...d, archived: true } : d)),
      })),
      restoreDepartment: (id) => set((s) => ({
        departments: s.departments.map((d) => (d.id === id ? { ...d, archived: false } : d)),
      })),
      deleteDepartment: (id) => {
        const s = get();
        const hasUsers = s.users.some((u) => u.departmentId === id && u.active !== false && !u.archived);
        const hasTasks = s.tasks.some((t) => t.departmentId === id && !t.archived && !t.deletedAt && !["approved","archived","cancelled"].includes(t.status));
        if (hasUsers || hasTasks) {
          return { ok: false, reason: "لا يمكن حذف قسم يحتوي على مستخدمين نشطين أو تكليفات مفتوحة. أعد تعيينهم لقسم آخر أولاً أو استخدم الأرشفة." };
        }
        set({ departments: s.departments.filter((d) => d.id !== id) });
        return { ok: true };
      },

      // ------ Users ------
      createUser: (input) => {
        const u: User = { active: true, ...input, id: nid("u") };
        set((s) => ({ users: [...s.users, u] }));
        return u;
      },
      updateUser: (id, patch) => set((s) => ({
        users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
      })),
      setUserActive: (id, active) => set((s) => ({
        users: s.users.map((u) => (u.id === id ? { ...u, active } : u)),
      })),
      archiveUser: (id) => set((s) => ({
        users: s.users.map((u) => (u.id === id ? { ...u, archived: true, active: false } : u)),
      })),

      // ------ Permissions ------
      setRolePermissions: (role, perms) => set((s) => {
        // Guard: never leave admins without manage_permissions
        const next = { ...s.rolePermissions, [role]: perms };
        if (role === "admin" && !perms.includes("manage_permissions")) {
          next.admin = [...perms, "manage_permissions"];
        }
        return { rolePermissions: next };
      }),
      resetPermissionsToDefaults: () => set({ rolePermissions: defaultRolePerms() }),

      // ------ Password Requests ------
      requestPasswordChange: (userId, requestedById) => {
        const req: PasswordChangeRequest = {
          id: nid("pr"), userId, requestedById, createdAt: nowIso(), status: "pending",
        };
        set((s) => ({ passwordRequests: [req, ...s.passwordRequests] }));
        set((s) => {
          notify(s as Store, userId, {
            type: "password_request",
            title: "طلب تغيير كلمة المرور",
            body: "طلب منك مدير النظام تغيير كلمة المرور. افتح صفحة تغيير كلمة المرور من الملف الشخصي.",
          });
          return {};
        });
        return req;
      },
      resolvePasswordChange: (requestId, userId) => set((s) => {
        const nextReqs = s.passwordRequests.map((r) => r.id === requestId ? { ...r, status: "resolved" as const, resolvedAt: nowIso() } : r);
        // notify admins
        s.users.filter((u) => u.role === "admin").forEach((admin) => {
          notify(s as Store, admin.id, {
            type: "password_changed",
            title: "تم تغيير كلمة المرور",
            body: `المستخدم ${s.users.find((u) => u.id === userId)?.name ?? ""} أنهى طلب تغيير كلمة المرور.`,
          });
        });
        return { passwordRequests: nextReqs };
      }),

      // ------ Tasks ------
      createTask: (input) => {
        const s = get();
        const dept = s.departments.find((d) => d.id === input.departmentId);
        const t: Task = {
          id: nid("t"),
          number: "TK-" + new Date().getFullYear() + "-" + String(1000 + s.taskCounter + 1).padStart(4, "0"),
          title: input.title,
          description: input.description ?? "",
          issuedById: input.issuedById,
          departmentId: input.departmentId,
          deptHeadId: input.deptHeadId ?? dept?.headId,
          assigneeId: input.assigneeId,
          participantIds: input.participantIds ?? [],
          issuedAt: nowIso(),
          priority: input.priority ?? "normal",
          status: input.status ?? "new",
          progress: 0,
          tags: input.tags ?? [],
          attachments: input.attachments ?? [],
          subtasks: input.subtasks ?? [],
        };
        set((st) => {
          st.tasks.unshift(t);
          st.taskCounter += 1;
          logActivity(st as Store, t.id, "task_created", t.issuedById);
          if (t.deptHeadId || t.assigneeId) {
            logActivity(st as Store, t.id, "task_assigned", t.issuedById, dept?.short);
          }
          notifyMany(st as Store, taskAudience(t, st), t.issuedById, {
            type: "assignment",
            title: "تكليف جديد",
            body: `تم إسناد التكليف ${t.number} — ${t.title}`,
            taskId: t.id,
          });
          return {};
        });
        return t;
      },

      updateTaskStatus: (id, status, actorId, detail) => set((st) => {
        const t = st.tasks.find((x) => x.id === id); if (!t) return {};
        const from = t.status; t.status = status;
        logActivity(st as Store, id, "status_changed", actorId, detail || `${from} ← ${status}`);
        return {};
      }),
      updateTaskProgress: (id, progress, actorId) => set((st) => {
        const t = st.tasks.find((x) => x.id === id); if (!t) return {};
        const from = t.progress; t.progress = progress;
        logActivity(st as Store, id, "progress_updated", actorId, `${from}٪ ← ${progress}٪`);
        notifyMany(st as Store, taskAudience(t, st), actorId, {
          type: "update", title: "تحديث نسبة الإنجاز",
          body: `${t.number}: ${from}٪ ← ${progress}٪`, taskId: id,
        });
        return {};
      }),
      updateTaskFields: (id, patch, actorId) => set((st) => {
        const t = st.tasks.find((x) => x.id === id); if (!t) return {};
        Object.assign(t, patch);
        logActivity(st as Store, id, "status_changed", actorId, "تحديث بيانات");
        return {};
      }),
      acknowledgeTask: (id, actorId) => set((st) => {
        const t = st.tasks.find((x) => x.id === id); if (!t) return {};
        if (t.status === "new") t.status = "received";
        logActivity(st as Store, id, "task_acknowledged", actorId);
        notifyMany(st as Store, [t.issuedById, ...st.users.filter(u=>u.role==="boss"||u.role==="associate").map(u=>u.id)], actorId, {
          type: "assignment", title: "تم استلام التكليف",
          body: `${t.number}: تأكيد استلام التكليف`, taskId: id,
        });
        return {};
      }),
      submitTask: (id, actorId, summary) => set((st) => {
        const t = st.tasks.find((x) => x.id === id); if (!t) return {};
        t.status = "submitted"; t.progress = Math.max(t.progress, 100); if (summary) t.completionSummary = summary;
        logActivity(st as Store, id, "task_submitted", actorId, summary);
        notifyMany(st as Store, st.users.filter(u=>u.role==="boss"||u.role==="associate").map(u=>u.id), actorId, {
          type: "submitted", title: "تكليف بانتظار الاعتماد",
          body: `${t.number} — ${t.title}`, taskId: id,
        });
        return {};
      }),
      approveTask: (id, actorId) => set((st) => {
        const t = st.tasks.find((x) => x.id === id); if (!t) return {};
        t.status = "approved"; t.approvedById = actorId; t.approvedAt = nowIso();
        logActivity(st as Store, id, "task_approved", actorId);
        notifyMany(st as Store, taskAudience(t, st), actorId, {
          type: "approved", title: "تم اعتماد التكليف",
          body: `${t.number} — ${t.title}`, taskId: id,
        });
        return {};
      }),
      returnTask: (id, actorId, reason) => set((st) => {
        const t = st.tasks.find((x) => x.id === id); if (!t) return {};
        t.status = "returned"; t.delayReason = reason;
        logActivity(st as Store, id, "task_returned", actorId, reason);
        notifyMany(st as Store, [t.deptHeadId, t.assigneeId, ...t.participantIds], actorId, {
          type: "returned", title: "تكليف معاد للتعديل",
          body: `${t.number}: ${reason}`, taskId: id,
        });
        return {};
      }),
      archiveTask: (id, actorId, reason) => set((st) => {
        const t = st.tasks.find((x) => x.id === id); if (!t) return {};
        t.archived = true; t.archivedById = actorId; t.archivedAt = nowIso(); t.archiveReason = reason;
        logActivity(st as Store, id, "task_archived", actorId, reason);
        notifyMany(st as Store, taskAudience(t, st), actorId, {
          type: "archive", title: "أرشفة التكليف",
          body: `${t.number}: ${reason}`, taskId: id,
        });
        return {};
      }),
      restoreTask: (id, actorId) => set((st) => {
        const t = st.tasks.find((x) => x.id === id); if (!t) return {};
        t.archived = false; t.archivedById = undefined; t.archivedAt = undefined; t.archiveReason = undefined;
        logActivity(st as Store, id, "task_restored", actorId);
        notifyMany(st as Store, taskAudience(t, st), actorId, {
          type: "restore", title: "استعادة تكليف",
          body: `${t.number} — تمت الاستعادة`, taskId: id,
        });
        return {};
      }),
      permanentlyDeleteTask: (id, actorId) => set((st) => {
        const t = st.tasks.find((x) => x.id === id); if (!t) return {};
        logActivity(st as Store, id, "task_deleted", actorId);
        return { tasks: st.tasks.filter((x) => x.id !== id) };
      }),

      // ------ Comments ------
      addComment: (input) => {
        const c: Comment = {
          id: nid("c"),
          taskId: input.taskId, authorId: input.authorId, body: input.body, type: input.type,
          parentId: input.parentId, createdAt: nowIso(),
          isFormalInstruction: input.isFormalInstruction,
          pinned: input.isFormalInstruction || undefined,
          questionStatus: input.type === "question" ? "waiting" : undefined,
          mentions: input.mentions,
          attachments: input.attachments,
        };
        set((st) => {
          st.comments.push(c);
          const t = st.tasks.find((x) => x.id === input.taskId);
          if (!t) return {};
          if (input.isFormalInstruction) {
            logActivity(st as Store, t.id, "formal_instruction_issued", input.authorId);
            notifyMany(st as Store, [t.deptHeadId, t.assigneeId, ...t.participantIds], input.authorId, {
              type: "formal_instruction", title: "توجيه رسمي جديد",
              body: `${t.number}: ${input.body.slice(0, 80)}`,
              taskId: t.id, commentId: c.id,
            });
          } else if (input.type === "update") {
            logActivity(st as Store, t.id, "update_posted", input.authorId, input.body.slice(0, 120));
            notifyMany(st as Store, taskAudience(t, st), input.authorId, {
              type: "update", title: "تحديث تنفيذي",
              body: `${t.number}: ${input.body.slice(0, 80)}`, taskId: t.id, commentId: c.id,
            });
          } else if (input.parentId) {
            logActivity(st as Store, t.id, "reply_added", input.authorId);
            const parent = st.comments.find((x) => x.id === input.parentId);
            if (parent) notify(st as Store, parent.authorId, {
              type: "reply", title: "رد جديد على تعليقكم",
              body: `${t.number}: ${input.body.slice(0, 80)}`, taskId: t.id, commentId: c.id,
            });
          } else {
            logActivity(st as Store, t.id, "comment_added", input.authorId);
            notifyMany(st as Store, taskAudience(t, st), input.authorId, {
              type: "comment", title: "تعليق جديد",
              body: `${t.number}: ${input.body.slice(0, 80)}`, taskId: t.id, commentId: c.id,
            });
          }
          (input.mentions ?? []).forEach((uid) => notify(st as Store, uid, {
            type: "mention", title: "تم ذكرك في تعليق",
            body: `${t.number}: ${input.body.slice(0, 80)}`, taskId: t.id, commentId: c.id,
          }));
          return {};
        });
        return c;
      },

      acknowledgeInstruction: (commentId, userId) => set((st) => {
        const c = st.comments.find((x) => x.id === commentId); if (!c) return {};
        c.acknowledgedByUserId = userId; c.acknowledgedAt = nowIso();
        logActivity(st as Store, c.taskId, "instruction_acknowledged", userId);
        const t = st.tasks.find((x) => x.id === c.taskId);
        if (t) notifyMany(st as Store, [t.issuedById], userId, {
          type: "formal_instruction", title: "تم استلام توجيهكم",
          body: `${t.number}: تم تأكيد استلام التوجيه`, taskId: t.id, commentId,
        });
        return {};
      }),
      hideComment: (commentId, actorId) => set((st) => {
        const c = st.comments.find((x) => x.id === commentId); if (!c) return {};
        c.hidden = true;
        logActivity(st as Store, c.taskId, "comment_hidden", actorId);
        return {};
      }),

      editComment: (commentId, actorId, newBody) => set((st) => {
        const c = st.comments.find((x) => x.id === commentId); if (!c) return {};
        if (!c.edited) c.originalBody = c.body;
        c.body = newBody; c.edited = true; c.editedAt = nowIso();
        logActivity(st as Store, c.taskId, "comment_edited", actorId, newBody.slice(0, 120));
        return {};
      }),

      markQuestionAnswered: (commentId, actorId) => set((st) => {
        const c = st.comments.find((x) => x.id === commentId); if (!c || c.type !== "question") return {};
        c.questionStatus = "answered";
        logActivity(st as Store, c.taskId, "comment_added", actorId, "تم اعتبار السؤال مُجاباً");
        return {};
      }),

      // ------ Attachments (metadata in store; data URL kept inline; large blobs -> future IndexedDB) ------
      addAttachment: (taskId, actorId, att) => set((st) => {
        const t = st.tasks.find((x) => x.id === taskId); if (!t) return {};
        t.attachments.push({ ...att, uploadedById: actorId, uploadedAt: nowIso() });
        logActivity(st as Store, taskId, "file_uploaded", actorId, att.name);
        notifyMany(st as Store, taskAudience(t, st), actorId, {
          type: "attachment", title: "مرفق جديد",
          body: `${t.number}: ${att.name}`, taskId,
        });
        return {};
      }),
      removeAttachment: (taskId, actorId, attId) => set((st) => {
        const t = st.tasks.find((x) => x.id === taskId); if (!t) return {};
        const removed = t.attachments.find((a) => a.id === attId);
        t.attachments = t.attachments.filter((a) => a.id !== attId);
        if (removed) {
          logActivity(st as Store, taskId, "file_removed", actorId, removed.name);
          notifyMany(st as Store, taskAudience(t, st), actorId, {
            type: "attachment", title: "تم حذف مرفق",
            body: `${t.number}: ${removed.name}`, taskId,
          });
        }
        return {};
      }),

      // ------ Notifications ------
      markNotifRead: (id) => set((s) => ({
        notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
      })),
      markAllNotifsRead: (userId) => set((s) => ({
        notifications: s.notifications.map((n) => n.userId === userId ? { ...n, read: true } : n),
      })),
      markNotifUnread: (id) => set((s) => ({
        notifications: s.notifications.map((n) => n.id === id ? { ...n, read: false } : n),
      })),
    }),
    {
      name: "tk-app-v5",
      version: 5,
      migrate: (persisted: any, from) => {
        // Any state persisted before v5 predates the stabilization pass —
        // reseed the data slice cleanly while preserving UI prefs.
        if (!persisted || from < 5) {
          return normalizePersistedState({
            currentUserId: persisted?.currentUserId ?? "u1",
            theme: persisted?.theme ?? "light",
            sidebarCollapsed: persisted?.sidebarCollapsed ?? false,
            recentDepartments: [],
            ...initialData(),
          }) as any;
        }
        return normalizePersistedState(persisted);
      },
      partialize: (s) => ({
        currentUserId: s.currentUserId,
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        recentDepartments: s.recentDepartments,
        users: s.users,
        departments: s.departments,
        tasks: s.tasks,
        comments: s.comments,
        activity: s.activity,
        notifications: s.notifications,
        audit: s.audit,
        passwordRequests: s.passwordRequests,
        rolePermissions: s.rolePermissions,
        taskCounter: s.taskCounter,
        seeded: s.seeded,
      }),
    },
  ),
);

// legacy alias used by existing UI code
export const useSession = useAppStore;