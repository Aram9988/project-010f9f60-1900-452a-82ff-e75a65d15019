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
  new: "border-cyan-400/20 bg-cyan-400/8 text-cyan-300",
  active: "border-blue-400/20 bg-blue-400/8 text-blue-300",
  waiting: "border-amber-400/20 bg-amber-400/8 text-amber-300",
  review: "border-violet-400/20 bg-violet-400/8 text-violet-300",
  returned: "border-rose-400/20 bg-rose-400/8 text-rose-300",
  done: "border-emerald-400/20 bg-emerald-400/8 text-emerald-300",
};

export function StatusChip({ status }: { status: TaskStatus }) {
  return <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold ${statusClass[status]}`}>{statusMeta[status].label}</span>;
}

export function PriorityChip({ value }: { value: Priority }) {
  const cls = value === "urgent" ? "text-rose-300" : value === "important" ? "text-amber-300" : "text-slate-400";
  return <span className={`text-[10px] font-bold ${cls}`}>{priorityMeta[value]}</span>;
}

export default function TaskDetail({ task, currentUser, onBack, onUpdate, onTransition }: { task: Assignment; currentUser: DemoUser; onBack: () => void; onUpdate: (task: Assignment, text: string, status?: TaskStatus, attachment?: string) => void; onTransition: (task: Assignment, status: TaskStatus, text: string) => void }) {
  const canWork = currentUser.role !== "boss" && currentUser.departmentId === task.departmentId;
  const bossCanFinish = currentUser.role === "boss" && task.status !== "done";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <button type="button" onClick={onBack} className="text-[11px] font-bold text-slate-500 transition hover:text-cyan-300">← العودة إلى التكليفات</button>

      <section className="tech-panel overflow-hidden">
        <div className="p-5 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] text-slate-500">
                <span className="font-mono font-bold tracking-wide text-cyan-300/65">{task.number}</span>
                <span className="h-1 w-1 rounded-full bg-slate-700" />
                <span>{deptName(task.departmentId)}</span>
                <span className="h-1 w-1 rounded-full bg-slate-700" />
                <span>آخر تحديث {fmt(task.updatedAt)}</span>
              </div>

              <h1 className="mt-3 text-2xl font-black leading-tight text-white md:text-[30px]">{task.title}</h1>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <StatusChip status={task.status} />
                <span className="text-[10px] text-slate-600">الأولوية</span>
                <PriorityChip value={task.priority} />
                <span className="hidden h-4 w-px bg-white/8 sm:block" />
                <span className="text-[10px] text-slate-500">المسؤول: <span className="font-bold text-slate-300">{userName(task.ownerId)}</span></span>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[300px] lg:justify-end">
              {canWork && task.status === "new" && <Primary onClick={() => onTransition(task, "active", "تم تأكيد الاستلام وبدء التنفيذ.")}>تأكيد الاستلام</Primary>}
              {canWork && ["active", "waiting", "returned"].includes(task.status) && <Primary onClick={() => onTransition(task, "review", "تم إنجاز العمل وإرساله للاعتماد.")}>إرسال للاعتماد</Primary>}
              {bossCanFinish && <Primary onClick={() => onTransition(task, "done", task.status === "review" ? "تم الاعتماد وإنهاء التكليف." : "تم إنهاء التكليف واعتماده مباشرة من الإدارة.")}><CheckCircle2 size={15} />{task.status === "review" ? "اعتماد وإنهاء" : "إنهاء التكليف"}</Primary>}
              {currentUser.role === "boss" && task.status === "review" && <button type="button" onClick={() => onTransition(task, "returned", "أعيد التكليف للتعديل والمتابعة.")} className="h-10 rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 text-[11px] font-bold text-rose-300 transition hover:bg-rose-400/10">إعادة للتعديل</button>}
            </div>
          </div>

          {task.details && (
            <div className="mt-6 border-t border-white/7 pt-5">
              <div className="text-[10px] font-bold text-slate-600">تفاصيل التكليف</div>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">{task.details}</p>
            </div>
          )}
        </div>
      </section>

      <section className="tech-panel p-5 md:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-black">المتابعة</h2>
            <p className="mt-1 text-[11px] text-slate-500">جميع التحديثات والقرارات والمرفقات مرتبة زمنياً.</p>
          </div>
          <div className="text-[10px] text-slate-600">{task.updates.length} تحديث</div>
        </div>

        <div className="relative mt-6 space-y-4 before:absolute before:right-[14px] before:top-4 before:h-[calc(100%-32px)] before:w-px before:bg-white/8">
          {task.updates.map((u) => (
            <div key={u.id} className="relative flex gap-4">
              <div className={`relative z-10 mt-2 grid h-7 w-7 shrink-0 place-items-center rounded-full border-4 border-[#0b1524] ${u.system ? "bg-slate-700 text-slate-300" : "bg-cyan-400 text-slate-950"}`}>
                {u.system ? <ShieldCheck size={11} /> : <MessageSquareText size={11} />}
              </div>
              <div className="min-w-0 flex-1 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-300">{u.system ? "النظام" : userName(u.authorId)}</span>
                  <span className="text-[9px] text-slate-600">{fmt(u.at)}</span>
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-300">{u.text}</p>
                {(u.status || u.attachment) && <div className="mt-3 flex flex-wrap items-center gap-2">{u.status && <StatusChip status={u.status} />}{u.attachment && <span className="inline-flex items-center gap-1 rounded-lg border border-white/8 px-2 py-1 text-[9px] text-slate-500"><Paperclip size={10} />{u.attachment}</span>}</div>}
              </div>
            </div>
          ))}
        </div>

        <Composer task={task} user={currentUser} onUpdate={onUpdate} />
      </section>
    </div>
  );
}

function Primary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-3.5 text-[11px] font-black text-slate-950 transition hover:bg-cyan-200">{children}</button>;
}

function Composer({ task, user, onUpdate }: { task: Assignment; user: DemoUser; onUpdate: (task: Assignment, text: string, status?: TaskStatus, attachment?: string) => void }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [file, setFile] = useState("");

  if (task.status === "done") return <div className="mt-6 rounded-xl border border-emerald-300/12 bg-emerald-300/5 p-3.5 text-[11px] font-bold text-emerald-300">تم إكمال هذا التكليف واعتماده.</div>;

  const canStatus = user.role !== "boss" && user.departmentId === task.departmentId;
  function submit() {
    if (!text.trim() && !file) return;
    onUpdate(task, text.trim() || "تم إرفاق ملف جديد.", status || undefined, file || undefined);
    setText(""); setStatus(""); setFile("");
  }
  function pick(e: ChangeEvent<HTMLInputElement>) { setFile(e.target.files?.[0]?.name ?? ""); }

  return (
    <div className="mt-6 rounded-2xl border border-white/8 bg-black/10 p-3">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="أضف تحديثاً..." className="w-full resize-none bg-transparent p-2 text-sm leading-7 outline-none placeholder:text-slate-600" />
      <div className="flex flex-col gap-2 border-t border-white/7 pt-3 sm:flex-row sm:items-center">
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/8 px-3 py-2 text-[10px] text-slate-500 transition hover:text-slate-300"><Paperclip size={13} />{file || "إرفاق ملف"}<input type="file" className="hidden" onChange={pick} /></label>
        {canStatus && <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "")} className="tech-field max-w-44"><option value="">بدون تغيير الحالة</option><option value="active">قيد التنفيذ</option><option value="waiting">بانتظار إجراء</option><option value="review">جاهز للاعتماد</option></select>}
        <button type="button" onClick={submit} className="mr-auto flex h-9 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-[10px] font-black text-slate-950"><Send size={12} />إرسال التحديث</button>
      </div>
    </div>
  );
}
