import { useState, type ChangeEvent } from "react";
import { CheckCircle2, MessageSquareText, Paperclip, Send, ShieldCheck } from "lucide-react";
import { departments, priorityMeta, statusMeta, users, type Assignment, type DemoUser, type Priority, type TaskStatus } from "../v2/model";

function fmt(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ar-SY", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function deptName(id: string) { return departments.find((d) => d.id === id)?.name ?? "قسم غير محدد"; }
function userName(id?: string) { return users.find((u) => u.id === id)?.name ?? "مستخدم تجريبي"; }

const statusClass: Record<TaskStatus, string> = {
  new: "border-cyan-400/25 bg-cyan-400/10 text-cyan-300",
  active: "border-blue-400/25 bg-blue-400/10 text-blue-300",
  waiting: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  review: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  returned: "border-rose-400/25 bg-rose-400/10 text-rose-300",
  done: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
};

export function StatusChip({ status }: { status: TaskStatus }) { return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass[status]}`}>{statusMeta[status].label}</span>; }
export function PriorityChip({ value }: { value: Priority }) { return <span className={`rounded-full px-2 py-1 text-[10px] font-black ${value === "urgent" ? "bg-rose-500 text-white" : value === "important" ? "bg-amber-300 text-slate-950" : "bg-white/8 text-slate-300"}`}>{priorityMeta[value]}</span>; }

export default function TaskDetail({ task, currentUser, onBack, onUpdate, onTransition }: { task: Assignment; currentUser: DemoUser; onBack: () => void; onUpdate: (task: Assignment, text: string, status?: TaskStatus, attachment?: string) => void; onTransition: (task: Assignment, status: TaskStatus, text: string) => void }) {
  const canWork = currentUser.role !== "boss" && currentUser.departmentId === task.departmentId;
  const bossCanFinish = currentUser.role === "boss" && task.status !== "done";

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-[11px] font-bold text-slate-500 hover:text-cyan-300">← العودة إلى التكليفات</button>
      <section className="tech-panel p-5 md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2"><span className="rounded-full border border-white/8 px-2.5 py-1 font-mono text-[9px] text-cyan-300/60">{task.number}</span><StatusChip status={task.status} /><PriorityChip value={task.priority} /></div>
            <h1 className="mt-4 text-2xl font-black md:text-3xl">{task.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{task.details || "لا توجد تفاصيل إضافية."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canWork && task.status === "new" && <Primary onClick={() => onTransition(task, "active", "تم تأكيد الاستلام وبدء التنفيذ.")}>تأكيد الاستلام</Primary>}
            {canWork && ["active", "waiting", "returned"].includes(task.status) && <Primary onClick={() => onTransition(task, "review", "تم إنجاز العمل وإرساله للاعتماد.")}>إرسال للاعتماد</Primary>}
            {bossCanFinish && <Primary onClick={() => onTransition(task, "done", task.status === "review" ? "تم الاعتماد وإنهاء التكليف." : "تم إنهاء التكليف واعتماده مباشرة من الإدارة.")}><CheckCircle2 size={15} />{task.status === "review" ? "اعتماد وإنهاء" : "إنهاء التكليف"}</Primary>}
            {currentUser.role === "boss" && task.status === "review" && <button type="button" onClick={() => onTransition(task, "returned", "أعيد التكليف للتعديل والمتابعة.")} className="h-11 rounded-xl border border-rose-400/20 bg-rose-400/8 px-4 text-xs font-black text-rose-300">إعادة للتعديل</button>}
          </div>
        </div>
        <div className="mt-6 grid gap-3 border-t border-white/8 pt-5 sm:grid-cols-2 lg:grid-cols-4"><Meta label="القسم" value={deptName(task.departmentId)} /><Meta label="المسؤول" value={userName(task.ownerId)} /><Meta label="صادر عن" value={userName(task.issuedById)} /><Meta label="آخر تحديث" value={fmt(task.updatedAt)} /></div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="tech-panel p-5 md:p-6">
          <div><h2 className="text-base font-black">سجل المتابعة</h2><p className="mt-1 text-[11px] text-slate-500">التحديثات والقرارات والمرفقات في تسلسل واحد.</p></div>
          <div className="relative mt-6 space-y-5 before:absolute before:right-[15px] before:top-3 before:h-[calc(100%-24px)] before:w-px before:bg-cyan-300/15">
            {task.updates.map((u) => <div key={u.id} className="relative flex gap-4"><div className={`relative z-10 mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border-4 border-[#0b1524] ${u.system ? "bg-slate-600" : "bg-cyan-400 text-slate-950"}`}>{u.system ? <ShieldCheck size={12} /> : <MessageSquareText size={12} />}</div><div className="min-w-0 flex-1 rounded-2xl border border-white/7 bg-white/[0.025] p-4"><div className="flex justify-between gap-3"><span className="text-[11px] font-black">{u.system ? "النظام" : userName(u.authorId)}</span><span className="text-[9px] text-slate-600">{fmt(u.at)}</span></div><p className="mt-2 text-sm leading-7 text-slate-300">{u.text}</p>{u.status && <div className="mt-3"><StatusChip status={u.status} /></div>}{u.attachment && <div className="mt-3 inline-flex items-center gap-1 rounded-lg border border-white/8 px-2 py-1 text-[9px] text-slate-400"><Paperclip size={10} />{u.attachment}</div>}</div></div>)}
          </div>
          <Composer task={task} user={currentUser} onUpdate={onUpdate} />
        </section>
        <aside><div className="rounded-[24px] border border-cyan-300/15 bg-cyan-300/5 p-5"><div className="text-[9px] tracking-widest text-cyan-300/60">CURRENT STATE</div><div className="mt-3 text-xl font-black">{statusMeta[task.status].label}</div><p className="mt-2 text-[10px] text-slate-500">{fmt(task.updatedAt)}</p></div></aside>
      </div>
    </div>
  );
}

function Primary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className="flex h-11 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-black text-slate-950">{children}</button>; }
function Meta({ label, value }: { label: string; value: string }) { return <div><div className="text-[9px] text-slate-600">{label}</div><div className="mt-1 text-[11px] font-black text-slate-300">{value}</div></div>; }

function Composer({ task, user, onUpdate }: { task: Assignment; user: DemoUser; onUpdate: (task: Assignment, text: string, status?: TaskStatus, attachment?: string) => void }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [file, setFile] = useState("");
  if (task.status === "done") return <div className="mt-6 rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-4 text-xs font-bold text-emerald-300">التكليف مكتمل ومعتمد.</div>;
  const canStatus = user.role !== "boss" && user.departmentId === task.departmentId;
  function submit() { if (!text.trim() && !file) return; onUpdate(task, text.trim() || "تم إرفاق ملف جديد.", status || undefined, file || undefined); setText(""); setStatus(""); setFile(""); }
  function pick(e: ChangeEvent<HTMLInputElement>) { setFile(e.target.files?.[0]?.name ?? ""); }
  return <div className="mt-7 rounded-2xl border border-cyan-300/15 bg-black/15 p-3"><textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="أضف تحديثاً على التكليف..." className="w-full resize-none bg-transparent p-2 text-sm outline-none placeholder:text-slate-600" /><div className="flex flex-col gap-2 border-t border-white/7 pt-3 sm:flex-row"><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/8 px-3 py-2 text-[10px] text-slate-400"><Paperclip size={13} />{file || "إرفاق ملف"}<input type="file" className="hidden" onChange={pick} /></label>{canStatus && <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "")} className="tech-field max-w-44"><option value="">بدون تغيير الحالة</option><option value="active">قيد التنفيذ</option><option value="waiting">بانتظار إجراء</option><option value="review">جاهز للاعتماد</option></select>}<button type="button" onClick={submit} className="mr-auto flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-[10px] font-black text-slate-950"><Send size={12} />إرسال التحديث</button></div></div>;
}
