import { useMemo, useState, type ChangeEvent } from "react";
import { Archive, ArchiveRestore, CheckCircle2, ExternalLink, Loader2, MessageSquareText, Paperclip, Pencil, RotateCcw, Save, Send, ShieldCheck, Trash2, UserRound, X } from "lucide-react";
import { priorityMeta, statusMeta, type Assignment, type Priority, type TaskStatus, type UpdateEntry } from "../v2/model";
import { descendants, hasPermission, roleOf, type OrgState, type OrgUser } from "./orgModel";
import { attachmentLabel, openWorkspaceAttachment, parseAttachment, serializeAttachment, uploadWorkspaceAttachment } from "./attachments";

const statusClass: Record<TaskStatus, string> = {
  new: "border-cyan-400/20 bg-cyan-400/8 text-cyan-300",
  active: "border-blue-400/20 bg-blue-400/8 text-blue-300",
  waiting: "border-amber-400/20 bg-amber-400/8 text-amber-300",
  review: "border-violet-400/20 bg-violet-400/8 text-violet-300",
  returned: "border-rose-400/20 bg-rose-400/8 text-rose-300",
  done: "border-emerald-400/20 bg-emerald-400/8 text-emerald-300",
};

export function StatusChip({ status }: { status: TaskStatus }) {
  return <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold ${statusClass[status]}`}>{statusMeta[status].label}</span>;
}

function fmt(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ar-SY", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type Props = {
  item: Assignment;
  allItems: Assignment[];
  org: OrgState;
  currentUser: OrgUser;
  onBack: () => void;
  onOpenItem: (id: string) => void;
  onAssign: (item: Assignment, assigneeId: string) => void;
  onUpdate: (item: Assignment, text: string, status?: TaskStatus, attachment?: string) => void;
  onTransition: (item: Assignment, status: TaskStatus, text: string) => void;
  onEditUpdate: (item: Assignment, updateId: string, text: string) => void;
  onDeleteUpdate: (item: Assignment, updateId: string) => void;
  onArchive: (item: Assignment) => void;
  onRestore: (item: Assignment) => void;
  onDelete: (item: Assignment) => void;
  onReopen: (item: Assignment) => void;
};

type TimelineEntry = {
  update: UpdateEntry;
  sourceItem: Assignment;
  relatedTask?: Assignment;
};

export default function WorkDetail({ item, allItems, org, currentUser, onBack, onOpenItem, onAssign, onUpdate, onTransition, onEditUpdate, onDeleteUpdate, onArchive, onRestore, onDelete, onReopen }: Props) {
  const isProject = item.kind === "project";
  const noun = isProject ? "المشروع" : "المهمة";
  const currentRole = roleOf(org, currentUser);
  const isBranch = currentRole?.key === "branch_head" || currentRole?.name?.trim() === "رئيس الفرع";
  const isDept = currentRole?.key === "department_head" || currentRole?.name?.includes("رئيس قسم") === true;
  const isOffice = currentRole?.key === "office_responsible" || currentRole?.name?.includes("مسؤول مكتب") === true;
  const readOnlyProject = isProject && isOffice;

  const assignee = org.users.find((u) => u.id === item.assigneeId);
  const owner = org.users.find((u) => u.id === item.ownerId);
  const dept = org.departments.find((d) => d.id === item.departmentId);
  const branch = org.users.find((u) => roleOf(org, u)?.key === "branch_head" || roleOf(org, u)?.name?.trim() === "رئيس الفرع");
  const deptHead = dept?.headUserId ? org.users.find((u) => u.id === dept.headUserId) : undefined;
  const assigneeRole = assignee ? roleOf(org, assignee) : undefined;
  const assigneeIsBranch = assigneeRole?.key === "branch_head" || assigneeRole?.name?.trim() === "رئيس الفرع";
  const configuredManager = assignee?.managerId ? org.users.find((u) => u.id === assignee.managerId && u.active) : undefined;
  const approvalTarget = assigneeIsBranch ? undefined : configuredManager ?? deptHead ?? branch;
  const approvalTargetId = approvalTarget?.id;
  const parent = item.parentProjectId ? allItems.find((x) => x.id === item.parentProjectId) : undefined;
  const children = isProject ? allItems.filter((x) => x.kind === "task" && x.parentProjectId === item.id) : [];

  const currentAssigneeId = item.assigneeId ?? item.ownerId;
  const assignedToMe = currentAssigneeId === currentUser.id;
  const acceptedForCurrent = !!currentAssigneeId && item.acceptedAssigneeId === currentAssigneeId;
  const awaitingAcceptance = item.status === "new" || item.status === "returned";
  const assignmentAccepted = !awaitingAcceptance && acceptedForCurrent;
  const parentAssigneeId = parent?.assigneeId ?? parent?.ownerId;
  const parentAccepted = !parent || (!parent.archivedAt && parent.status !== "new" && parent.status !== "returned" && !!parentAssigneeId && parent.acceptedAssigneeId === parentAssigneeId);

  const canAccept = !item.archivedAt && !readOnlyProject && assignedToMe && awaitingAcceptance;
  const canAssignByRole = !readOnlyProject && (hasPermission(org, currentUser, "assign_department_tasks") || hasPermission(org, currentUser, "assign_team_tasks"));
  const canAssign = !item.archivedAt && !isProject && canAssignByRole && assignmentAccepted && parentAccepted;
  const canWork = !item.archivedAt && !readOnlyProject && assignmentAccepted && item.status !== "done" && (assignedToMe || item.ownerId === currentUser.id || canAssignByRole);
  const canSubmitCompletion = assignedToMe && canWork && ["active", "waiting"].includes(item.status) && !!approvalTargetId && approvalTargetId !== currentUser.id;
  const canCloseOwn = assignedToMe && canWork && ["active", "waiting"].includes(item.status) && !approvalTargetId;
  const canApprove = !readOnlyProject && item.status === "review" && (approvalTargetId === currentUser.id || (!approvalTargetId && isBranch));
  const canLifecycle = isBranch || (!isProject && isDept && item.departmentId === currentUser.departmentId);
  const canReopen = canLifecycle && !item.archivedAt && item.status === "done";
  const visibleDirectUpdates = readOnlyProject ? item.updates.filter((u) => u.authorId === branch?.id || u.authorId === deptHead?.id) : item.updates;
  const timeline: TimelineEntry[] = isProject
    ? [
        ...visibleDirectUpdates.map((update) => ({ update, sourceItem: item })),
        ...children.flatMap((child) => child.updates.map((update) => ({ update, sourceItem: child, relatedTask: child }))),
      ].sort((a, b) => a.update.at.localeCompare(b.update.at))
    : visibleDirectUpdates.map((update) => ({ update, sourceItem: item }));

  const assignable = useMemo(() => {
    if (hasPermission(org, currentUser, "assign_department_tasks")) return org.users.filter((u) => u.active);
    if (hasPermission(org, currentUser, "assign_team_tasks")) {
      const ids = new Set([currentUser.id, ...descendants(org, currentUser.id).map((u) => u.id)]);
      return org.users.filter((u) => u.active && ids.has(u.id));
    }
    return [];
  }, [org, currentUser]);

  function reassign(id: string) {
    if (!canAssign || !id || id === item.assigneeId) return;
    onAssign(item, id);
  }

  return <div className="mx-auto max-w-6xl space-y-5">
    <button onClick={onBack} className="text-[11px] font-bold text-slate-500 hover:text-cyan-300">← العودة</button>

    <section className="tech-panel p-5 md:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
            <span className="font-bold text-cyan-300/75">{isProject ? "مشروع" : "مهمة"}</span><span>•</span><span>{dept?.name ?? "بدون قسم"}</span>
            {item.archivedAt && <span className="rounded-lg border border-slate-400/15 bg-slate-400/5 px-2 py-1 font-bold text-slate-400">مؤرشف</span>}
          </div>
          <h1 className="mt-3 text-2xl font-black md:text-[30px]">{item.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <StatusChip status={item.status} />
            <span className="text-[10px] text-slate-600">الأولوية</span><PriorityChip value={item.priority} />
            <span className="text-[10px] text-slate-500">المسند إليه: <b className="text-slate-300">{assignee?.name ?? owner?.name ?? "غير محدد"}</b></span>
          </div>

          {item.status === "new" && !item.archivedAt && <Notice tone="cyan">بانتظار تأكيد الاستلام من {assignee?.name ?? owner?.name ?? "المسؤول"}. لا يمكن توزيع العمل أو إنشاء تسلسل تنفيذي منه قبل الاستلام.</Notice>}
          {item.status === "returned" && !item.archivedAt && <Notice tone="rose">أعيد العمل للتعديل. يجب على {assignee?.name ?? owner?.name ?? "المسؤول"} تأكيد الاستلام مرة أخرى قبل استئناف التنفيذ أو إعادة توزيعه.</Notice>}
          {!isProject && parent && !parentAccepted && <Notice tone="amber">المشروع المرتبط «{parent.title}» لم يتم استلامه بعد أو ينتظر إعادة استلام. لذلك لا يمكن إعادة إسناد هذه المهمة حتى يتم تأكيد استلام المشروع أولاً.</Notice>}
          {readOnlyProject && <Notice tone="indigo">عرض المشروع لمسؤول المكتب للمتابعة فقط. تحديثات المهام المرتبطة تظهر هنا تلقائياً مع اسم المهمة، بينما تبقى إجراءات المشروع نفسه للقراءة فقط.</Notice>}
          {isOffice && !isProject && <Notice tone="emerald">عند إنهاء المهمة اضغط «تم الإنجاز». ستنتقل المهمة إلى بانتظار الموافقة عند رئيس القسم، ولن تصبح منجزة إلا بعد اعتماده لها.</Notice>}
          {item.status === "review" && approvalTarget && <Notice tone="indigo">تم إنجاز العمل من المنفذ وهو الآن بانتظار موافقة {approvalTarget.name}. لا يعتبر العمل منجزاً نهائياً قبل الاعتماد.</Notice>}
        </div>

        <div className="flex flex-wrap gap-2">
          {canAccept && <Primary onClick={() => onTransition(item, "active", item.status === "returned" ? `تم تأكيد استلام ${noun} بعد إعادته للتعديل واستئناف التنفيذ.` : `تم استلام ${noun} وبدء التنفيذ.`)}>تأكيد الاستلام وبدء التنفيذ</Primary>}
          {canSubmitCompletion && <Primary onClick={() => onTransition(item, "review", `تم إنجاز ${noun} وإرساله إلى ${approvalTarget?.name ?? "المسؤول الأعلى"} للموافقة.`)}><CheckCircle2 size={14} />تم الإنجاز</Primary>}
          {canCloseOwn && <Primary onClick={() => onTransition(item, "done", `تم إنهاء ${noun} واعتماده.`)}><CheckCircle2 size={14} />إنهاء واعتماد</Primary>}
          {canApprove && !item.archivedAt && <Primary onClick={() => onTransition(item, "done", `تمت الموافقة على إنجاز ${noun} وإغلاقه كمنجز.`)}><CheckCircle2 size={14} />موافقة وإغلاق كمنجز</Primary>}
          {canApprove && !item.archivedAt && <button onClick={() => onTransition(item, "returned", `أعيد ${noun} للتعديل وبانتظار تأكيد الاستلام من المسؤول.`)} className="h-10 rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 text-[11px] font-bold text-rose-300">إعادة للتعديل</button>}
          {canReopen && <button onClick={() => onReopen(item)} className="flex h-10 items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-300/5 px-3 text-[11px] font-bold text-emerald-300"><RotateCcw size={13} />إعادة تفعيل</button>}
          {canLifecycle && item.archivedAt && <button onClick={() => onRestore(item)} className="flex h-10 items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-300/5 px-3 text-[11px] font-bold text-cyan-300"><ArchiveRestore size={13} />استعادة من الأرشيف</button>}
          {canLifecycle && !item.archivedAt && <button onClick={() => onArchive(item)} className="flex h-10 items-center gap-2 rounded-xl border border-slate-300/12 bg-slate-300/5 px-3 text-[11px] font-bold text-slate-300"><Archive size={13} />أرشفة</button>}
          {canLifecycle && <button onClick={() => onDelete(item)} className="flex h-10 items-center gap-2 rounded-xl border border-rose-400/18 bg-rose-400/5 px-3 text-[11px] font-bold text-rose-300"><Trash2 size={13} />حذف</button>}
        </div>
      </div>

      <div className="mt-6 grid gap-3 border-t border-white/7 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="الموقع" value={item.location || "غير محدد"} /><Info label="المرجع" value={item.referenceNumber || "غير محدد"} /><Info label="المسؤول الإداري" value={owner?.name || "غير محدد"} /><Info label="آخر تحديث" value={fmt(item.updatedAt)} />
      </div>

      {canAssign && <div className="mt-5 rounded-2xl border border-white/7 bg-black/10 p-4">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold text-slate-500"><UserRound size={13} />إسناد المهمة</div>
        <select value={item.assigneeId ?? ""} onChange={(e) => reassign(e.target.value)} className="tech-field max-w-md"><option value="">اختر الشخص</option>{assignable.map((u) => <option key={u.id} value={u.id}>{u.name} — {roleOf(org, u)?.name ?? ""}</option>)}</select>
        <p className="mt-2 text-[9px] leading-5 text-slate-600">لا يصبح الإسناد متاحاً إلا بعد استلام العمل الحالي واستلام المشروع المرتبط إن وجد.</p>
      </div>}

      {parent && <button onClick={() => onOpenItem(parent.id)} className="mt-5 w-full rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4 text-right"><div className="text-[9px] text-slate-600">تابعة للمشروع</div><div className="mt-1 text-xs font-bold">{parent.title}</div></button>}
      {item.details && <div className="mt-5 border-t border-white/7 pt-5"><div className="text-[10px] font-bold text-slate-600">التفاصيل</div><p className="mt-2 text-sm leading-7 text-slate-400">{item.details}</p></div>}
    </section>

    {isProject && <section className="tech-panel overflow-hidden">
      <div className="border-b border-white/7 px-5 py-4"><h2 className="text-sm font-black">مهام المشروع</h2>{awaitingAcceptance && <p className="mt-1 text-[9px] text-amber-300/70">يجب تأكيد استلام المشروع قبل توزيع أو تشغيل مهامه.</p>}</div>
      <div className="divide-y divide-white/7">{children.length ? children.map((child) => <button key={child.id} onClick={() => onOpenItem(child.id)} className="flex w-full items-center gap-3 px-5 py-4 text-right hover:bg-white/[0.03]"><span className="min-w-0 flex-1 truncate text-sm font-bold">{child.title}</span><span className="text-[10px] text-slate-600">{org.users.find((u) => u.id === child.assigneeId)?.name ?? "غير مسندة"}</span><StatusChip status={child.status} /></button>) : <div className="p-8 text-center text-xs text-slate-600">لا توجد مهام مرتبطة.</div>}</div>
    </section>}

    <section className="tech-panel p-5 md:p-6">
      <div className="flex items-end justify-between"><div><h2 className="text-base font-black">سجل العمل</h2><p className="mt-1 text-[11px] text-slate-500">{isProject ? "سجل موحد للمشروع وجميع مهامه المرتبطة. أي تحديث أو قرار أو مرفق على مهمة يظهر هنا تلقائياً مع اسم المهمة المصدر." : "التحديثات والقرارات والمرفقات. يمكن لكل مستخدم تعديل أو حذف تحديثاته الخاصة فقط."}</p></div><span className="text-[10px] text-slate-600">{timeline.length} تحديث</span></div>
      <div className="mt-6 space-y-4">{timeline.map(({ update, sourceItem, relatedTask }) => {
        const ownsUpdate = !update.system && update.authorId === currentUser.id;
        const canEditSourceUpdate = ownsUpdate && (!readOnlyProject || Boolean(relatedTask));
        return <UpdateCard key={`${sourceItem.id}-${update.id}`} update={update} org={org} currentUser={currentUser} item={sourceItem} relatedTask={relatedTask} onOpenItem={onOpenItem} canEdit={canEditSourceUpdate} canDelete={canEditSourceUpdate} onEditUpdate={onEditUpdate} onDeleteUpdate={onDeleteUpdate} />;
      })}</div>
      {readOnlyProject ? <div className="mt-6 rounded-xl border border-white/7 bg-black/10 p-3 text-[10px] text-slate-500">المشروع نفسه للقراءة فقط، لكن تحديثات المهام المرتبطة تظهر ضمن السجل الموحد ويمكن لصاحب التحديث تعديل تحديثه من هنا.</div> : item.archivedAt ? <div className="mt-6 text-[10px] text-slate-500">العمل مؤرشف.</div> : <Composer item={item} currentUser={currentUser} onUpdate={onUpdate} />}
    </section>
  </div>;
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "cyan" | "rose" | "indigo" | "emerald" | "amber" }) {
  const classes = tone === "rose" ? "border-rose-300/15 bg-rose-300/[0.04] text-rose-200" : tone === "indigo" ? "border-indigo-300/12 bg-indigo-300/[0.035] text-indigo-200" : tone === "emerald" ? "border-emerald-300/12 bg-emerald-300/[0.035] text-emerald-200" : tone === "amber" ? "border-amber-300/15 bg-amber-300/[0.04] text-amber-200" : "border-cyan-300/12 bg-cyan-300/[0.035] text-cyan-200";
  return <div className={`mt-4 rounded-xl border px-3 py-2 text-[10px] font-bold leading-5 ${classes}`}>{children}</div>;
}

function UpdateCard({ update, org, currentUser, item, relatedTask, onOpenItem, canEdit, canDelete, onEditUpdate, onDeleteUpdate }: { update: UpdateEntry; org: OrgState; currentUser: OrgUser; item: Assignment; relatedTask?: Assignment; onOpenItem: (id: string) => void; canEdit: boolean; canDelete: boolean; onEditUpdate: (item: Assignment, updateId: string, text: string) => void; onDeleteUpdate: (item: Assignment, updateId: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(update.text);
  const [opening, setOpening] = useState(false);
  const [attachmentError, setAttachmentError] = useState(false);
  const attachment = parseAttachment(update.attachment);

  function save() {
    const next = text.trim();
    if (next && next !== update.text) onEditUpdate(item, update.id, next);
    setEditing(false);
  }
  async function openAttachment() {
    if (!attachment || opening) return;
    setOpening(true); setAttachmentError(false);
    try { await openWorkspaceAttachment(attachment); } catch { setAttachmentError(true); }
    finally { setOpening(false); }
  }

  return <div className="flex gap-3">
    <span className={`mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full ${update.system ? "bg-slate-700" : "bg-cyan-400 text-slate-950"}`}>{update.system ? <ShieldCheck size={11} /> : <MessageSquareText size={11} />}</span>
    <div className="min-w-0 flex-1 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3">
      {relatedTask && <button type="button" onClick={() => onOpenItem(relatedTask.id)} className="mb-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-indigo-300/15 bg-indigo-300/[0.045] px-3 py-2 text-right text-[9px] font-bold text-indigo-200 hover:border-indigo-300/30"><span className="shrink-0 text-indigo-300/65">تحديث من المهمة</span><span className="truncate">{relatedTask.title}</span><ExternalLink size={10} className="shrink-0" /></button>}
      <div className="flex justify-between gap-3">
        <span className="text-[11px] font-bold">{update.system ? "النظام" : org.users.find((x) => x.id === update.authorId)?.name ?? "مستخدم"}</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-slate-600">{fmt(update.at)}</span>
          {canEdit && !editing && <button type="button" title="تعديل التحديث" aria-label="تعديل التحديث" onClick={() => setEditing(true)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-cyan-300/8 hover:text-cyan-300"><Pencil size={11} /></button>}
          {canDelete && !editing && <button type="button" title="حذف التحديث" aria-label="حذف التحديث" onClick={() => onDeleteUpdate(item, update.id)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 hover:bg-rose-400/8 hover:text-rose-300"><Trash2 size={11} /></button>}
        </div>
      </div>
      {editing ? <div className="mt-3"><textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className="tech-field resize-none" /><div className="mt-2 flex justify-end gap-2"><button onClick={() => { setEditing(false); setText(update.text); }}><X size={11} /></button><button onClick={save} className="flex items-center gap-1 rounded-lg bg-cyan-300 px-3 py-2 text-[9px] font-black text-slate-950"><Save size={11} />حفظ</button></div></div> : <p className="mt-2 text-sm leading-7 text-slate-300">{update.text}</p>}
      {update.attachment && <div className="mt-3">
        {attachment ? <button type="button" disabled={opening} onClick={openAttachment} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2 text-[10px] font-bold text-cyan-200 hover:border-cyan-300/30 disabled:opacity-50">{opening ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}{attachmentLabel(update.attachment)}<ExternalLink size={11} /></button> : <span className="inline-flex items-center gap-1 rounded-lg border border-white/7 px-2 py-1 text-[9px] text-slate-500"><Paperclip size={10} />{attachmentLabel(update.attachment)} <span className="text-slate-700">— مرفق قديم غير مخزن مركزياً</span></span>}
        {attachmentError && <div className="mt-2 text-[9px] font-bold text-rose-300">تعذر فتح المرفق. تحقق من اتصال الجهاز بقاعدة البيانات ثم حاول مجدداً.</div>}
      </div>}
      {update.editedAt && <div className="mt-2 text-[8px] text-slate-600">آخر تعديل: {fmt(update.editedAt)} بواسطة {org.users.find((x) => x.id === update.editedById)?.name ?? currentUser.name}</div>}
    </div>
  </div>;
}

function PriorityChip({ value }: { value: Priority }) {
  return <span className={`text-[10px] font-bold ${value === "urgent" ? "text-rose-300" : value === "important" ? "text-amber-300" : "text-slate-400"}`}>{priorityMeta[value]}</span>;
}
function Info({ label, value }: { label: string; value: string }) { return <div><div className="text-[9px] text-slate-600">{label}</div><div className="mt-1 text-[11px] font-bold text-slate-300">{value}</div></div>; }
function Primary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className="flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-3.5 text-[11px] font-black text-slate-950">{children}</button>; }

function Composer({ item, currentUser, onUpdate }: { item: Assignment; currentUser: OrgUser; onUpdate: (item: Assignment, text: string, status?: TaskStatus, attachment?: string) => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (item.status === "done") return <div className="mt-6 rounded-xl border border-emerald-300/12 bg-emerald-300/5 p-3 text-[11px] font-bold text-emerald-300">العمل مكتمل.</div>;

  function pick(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setError("");
  }

  async function submit() {
    if (sending || (!text.trim() && !file) || error) return;
    setSending(true); setError("");
    try {
      let attachment: string | undefined;
      if (file) {
        const uploaded = await uploadWorkspaceAttachment(file);
        attachment = serializeAttachment(uploaded);
      }
      onUpdate(item, text.trim() || "تم إرفاق ملف جديد.", undefined, attachment);
      setText(""); setFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "upload_failed";
      setError(message === "workspace_not_connected" ? "يجب ربط الجهاز بمساحة العمل المشتركة قبل رفع المرفقات." : "فشل رفع المرفق. تحقق من الاتصال وحاول مرة أخرى.");
    } finally { setSending(false); }
  }

  return <div className="mt-6 rounded-2xl border border-white/8 bg-black/10 p-3">
    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={`أضف تحديثاً باسم ${currentUser.name}...`} className="w-full resize-none bg-transparent p-2 text-sm outline-none" />
    <div className="flex flex-col gap-2 border-t border-white/7 pt-3 sm:flex-row">
      <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-white/8 px-3 py-2 text-[10px] text-slate-500"><Paperclip size={13} className="shrink-0" /><span className="truncate">{file?.name || "إرفاق ملف"}</span><input type="file" className="hidden" onChange={pick} /></label>
      {file && <button type="button" onClick={() => setFile(null)} className="rounded-xl border border-white/7 px-3 py-2 text-[9px] text-slate-500">إزالة المرفق</button>}
      <button type="button" disabled={sending || !!error || (!text.trim() && !file)} onClick={submit} className="mr-auto flex h-9 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-[10px] font-black text-slate-950 disabled:opacity-40">{sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}{sending ? "جارٍ رفع الملف..." : "إرسال التحديث"}</button>
    </div>
    {error && <div className="mt-2 text-[9px] font-bold text-rose-300">{error}</div>}
    <div className="mt-2 text-[8px] leading-4 text-slate-700">PDF والصور وبقية أنواع الملفات مدعومة. الملفات الكبيرة ترفع على أجزاء قابلة للاستئناف إلى التخزين المشترك.</div>
  </div>;
}
