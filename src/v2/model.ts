export type Role = "boss" | "head" | "employee";
export type View = "overview" | "tasks" | "reports" | "admin" | "tree";
export type TaskStatus = "new" | "active" | "waiting" | "review" | "returned" | "done";
export type Priority = "normal" | "important" | "urgent";
export type WorkType = "project" | "task";

export type DemoUser = {
  id: string;
  name: string;
  title: string;
  role: Role;
  departmentId?: string;
};

export type AttachmentRef = {
  path: string;
  name: string;
  mime?: string;
  size?: number;
};

export type UpdateEntry = {
  id: string;
  authorId: string;
  text: string;
  at: string;
  status?: TaskStatus;
  attachment?: string;
  system?: boolean;
  editedAt?: string;
  editedById?: string;
  originalText?: string;
};

export type Assignment = {
  id: string;
  number: string;
  title: string;
  details: string;
  departmentId: string;
  priority: Priority;
  status: TaskStatus;
  kind?: WorkType;
  location?: string;
  referenceNumber?: string;
  parentProjectId?: string;
  createdAt: string;
  updatedAt: string;
  issuedById: string;
  ownerId?: string;
  assigneeId?: string;
  acceptedAt?: string;
  acceptedById?: string;
  acceptedAssigneeId?: string;
  archivedAt?: string;
  archivedById?: string;
  archivedPreviousStatus?: TaskStatus;
  updates: UpdateEntry[];
};

export type Notice = {
  id: string;
  userId: string;
  taskId?: string;
  text: string;
  at: string;
  read: boolean;
};

export type CallRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  createdAt: string;
  active: boolean;
  resolvedAt?: string;
};

export type AppState = {
  tasks: Assignment[];
  notices: Notice[];
  callRequests?: CallRequest[];
  currentUserId: string;
  deletedTaskIds?: string[];
  deletedUpdateIds?: string[];
};

// Legacy exports are kept only for compatibility with older components.
// They are never used to seed the live workspace.
export const departments: { id: string; name: string; short: string }[] = [];
export const users: DemoUser[] = [];

export function makeSeedState(): AppState {
  return {
    tasks: [],
    currentUserId: "",
    callRequests: [],
    notices: [],
    deletedTaskIds: [],
    deletedUpdateIds: [],
  };
}

export const statusMeta: Record<TaskStatus, { label: string; tone: string }> = {
  new: { label: "جديد", tone: "blue" },
  active: { label: "قيد التنفيذ", tone: "indigo" },
  waiting: { label: "بانتظار إجراء", tone: "amber" },
  review: { label: "بانتظار الاعتماد", tone: "violet" },
  returned: { label: "معاد للتعديل", tone: "rose" },
  done: { label: "مكتمل", tone: "emerald" },
};

export const priorityMeta: Record<Priority, string> = {
  normal: "عادي",
  important: "مهم",
  urgent: "عاجل",
};

export const workTypeMeta: Record<WorkType, string> = {
  project: "مشروع",
  task: "مهمة",
};

// Keep the old storage key so existing user-created data on linked devices is preserved.
export const STORAGE_KEY = "command-center-v2-demo";
