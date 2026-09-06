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

export type UpdateEntry = {
  id: string;
  authorId: string;
  text: string;
  at: string;
  status?: TaskStatus;
  attachment?: string;
  system?: boolean;
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

export type AppState = {
  tasks: Assignment[];
  notices: Notice[];
  currentUserId: string;
};

export const departments = [
  { id: "studies", name: "قسم الدراسات", short: "الدراسات" },
  { id: "networks", name: "قسم الشبكات", short: "الشبكات" },
  { id: "support", name: "قسم الدعم الفني", short: "الدعم الفني" },
  { id: "systems", name: "قسم الأنظمة", short: "الأنظمة" },
];

export const users: DemoUser[] = [
  { id: "boss", name: "رئيس الفرع", title: "رئيس الفرع", role: "boss" },
  { id: "head-studies", name: "رئيس قسم الدراسات", title: "رئيس قسم", role: "head", departmentId: "studies" },
  { id: "head-networks", name: "رئيس قسم الشبكات", title: "رئيس قسم", role: "head", departmentId: "networks" },
  { id: "head-support", name: "رئيس قسم الدعم الفني", title: "رئيس قسم", role: "head", departmentId: "support" },
  { id: "head-systems", name: "رئيس قسم الأنظمة", title: "رئيس قسم", role: "head", departmentId: "systems" },
  { id: "employee-studies", name: "عنصر الدراسات", title: "عنصر", role: "employee", departmentId: "studies" },
];

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export function makeSeedState(): AppState {
  const tasks: Assignment[] = [
    {
      id: "a-1", number: "PR-0261", kind: "project", title: "تطوير شبكة لمبنى إداري", details: "مراجعة توزيع نقاط الشبكة ومسارات الربط ورفع الملاحظات الفنية النهائية.", location: "الموقع الإداري التجريبي", referenceNumber: "REF-104", departmentId: "studies", priority: "important", status: "active", createdAt: ago(31), updatedAt: ago(6), issuedById: "boss", ownerId: "head-studies", assigneeId: "head-studies",
      updates: [
        { id: "u-1", authorId: "boss", text: "تم إنشاء المشروع وإحالته إلى قسم الدراسات.", at: ago(31), system: true },
        { id: "u-2", authorId: "head-studies", text: "تم الاستلام وبدأت مراجعة المخططات الحالية.", at: ago(27), status: "active" },
        { id: "u-3", authorId: "employee-studies", text: "تم تدقيق نقاط الربط الرئيسية، والعمل جارٍ على الملاحظات النهائية.", at: ago(6) },
      ],
    },
    {
      id: "a-2", number: "PR-0262", kind: "project", title: "تصميم تغطية كاميرات لموقع تجريبي", details: "اقتراح مواقع الكاميرات ونوع التغطية المطلوبة وإعداد تصور أولي قابل للمراجعة.", location: "موقع ميداني تجريبي", referenceNumber: "REF-105", departmentId: "studies", priority: "urgent", status: "review", createdAt: ago(24), updatedAt: ago(2), issuedById: "boss", ownerId: "head-studies", assigneeId: "head-studies",
      updates: [
        { id: "u-4", authorId: "boss", text: "تم إنشاء المشروع.", at: ago(24), system: true },
        { id: "u-5", authorId: "head-studies", text: "اكتمل التصور الأولي وأصبح جاهزاً للمراجعة.", at: ago(2), status: "review", attachment: "camera-layout-demo.pdf" },
      ],
    },
    {
      id: "a-3", number: "TS-0263", kind: "task", parentProjectId: "a-1", title: "اختبار مسار ربط احتياطي", details: "تنفيذ اختبار وظيفي لمسار الربط الاحتياطي وتوثيق النتيجة والملاحظات.", location: "الموقع الإداري التجريبي", referenceNumber: "REF-104/T1", departmentId: "networks", priority: "normal", status: "waiting", createdAt: ago(18), updatedAt: ago(4), issuedById: "boss", ownerId: "head-networks", assigneeId: "office-networks",
      updates: [
        { id: "u-6", authorId: "boss", text: "تم إنشاء المهمة وربطها بالمشروع وإحالتها إلى قسم الشبكات.", at: ago(18), system: true },
        { id: "u-7", authorId: "head-networks", text: "بانتظار توفر نافذة الاختبار المناسبة قبل تنفيذ التبديل.", at: ago(4), status: "waiting" },
      ],
    },
    {
      id: "a-4", number: "TS-0264", kind: "task", title: "معالجة ملاحظة صيانة في غرفة مراقبة", details: "فحص المشكلة وتوثيق سببها والإجراء التصحيحي المتخذ.", location: "غرفة مراقبة تجريبية", departmentId: "support", priority: "important", status: "new", createdAt: ago(3), updatedAt: ago(3), issuedById: "boss", ownerId: "head-support", assigneeId: "head-support",
      updates: [{ id: "u-8", authorId: "boss", text: "تم إنشاء المهمة وإحالتها إلى قسم الدعم الفني.", at: ago(3), system: true }],
    },
    {
      id: "a-5", number: "TS-0260", kind: "task", parentProjectId: "a-2", title: "تحديث توثيق الأجهزة في غرفة الخوادم التجريبية", details: "تحديث السجل الفني وحالة الأجهزة وتوثيق التغييرات المنفذة.", location: "غرفة خوادم تجريبية", departmentId: "systems", priority: "normal", status: "done", createdAt: ago(70), updatedAt: ago(28), issuedById: "boss", ownerId: "head-systems", assigneeId: "head-systems",
      updates: [
        { id: "u-9", authorId: "head-systems", text: "تم استكمال التحديث وإرسال السجل للمراجعة.", at: ago(30), status: "review" },
        { id: "u-10", authorId: "boss", text: "تم الاعتماد وإنهاء المهمة.", at: ago(28), status: "done", system: true },
      ],
    },
  ];

  return {
    tasks,
    currentUserId: "boss",
    notices: [
      { id: "n-1", userId: "boss", taskId: "a-2", text: "مشروع جاهز للمراجعة: تصميم تغطية كاميرات", at: ago(2), read: false },
      { id: "n-2", userId: "head-studies", taskId: "a-1", text: "يوجد تحديث جديد على المشروع PR-0261", at: ago(6), read: false },
    ],
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

export const STORAGE_KEY = "command-center-v2-demo";
