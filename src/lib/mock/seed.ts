import type { ActivityEvent, Comment, Department, Task, User } from "@/lib/types";

/**
 * PUBLIC DEMO DATA ONLY.
 * Keep every person, task, attachment and department below fictitious and generic.
 * Never place real personnel, locations, network details or operational data here.
 */

export const departments: Department[] = [
  { id: "d1", name: "قسم الدراسات", short: "الدراسات", code: "STD", headId: "u4", officeResponsibleId: "u3" },
  { id: "d2", name: "قسم الشبكات", short: "الشبكات", code: "NET", headId: "u5" },
  { id: "d3", name: "قسم الصيانة", short: "الصيانة", code: "MNT", headId: "u6" },
  { id: "d4", name: "قسم التجهيزات", short: "التجهيزات", code: "EQP", headId: "u7" },
];

export const users: User[] = [
  { id: "u1", name: "المدير التجريبي", role: "boss", username: "boss", active: true },
  { id: "u2", name: "معاون المدير التجريبي", role: "associate", username: "associate", active: true },
  { id: "u3", name: "مسؤول المكتب التجريبي", role: "office", username: "office", departmentId: "d1", active: true },
  { id: "u4", name: "رئيس قسم الدراسات", role: "dept_head", username: "head1", departmentId: "d1", active: true },
  { id: "u5", name: "رئيس قسم الشبكات", role: "dept_head", username: "head2", departmentId: "d2", active: true },
  { id: "u6", name: "رئيس قسم الصيانة", role: "dept_head", username: "head3", departmentId: "d3", active: true },
  { id: "u7", name: "رئيس قسم التجهيزات", role: "dept_head", username: "head4", departmentId: "d4", active: true },
  { id: "u8", name: "موظف الدراسات التجريبي", role: "employee", username: "emp1", departmentId: "d1", active: true },
  { id: "u9", name: "موظف الشبكات التجريبي", role: "employee", username: "emp2", departmentId: "d2", active: true },
  { id: "u10", name: "موظف الصيانة التجريبي", role: "employee", username: "emp3", departmentId: "d3", active: true },
  { id: "u11", name: "موظف التجهيزات التجريبي", role: "employee", username: "emp4", departmentId: "d4", active: true },
  { id: "u12", name: "مدير النظام التجريبي", role: "admin", username: "admin", active: true },
  { id: "u13", name: "مستخدم الديوان التجريبي", role: "diwan", username: "diwan", active: true },
];

const now = new Date();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
const daysAgo = (days: number, hour = 10) => {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

function demoTask(
  id: string,
  title: string,
  departmentId: string,
  deptHeadId: string,
  status: Task["status"],
  priority: Task["priority"],
  days: number,
  assigneeId?: string,
  extra: Partial<Task> = {},
): Task {
  const n = Number(id.slice(1));
  return {
    id,
    number: `TK-DEMO-${String(n).padStart(4, "0")}`,
    title,
    description: "وصف تجريبي عام لا يحتوي على بيانات تشغيلية أو مواقع أو معلومات حقيقية.",
    issuedById: n % 4 === 0 ? "u2" : "u1",
    departmentId,
    deptHeadId,
    assigneeId,
    participantIds: [],
    issuedAt: daysAgo(days),
    priority,
    status,
    progress: status === "approved" ? 100 : status === "submitted" ? 90 : status === "new" ? 0 : 50,
    tags: ["تجريبي"],
    attachments: [],
    subtasks: [],
    ...extra,
  };
}

export const tasks: Task[] = [
  demoTask("t1", "إعداد دراسة فنية نموذجية", "d1", "u4", "in_progress", "important", 5, "u8"),
  demoTask("t2", "تركيب تجهيزات اختبار في بيئة تجريبية", "d4", "u7", "in_progress", "urgent", 2, "u11"),
  demoTask("t3", "معالجة بلاغ صيانة تجريبي", "d3", "u6", "in_progress", "critical", 0, "u10"),
  demoTask("t4", "تجهيز مساحة عمل نموذجية", "d4", "u7", "new", "important", 3, "u11"),
  demoTask("t5", "تنظيم تجهيزات شبكة تجريبية", "d2", "u5", "submitted", "important", 8, "u9", { completionSummary: "تم تنفيذ المثال التجريبي وإرساله للاعتماد." }),
  demoTask("t6", "تحديث إعدادات جهاز شبكة تجريبي", "d2", "u5", "received", "normal", 3, "u9"),
  demoTask("t7", "إعداد تصور لتحسين خدمة داخلية", "d1", "u4", "new", "normal", 1, "u8"),
  demoTask("t8", "متابعة عطل تجريبي بانتظار إجراء خارجي", "d3", "u6", "blocked", "urgent", 4, "u10", { delayReason: "سبب تجريبي: بانتظار معلومة إضافية قبل المتابعة." }),
  demoTask("t9", "إعداد تقرير جرد تجريبي", "d4", "u7", "approved", "important", 12, "u11", { completionSummary: "اكتمل المثال وتم اعتماده.", approvedById: "u1", approvedAt: daysAgo(2) }),
  demoTask("t10", "دراسة خيار تقني عام", "d1", "u4", "waiting_info", "important", 6, "u8", { delayReason: "بانتظار معلومات تجريبية لاستكمال الدراسة." }),
  demoTask("t11", "صيانة جهاز طاقة تجريبي", "d3", "u6", "returned", "important", 5, "u10", { delayReason: "أعيد المثال لإضافة توضيح فني." }),
  demoTask("t12", "تحديث مخطط شبكة نموذجية", "d2", "u5", "in_progress", "normal", 2, "u9"),
  demoTask("t13", "اختبار إجراء دعم فني", "d3", "u6", "received", "normal", 1, "u10"),
  demoTask("t14", "تحديث خطة عمل تجريبية", "d4", "u7", "submitted", "important", 7, "u11", { completionSummary: "تم تحديث نموذج الخطة وإرساله للمراجعة." }),
  demoTask("t15", "إعداد ملخص دراسة قصيرة", "d1", "u4", "approved", "normal", 9, "u8", { completionSummary: "اكتمل المثال بنجاح.", approvedById: "u2", approvedAt: daysAgo(1) }),
  demoTask("t16", "تجربة إعداد جهاز اتصال", "d4", "u7", "new", "normal", 0, "u11"),
  demoTask("t17", "توثيق تحديث برمجي تجريبي", "d2", "u5", "in_progress", "important", 4, "u9"),
  demoTask("t18", "تكليف تجريبي مؤرشف", "d1", "u4", "archived", "normal", 30, "u8", { archived: true, archivedById: "u1", archivedAt: daysAgo(10), archiveReason: "مثال أرشيفي للتجربة." }),
];

export const comments: Comment[] = [
  { id: "c1", taskId: "t1", authorId: "u4", type: "update", body: "تم بدء العمل على المثال التجريبي، وسيتم إضافة النتيجة بعد المراجعة.", createdAt: daysAgo(3), attachments: [], mentions: [] },
  { id: "c2", taskId: "t1", authorId: "u1", type: "question", body: "هل يحتاج المثال إلى أي معلومات إضافية؟", createdAt: daysAgo(2), questionStatus: "answered", attachments: [], mentions: ["u4"] },
  { id: "c3", taskId: "t1", parentId: "c2", authorId: "u4", type: "comment", body: "المعلومات الحالية كافية للتجربة.", createdAt: daysAgo(2), attachments: [], mentions: [] },
  { id: "c4", taskId: "t5", authorId: "u1", type: "instruction", body: "يرجى التأكد من اكتمال توثيق المثال قبل الاعتماد.", createdAt: daysAgo(1), isFormalInstruction: true, pinned: true, acknowledgedByUserId: "u5", acknowledgedAt: hoursAgo(18), attachments: [], mentions: ["u5"] },
  { id: "c11", taskId: "t3", authorId: "u10", type: "update", body: "تم تحديد سبب العطل التجريبي وبدأت المعالجة.", createdAt: hoursAgo(5), attachments: [], mentions: [] },
];

export const activity: ActivityEvent[] = [
  { id: "e1", taskId: "t1", type: "task_created", actorId: "u1", createdAt: daysAgo(5), detail: "تم إنشاء تكليف تجريبي." },
  { id: "e2", taskId: "t1", type: "task_acknowledged", actorId: "u4", createdAt: daysAgo(4), detail: "تم تأكيد استلام المثال." },
  { id: "e3", taskId: "t1", type: "update_posted", actorId: "u4", createdAt: daysAgo(3), detail: "تم نشر تحديث تجريبي." },
  { id: "e4", taskId: "t5", type: "task_submitted", actorId: "u5", createdAt: daysAgo(1), detail: "تم إرسال المثال للاعتماد." },
  { id: "e5", taskId: "t9", type: "task_approved", actorId: "u1", createdAt: daysAgo(2), detail: "تم اعتماد وإنهاء المثال." },
  { id: "e6", taskId: "t3", type: "update_posted", actorId: "u10", createdAt: hoursAgo(5), detail: "تم نشر تحديث صيانة تجريبي." },
  { id: "e7", taskId: "t11", type: "task_returned", actorId: "u2", createdAt: daysAgo(1), detail: "أعيد المثال لإضافة توضيح." },
  { id: "e8", taskId: "t14", type: "task_submitted", actorId: "u7", createdAt: hoursAgo(6), detail: "تم إرسال خطة تجريبية للمراجعة." },
  { id: "e9", taskId: "t15", type: "task_approved", actorId: "u2", createdAt: daysAgo(1), detail: "تم اعتماد المثال." },
  { id: "e10", taskId: "t18", type: "task_archived", actorId: "u1", createdAt: daysAgo(10), detail: "تمت أرشفة المثال التجريبي." },
];
