import { useMemo, useState, type ChangeEvent } from "react";
import { BriefcaseBusiness, CheckCircle2, FileText, Link2, MapPin, MessageSquareText, Paperclip, Plus, Send, ShieldCheck, UserRound } from "lucide-react";
import { departments, priorityMeta, statusMeta, users, type Assignment, type DemoUser, type Priority, type TaskStatus } from "../v2/model";

function fmt(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ar-SY", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function deptName(id: string) { return departments.find((d) => d.id === id)?.name ?? "قسم غير محدد"; }
function userName(id?: string) { return users.find((u) => u.id === id)?.name ?? "غير محدد"; }

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

export default function OperationalDetail({ item, allItems, currentUser, onBack, onOpenItem, onCreateTask, onUpdate, onTransition }: { item: Assignment; allItems: Assignment[]; currentUser: DemoUser; onBack: () => void; onOpenItem: (id: string) => void; onCreateTask: (projectId: string) => void; onUpdate: (item: Assignment, text: string, status?: TaskStatus, attachment?: string) => void; onTransition: (item: Assignment, status: TaskStatus, text: string) => void }) {
  const isProject = item.kind === "project";
  const noun = isProject ? "المشروع" : "المهمة";
  const canWork = currentUser.role !== "boss" && currentUser.departmentId === item.departmentId;
  const bossCanFinish = currentUser.role === "boss" && item.status !== "done";
  const parent = !isProject && item.parentProjectId ? allItems.find((x) => x.id === item.parentProjectId) : undefined;
  const children = useMemo(() => isProject ? allItems.filter((x) => x.kind === "task" && x.parentProjectId === item.id) : [], [allItems, isProject, item.id]);
  const attachments = item.updates.filter((u) => u.attachment);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <button type="button" onClick={onBack} className="text-[11px] font-bold text-slate-500 hover:text-cyan-300">← العودة</button>

      <section className="tech-panel overflow-hidden">
        <div className="p-5 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                <span className="font-bold text-cyan-300/75">{isProject ? "مشروع" : "مهمة"}</span>
                <span>•</span><span>{deptName(item.departmentId)}</span>
                {item.location && <><span>•</span><span>{item.location}</span></>}
              </div>
              <h1 className="mt-3 text-2xl font-black leading-tight text-white md:text-[30px]">{item.title}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <StatusChip status={item.status} />
                <span className="text-[10px] text-slate-600">الأولوية</span>
                <span className={`text-[10px] font-bold ${item.priority === "urgent" ? "text-rose-300" : item.priority === "important" ? "text-amber-300" : "text-slate-400"}`}>{priorityMeta[item.priority]}</span>
                <span className="hidden h-4 w-px bg-white/8 sm:block" />
                <span className="text-[10px] text-slate-500">المسؤول: <b className="text-slate-300">{userName(item.ownerId)}</b></span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {isProject && currentUser.role === "boss" && <button type="button" onClick={() => onCreateTask(item.id)} className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 text-[11px] font-bold text-slate-200"><Plus size={14} />إضافة مهمة</button>}
              {canWork && item.status === "new" && <Primary onClick={() => onTransition(item, "active", `تم تأكيد استلام ${noun} وبدء التنفيذ.`)}>تأكيد الاستلام</Primary>}
              {canWork && ["active", "waiting", "returned"].includes(item.status) && <Primary onClick={() => onTransition(item, "review", `تم إنجاز العمل على ${noun} وإرساله للاعتماد.`)}>إرسال للاعتماد</Primary>}
              {bossCanFinish && <Primary onClick={() => onTransition(item, "done", item.status === "review" ? `تم اعتماد ${noun} وإنهاؤه.` : `تم إنهاء ${noun} واعتماده مباشرة من الإدارة.`)}><CheckCircle2 size={14} />{item.status === "review" ? "اعتماد وإنهاء" : "إنهاء"}</Primary>}
              {currentUser.role === "boss" && item.status === "review" && <button type="button" onClick={() => onTransition(item, "returned", `أعيد ${noun} للتعديل والمتابعة.`)} className="h-10 rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 text-[11px] font-bold text-rose-300">إعادة للتعديل</button>}
            </div>
          </div>

          <div className="mt-6 grid gap-3 border-t border-white/7 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <Info icon={<MapPin size={14} />} label="الموقع" value={item.location || "غير محدد"} />
            <Info icon={<FileText size={14} />} label="المرجع / رقم الكتاب" value={item.referenceNumber || "غير محدد"} />
            <Info icon={<UserRound size={14} />} label="المسؤول" value={userName(item.ownerId)} />
            <Info icon={<Link2 size={14} />} label="آخر تحديث" value={fmt(item.updatedAt)} />
          </div>

          {parent && <button type="button" onClick={() => onOpenItem(parent.id)} className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4 text-right hover:bg-cyan-300/[0.06]"><BriefcaseBusiness size={16} className="text-cyan-300" /><div><div className="text-[9px] text-slate-600">تابعة للمشروع</div><div className="mt-1 text-xs font-bold text-slate-200">{parent.title}</div></div></button>}

          {item.details && <div className="mt-5 border-t border-white/7 pt-5"><div className="text-[10px] font-bold text-slate-600">التفاصيل</div><p className="mt-2 text-sm leading-7 text-slate-400">{item.details}</p></div>}
        </div>
      </section>

      {isProject && <section className="tech-panel overflow-hidden"><div className="flex items-center justify-between border-b border-white/7 px-5 py-4"><div><h2 className="text-sm font-black">مهام المشروع</h2><p className="mt-1 text-[10px] text-slate-600">المهام التنفيذية المرتبطة بهذا المشروع.</p></div><span className="text-[10px] font-bold text-slate-500">{children.length}</span></div><div className="divide-y divide-white/7">{children.length ? children.map((child) => <button key={child.id} type="button" onClick={() => onOpenItem(child.id)} className="flex w-full items-center gap-3 px-5 py-4 text-right hover:bg-white/[0.03]"><span className="min-w-0 flex-1 truncate text-sm font-bold">{child.title}</span><StatusChip status={child.status} /></button>) : <div className="p-8 text-center text-xs text-slate-600">لا توجد مهام مرتبطة بهذا المشروع بعد.</div>}</div></section>}

      {attachments.length > 0 && <section className="tech-panel p-5"><h2 className="text-sm font-black">المرفقات</h2><div className="mt-4 flex flex-wrap gap-2">{attachments.map((u) => <span key={u.id} className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-[10px] text-slate-400"><Paperclip size={12} />{u.attachment}</span>)}</div></section>}

      <section className="tech-panel p-5 md:p-6">
        <div className="flex items-end justify-between"><div><h2 className="text-base font-black">سجل العمل</h2><p className="mt-1 text-[11px] text-slate-500">جميع التحديثات والقرارات مرتبة زمنياً.</p></div><span className="text-[10px] text-slate-600">{item.updates.length} تحديث</span></div>
        <div className="relative mt-6 space-y-4 before:absolute before:right-[14px] before:top-4 before:h-[calc(100%-32px)] before:w-px before:bg-white/8">
          {item.updates.map((u) => <div key={u.id} className="relative flex gap-4"><div className={`relative z-10 mt-2 grid h-7 w-7 shrink-0 place-items-center rounded-full border-4 border-[#0b1524] ${u.system ? "bg-slate-700 text-slate-300" : "bg-cyan-400 text-slate-950"}`}>{u.system ? <ShieldCheck size={11} /> : <MessageSquareText size={11} />}</div><div className="min-w-0 flex-1 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3.5"><div className="flex justify-between gap-2"><span className="text-[11px] font-bold text-slate-300">{u.system ? "النظام" : userName(u.authorId)}</span><span className="text-[9px] text-slate-600">{fmt(u.at)}</span></div><p className="mt-2 text-sm leading-7 text-slate-300">{u.text}</p>{(u.status || u.attachment) && <div className="mt-3 flex flex-wrap gap-2">{u.status && <StatusChip status={u.status} />}{u.attachment && <span className="inline-flex items-center gap-1 rounded-lg border border-white/8 px-2 py-1 text-[9px] text-slate-500"><Paperclip size={10} />{u.attachment}</span>}</div>}</div></div>)}
        </div>
        <Composer item={item} user={currentUser} noun={noun} onUpdate={onUpdate} />
      </section>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex gap-3"><span className="mt-0.5 text-slate-600">{icon}</span><div><div className="text-[9px] text-slate-600">{label}</div><div className="mt-1 text-[11px] font-bold text-slate-300">{value}</div></div></div>; }
function Primary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className="flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-3.5 text-[11px] font-black text-slate-950">{children}</button>; }

function Composer({ item, user, noun, onUpdate }: { item: Assignment; user: DemoUser; noun: string; onUpdate: (item: Assignment, text: string, status?: TaskStatus, attachment?: string) => void }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [file, setFile] = useState("");
  if (item.status === "done") return <div className="mt-6 rounded-xl border border-emerald-300/12 bg-emerald-300/5 p-3.5 text-[11px] font-bold text-emerald-300">تم إكمال {noun} واعتماده.</div>;
  const canStatus = user.role !== "boss" && user.departmentId === item.departmentId;
  function submit() { if (!text.trim() && !file) return; onUpdate(item, text.trim() || "تم إرفاق ملف جديد.", status || undefined, file || undefined); setText(""); setStatus(""); setFile(""); }
  function pick(e: ChangeEvent<HTMLInputElement>) { setFile(e.target.files?.[0]?.name ?? ""); }
  return <div className="mt-6 rounded-2xl border border-white/8 bg-black/10 p-3"><textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="أضف تحديثاً..." className="w-full resize-none bg-transparent p-2 text-sm leading-7 outline-none placeholder:text-slate-600" /><div className="flex flex-col gap-2 border-t border-white/7 pt-3 sm:flex-row sm:items-center"><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/8 px-3 py-2 text-[10px] text-slate-500"><Paperclip size={13} />{file || "إرفاق ملف"}<input type="file" className="hidden" onChange={pick} /></label>{canStatus && <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "")} className="tech-field max-w-44"><option value="">بدون تغيير الحالة</option><option value="active">قيد التنفيذ</option><option value="waiting">بانتظار إجراء</option><option value="review">جاهز للاعتماد</option></select>}<button type="button" onClick={submit} className="mr-auto flex h-9 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-[10px] font-black text-slate-950"><Send size={12} />إرسال التحديث</button></div></div>;
}
