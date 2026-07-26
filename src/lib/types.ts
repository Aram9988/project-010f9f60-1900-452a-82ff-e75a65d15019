export type Role =
  | "boss"
  | "associate"
  | "office"
  | "dept_head"
  | "employee"
  | "diwan"
  | "admin";

export const ROLE_LABELS: Record<Role, string> = {
  boss: "المدير",
  associate: "معاون المدير",
  office: "مسؤول المكتب",
  dept_head: "رئيس القسم",
  employee: "موظف",
  diwan: "الديوان",
  admin: "مدير النظام",
};

export interface Department {
  id: string;
  name: string;
  short: string;
  code?: string;
  headId: string;
  officeResponsibleId?: string;
  archived?: boolean;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  departmentId?: string;
  rank?: string;
  username: string;
  avatarColor?: string;
  active?: boolean;
  archived?: boolean;
}

export type TaskStatus =
  | "draft"
  | "new"
  | "received"
  | "in_progress"
  | "waiting_info"
  | "blocked"
  | "submitted"
  | "returned"
  | "approved"
  | "cancelled"
  | "archived";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  draft: "مسودة",
  new: "جديد",
  received: "تم الاستلام",
  in_progress: "قيد التنفيذ",
  waiting_info: "بانتظار المعلومات",
  blocked: "متوقف / عالق",
  submitted: "مقدم للمراجعة",
  returned: "معاد للتعديل",
  approved: "مكتمل ومعتمد",
  cancelled: "ملغى",
  archived: "مؤرشف",
};

export type TaskPriority = "normal" | "important" | "urgent" | "critical";

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  normal: "عادي",
  important: "مهم",
  urgent: "عاجل",
  critical: "عاجل جداً",
};

export type CommentType =
  | "comment"
  | "instruction"
  | "question"
  | "update"
  | "revision_request"
  | "internal_note";

export const COMMENT_TYPE_LABELS: Record<CommentType, string> = {
  comment: "تعليق",
  instruction: "توجيه",
  question: "استفسار",
  update: "تحديث",
  revision_request: "طلب تعديل",
  internal_note: "ملاحظة داخلية",
};

export type QuestionStatus = "waiting" | "answered" | "resolved";

export interface Attachment {
  id: string;
  name: string;
  kind: "image" | "pdf" | "word" | "excel" | "drawing" | "screenshot";
  size: string;
  mime?: string;
  dataUrl?: string;
  uploadedById?: string;
  uploadedAt?: string;
  commentId?: string;
}

export interface Comment {
  id: string;
  taskId: string;
  parentId?: string;
  authorId: string;
  type: CommentType;
  body: string;
  createdAt: string;
  edited?: boolean;
  hidden?: boolean;
  pinned?: boolean;
  isFormalInstruction?: boolean;
  acknowledgedByUserId?: string;
  acknowledgedAt?: string;
  questionStatus?: QuestionStatus;
  attachments?: Attachment[];
  mentions?: string[];
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  assigneeId?: string;
}

export type ActivityType =
  | "task_created"
  | "task_assigned"
  | "task_acknowledged"
  | "comment_added"
  | "reply_added"
  | "formal_instruction_issued"
  | "instruction_acknowledged"
  | "file_uploaded"
  | "file_removed"
  | "progress_updated"
  | "task_submitted"
  | "task_returned"
  | "task_approved"
  | "comment_hidden"
  | "status_changed"
  | "task_archived"
  | "task_restored"
  | "task_deleted"
  | "update_posted";

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  task_created: "إنشاء التكليف",
  task_assigned: "إسناد التكليف",
  task_acknowledged: "تأكيد الاستلام",
  comment_added: "إضافة تعليق",
  reply_added: "إضافة رد",
  formal_instruction_issued: "إصدار توجيه رسمي",
  instruction_acknowledged: "تأكيد استلام توجيه",
  file_uploaded: "رفع مرفق",
  file_removed: "حذف مرفق",
  progress_updated: "تحديث نسبة الإنجاز",
  task_submitted: "تقديم للمراجعة",
  task_returned: "إعادة للتعديل",
  task_approved: "اعتماد وإنهاء",
  comment_hidden: "إخفاء تعليق",
  status_changed: "تغيير الحالة",
  task_archived: "أرشفة التكليف",
  task_restored: "استعادة التكليف",
  task_deleted: "حذف التكليف",
  update_posted: "تحديث تنفيذي",
};

export interface ActivityEvent {
  id: string;
  taskId: string;
  type: ActivityType;
  actorId: string;
  createdAt: string;
  detail?: string;
}

export interface Task {
  id: string;
  number: string;
  title: string;
  description: string;
  issuedById: string;
  departmentId: string;
  deptHeadId?: string;
  assigneeId?: string;
  participantIds: string[];
  issuedAt: string;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  tags: string[];
  attachments: Attachment[];
  subtasks: Subtask[];
  delayReason?: string;
  completionSummary?: string;
  approvedById?: string;
  approvedAt?: string;
  archived?: boolean;
  archivedById?: string;
  archivedAt?: string;
  archiveReason?: string;
  deletedById?: string;
  deletedAt?: string;
}

export type NotificationType =
  | "assignment"
  | "mention"
  | "reply"
  | "formal_instruction"
  | "ack_required"
  | "returned"
  | "submitted"
  | "approved"
  | "update"
  | "archive"
  | "restore"
  | "attachment"
  | "password_request"
  | "password_changed"
  | "comment";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  taskId?: string;
  commentId?: string;
  createdAt: string;
  read: boolean;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  taskId?: string;
  action: ActivityType;
  detail?: string;
  createdAt: string;
}

// ---------- Permissions ----------
export type Permission =
  | "view_all_tasks"
  | "view_department_tasks"
  | "create_task"
  | "assign_task"
  | "acknowledge_task"
  | "update_task"
  | "comment"
  | "issue_formal_instruction"
  | "acknowledge_instruction"
  | "upload_attachment"
  | "submit_task"
  | "return_task"
  | "approve_task"
  | "delete_task"
  | "restore_task"
  | "permanently_delete_task"
  | "view_archived_tasks"
  | "view_reports"
  | "export_reports"
  | "manage_departments"
  | "manage_users"
  | "manage_permissions"
  | "view_audit";

export const PERMISSION_LABELS: Record<Permission, string> = {
  view_all_tasks: "عرض جميع التكليفات",
  view_department_tasks: "عرض تكليفات القسم",
  create_task: "إنشاء تكليف",
  assign_task: "إسناد التكليفات",
  acknowledge_task: "تأكيد استلام التكليف",
  update_task: "تحديث التكليف",
  comment: "إضافة تعليق",
  issue_formal_instruction: "إصدار توجيه رسمي",
  acknowledge_instruction: "تأكيد استلام توجيه",
  upload_attachment: "رفع المرفقات",
  submit_task: "تقديم التكليف للاعتماد",
  return_task: "إعادة التكليف للتعديل",
  approve_task: "اعتماد التكليف",
  delete_task: "حذف / أرشفة التكليف",
  restore_task: "استعادة التكليف المؤرشف",
  permanently_delete_task: "حذف نهائي (إداري)",
  view_archived_tasks: "عرض المؤرشفات",
  view_reports: "عرض التقارير",
  export_reports: "طباعة وتصدير التقارير",
  manage_departments: "إدارة الأقسام",
  manage_users: "إدارة المستخدمين",
  manage_permissions: "إدارة الصلاحيات",
  view_audit: "عرض سجل التدقيق",
};

export const ALL_PERMISSIONS: Permission[] = Object.keys(PERMISSION_LABELS) as Permission[];

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  boss: [
    "view_all_tasks","create_task","assign_task","comment","issue_formal_instruction",
    "upload_attachment","submit_task","return_task","approve_task","delete_task",
    "restore_task","view_archived_tasks","view_reports","export_reports","view_audit",
  ],
  associate: [
    "view_all_tasks","create_task","assign_task","comment","issue_formal_instruction",
    "upload_attachment","submit_task","return_task","approve_task","delete_task",
    "restore_task","view_archived_tasks","view_reports","export_reports","view_audit",
  ],
  office: [
    "view_department_tasks","create_task","assign_task","comment","upload_attachment",
    "view_reports","export_reports",
  ],
  dept_head: [
    "view_department_tasks","acknowledge_task","update_task","comment",
    "acknowledge_instruction","upload_attachment","submit_task","view_reports",
  ],
  employee: [
    "view_department_tasks","acknowledge_task","update_task","comment",
    "acknowledge_instruction","upload_attachment",
  ],
  diwan: [
    "view_reports","export_reports",
  ],
  admin: [
    "manage_departments","manage_users","manage_permissions","view_audit",
    "view_reports","export_reports",
  ],
};

// ---------- Password Requests ----------
export interface PasswordChangeRequest {
  id: string;
  userId: string;
  requestedById: string;
  createdAt: string;
  status: "pending" | "resolved" | "cancelled";
  resolvedAt?: string;
}