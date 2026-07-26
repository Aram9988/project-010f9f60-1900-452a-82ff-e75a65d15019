export type Role =
  | "boss"
  | "associate"
  | "office"
  | "dept_head"
  | "employee"
  | "admin";

export const ROLE_LABELS: Record<Role, string> = {
  boss: "المدير",
  associate: "معاون المدير",
  office: "مسؤول المكتب",
  dept_head: "رئيس القسم",
  employee: "موظف",
  admin: "مدير النظام",
};

export interface Department {
  id: string;
  name: string;
  short: string;
  headId: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  departmentId?: string;
  rank?: string;
  username: string;
  avatarColor?: string;
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
  | "deadline_changed"
  | "file_uploaded"
  | "progress_updated"
  | "task_submitted"
  | "task_returned"
  | "task_approved"
  | "comment_hidden"
  | "status_changed";

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  task_created: "إنشاء التكليف",
  task_assigned: "إسناد التكليف",
  task_acknowledged: "تأكيد الاستلام",
  comment_added: "إضافة تعليق",
  reply_added: "إضافة رد",
  formal_instruction_issued: "إصدار توجيه رسمي",
  instruction_acknowledged: "تأكيد استلام توجيه",
  deadline_changed: "تعديل المهلة",
  file_uploaded: "رفع مرفق",
  progress_updated: "تحديث نسبة الإنجاز",
  task_submitted: "تقديم للمراجعة",
  task_returned: "إعادة للتعديل",
  task_approved: "اعتماد وإنهاء",
  comment_hidden: "إخفاء تعليق",
  status_changed: "تغيير الحالة",
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
  dueAt: string;
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
  confidential?: boolean;
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
  | "deadline"
  | "overdue";

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