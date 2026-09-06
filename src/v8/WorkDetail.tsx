import { useMemo, useState, type ChangeEvent } from "react";
import { CheckCircle2, MessageSquareText, Paperclip, Send, ShieldCheck, UserRound } from "lucide-react";
import { priorityMeta, statusMeta, type Assignment, type Priority, type TaskStatus } from "../v2/model";
import { descendants, hasPermission, roleOf, type OrgState, type OrgUser } from "./orgModel";

const statusClass: Record<TaskStatus, string> = {
  new: "border-cyan-400/20 bg-cyan-400/8 text-cyan-300",
  active: "border-blue-400/20 bg-blue-400/8 text-blue-300",
  waiting: "border-amber-400/20 bg-amber-400/8 text-amber-300",
  review: "border-violet-400/20 bg-violet-400/8 text-violet-300",
  returned: "border-rose-400/20 bg-rose-400/8 text-rose-300",
  done: "border-emerald-400/20 bg-emerald-400/8 text-emerald-300",
};

export function StatusChip({ status }: { status: TaskStatus }) { return <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold ${statusClass[status]}`}>{statusMeta[status].label}</span>; }
function fmt(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ar-SY", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

export default function WorkDetail({ item, allItems, org, currentUser, onBack, onOpenItem, onAssign, onUpdate, onTransition }: { item: Assignment; allItems: Assignment[]; org: OrgState; currentUser: OrgUser; onBack: () => void; onOpenItem: (id: string) => void; onAssign: (item: Assignment, assigneeId: string) => void; onUpdate: (item: Assignment, text: string, status?: TaskStatus, attachment?: string) => void; onTransition: (item: Assignment, status: TaskStatus, text: string) => void }) {
  const isProject = item.kind === "project";
  const noun = isProject ? "المشروع" : "المهمة";
  const assignee = org.users.find((u) => u.id === item.assigneeId);
  const owner = org.users.find((u) => u.id === item.ownerId);
  const dept = org.departments.find((d) => d.id === item.departmentId);
  const parent = item.parentProjectId ? allItems.find((x) => x.id === item.parentProjectId) : undefined;
  const children = isProject ? allItems.filter((x) => x.kind === "task" && x.parentProjectId === item.id) : [];
  const canApprove = hasPermission(org, currentUser, "approve_work");
  const canAssign = hasPermission(org, currentUser, "assign_department_tasks") || hasPermission(org, currentUser, "assign_team_tasks");
  const canWork = item.status !== "done" && (item.assigneeId === currentUser.id || item.ownerId === currentUser.id || canAssign);

  const assignable = useMemo(() => {
    if (hasPermission(org, currentUser, "assign_department_tasks")) return org.users.filter((u) => u.active);
    if (hasPermission(org, currentUser, "assign_team_tasks")) {
      const ids = new Set([currentUser.id, ...descendants(org, currentUser.id).map((u) => u.id)]);
      return org.users.filter((u) => u.active && ids.has(u.id));
    }
    return [];
  }, [org, currentUser]);

  return <div className="mx-auto max-w-6xl space-y-5"><button onClick={onBack} className="text-[11px] font-bold text-slate-500 hover:text-cyan-300">← العودة</button><section className="tech-panel p-5 md:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500"><span className="font-bold text-cyan-300/75">{isProject ? "مشروع" : "مهمة"}</span><span>•</span><span>{dept?.name ?? "بدون قسم"}</span>{item.location && <><span>•</span><span>{item.location}</span></>}</div><h1 className="mt-3 text-2xl font-black md:text-[30px]">{item.title}</h1><div className="mt-4 flex flex-wrap items-center gap-3"><StatusChip status={item.status} /><span className="text-[10px] text-slate-600">الأولوية</span><PriorityChip value={item.priority} /><span className="hidden h-4 w-px bg-white/8 sm:block" /><span className="text-[10px] text-slate-500">المسند إليه: <b className="text-slate-300">{assignee?.name ?? owner?.name ?? "غير محدد"}</b></span></div></div><div className="flex flex-wrap gap-2">{canWork && item.status === "new" && <Primary onClick={() => onTransition(item, "active", `تم استلام ${noun} وبدء التنفيذ.`)}>تأكيد الاستلام</Primary>}{canWork && ["active", "waiting", "returned"].includes(item.status) && <Primary onClick={() => onTransition(item, "review", `تم إرسال ${noun} للاعتماد.`)}>إرسال للاعتماد</Primary>}{canApprove && item.status !== "done" && <Primary onClick={() => onTransition(item, "done", `تم اعتماد ${noun} وإنهاؤه.`)}><CheckCircle2 size={14} />اعتماد وإنهاء</Primary>}{canApprove && item.status === "review" && <button onClick={() => onTransition(item, "returned", `أعيد ${noun} للتعديل.`)} className="h-10 rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 text-[11px] font-bold text-rose-300">إعادة للتعديل</button>}</div></div>

      <div className="mt-6 grid gap-3 border-t border-white/7 pt-5 sm:grid-cols-2 lg:grid-cols-4"><Info label="الموقع" value={item.location || "غير محدد"} /><Info label="المرجع" value={item.referenceNumber || "غير محدد"} /><Info label="المسؤول الإداري" value={owner?.name || "غير محدد"} /><Info label="آخر تحديث" value={fmt(item.updatedAt)} /></div>

      {canAssign && !isProject && <div className="mt-5 rounded-2xl border border-white/7 bg-black/10 p-4"><div className="mb-2 flex items-center gap-2 text-[10px] font-bold text-slate-500"><UserRound size={13} />إسناد المهمة</div><select value={item.assigneeId ?? ""} onChange={(e) => e.target.value && onAssign(item, e.target.value)} className="tech-field max-w-md"><option value="">اختر الشخص</option>{assignable.map((u) => <option key={u.id} value={u.id}>{u.name} — {roleOf(org, u)?.name ?? ""}</option>)}</select></div>}

      {parent && <button onClick={() => onOpenItem(parent.id)} className="mt-5 w-full rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4 text-right"><div className="text-[9px] text-slate-600">تابعة للمشروع</div><div className="mt-1 text-xs font-bold">{parent.title}</div></button>}
      {item.details && <div className="mt-5 border-t border-white/7 pt-5"><div className="text-[10px] font-bold text-slate-600">التفاصيل</div><p className="mt-2 text-sm leading-7 text-slate-400">{item.details}</p></div>}
    </section>

    {isProject && <section className="tech-panel overflow-hidden"><div className="border-b border-white/7 px-5 py-4"><h2 className="text-sm font-black">مهام المشروع</h2></div><div className="divide-y divide-white/7">{children.length ? children.map((child) => <button key={child.id} onClick={() => onOpenItem(child.id)} className="flex w-full items-center gap-3 px-5 py-4 text-right hover:bg-white/[0.03]"><span className="min-w-0 flex-1 truncate text-sm font-bold">{child.title}</span><span className="text-[10px] text-slate-600">{org.users.find((u) => u.id === child.assigneeId)?.name ?? "غير مسندة"}</span><StatusChip status={child.status} /></button>) : <div className="p-8 text-center text-xs text-slate-600">لا توجد مهام مرتبطة.</div>}</div></section>}

    <section className="tech-panel p-5 md:p-6"><div className="flex items-end justify-between"><div><h2 className="text-base font-black">سجل العمل</h2><p className="mt-1 text-[11px] text-slate-500">التحديثات والقرارات والمرفقات.</p></div><span className="text-[10px] text-slate-600">{item.updates.length} تحديث</span></div><div className="mt-6 space-y-4">{item.updates.map((u) => <div key={u.id} className="flex gap-3"><span className={`mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full ${u.system ? "bg-slate-700" : "bg-cyan-400 text-slate-950"}`}>{u.system ? <ShieldCheck size={11} /> : <MessageSquareText size={11} />}</span><div className="min-w-0 flex-1 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3"><div className="flex justify-between"><span className="text-[11px] font-bold">{u.system ? "النظام" : org.users.find((x) => x.id === u.authorId)?.name ?? "مستخدم"}</span><span className="text-[9px] text-slate-600">{fmt(u.at)}</span></div><p className="mt-2 text-sm leading-7 text-slate-300">{u.text}</p>{u.attachment && <span className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/8 px-2 py-1 text-[9px] text-slate-500"><Paperclip size={10} />{u.attachment}</span>}</div></div>)}</div><Composer item={item} currentUser={currentUser} onUpdate={onUpdate} /></section></div>;
}

function PriorityChip({ value }: { value: Priority }) { return <span className={`text-[10px] font-bold ${value === "urgent" ? "text-rose-300" : value === "important" ? "text-amber-300" : "text-slate-400"}`}>{priorityMeta[value]}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div><div className="text-[9px] text-slate-600">{label}</div><div className="mt-1 text-[11px] font-bold text-slate-300">{value}</div></div>; }
function Primary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className="flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-3.5 text-[11px] font-black text-slate-950">{children}</button>; }

function Composer({ item, currentUser, onUpdate }: { item: Assignment; currentUser: OrgUser; onUpdate: (item: Assignment, text: string, status?: TaskStatus, attachment?: string) => void }) {
  const [text, setText] = useState(""); const [file, setFile] = useState("");
  if (item.status === "done") return <div className="mt-6 rounded-xl border border-emerald-300/12 bg-emerald-300/5 p-3 text-[11px] font-bold text-emerald-300">العمل مكتمل ومعتمد.</div>;
  function pick(e: ChangeEvent<HTMLInputElement>) { setFile(e.target.files?.[0]?.name ?? ""); }
  function submit() { if (!text.trim() && !file) return; onUpdate(item, text.trim() || "تم إرفاق ملف جديد.", undefined, file || undefined); setText(""); setFile(""); }
  return <div className="mt-6 rounded-2xl border border-white/8 bg-black/10 p-3"><textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={`أضف تحديثاً باسم ${currentUser.name}...`} className="w-full resize-none bg-transparent p-2 text-sm outline-none placeholder:text-slate-600" /><div className="flex flex-col gap-2 border-t border-white/7 pt-3 sm:flex-row"><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/8 px-3 py-2 text-[10px] text-slate-500"><Paperclip size={13} />{file || "إرفاق ملف"}<input type="file" className="hidden" onChange={pick} /></label><button onClick={submit} className="mr-auto flex h-9 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-[10px] font-black text-slate-950"><Send size={12} />إرسال التحديث</button></div></div>;
}
