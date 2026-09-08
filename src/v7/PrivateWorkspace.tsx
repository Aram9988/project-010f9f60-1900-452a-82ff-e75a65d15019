import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, CalendarDays, Check, ChevronLeft, Clock3, FileText, NotebookPen, Plus, RotateCcw, Trash2, X } from "lucide-react";

export type PrivateWorkspaceUser = { id: string; label: string };

type Reminder = {
  id: string;
  text: string;
  forWhom: string;
  dueAt?: string;
  createdBy: string;
  createdAt: string;
  completed: boolean;
  completedAt?: string;
};

type Note = {
  id: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type PrivateState = { reminders: Reminder[]; notes: Note[] };
type Tab = "reminders" | "notes";
type ReminderFilter = "all" | "overdue" | "today" | "tomorrow" | "week" | "later" | "nodate";

const STORAGE_KEY = "command-center-private-workspace-v1";
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function loadState(): PrivateState {
  if (typeof window === "undefined") return { reminders: [], notes: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { reminders: [], notes: [] };
    const parsed = JSON.parse(raw) as Partial<PrivateState>;
    return {
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch {
    return { reminders: [], notes: [] };
  }
}

function formatDue(value?: string) {
  if (!value) return "بدون موعد";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "بدون موعد";
  return d.toLocaleString("ar-SY", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDate(value: string) {
  const d = new Date(value);
  return d.toLocaleDateString("ar-SY", { month: "short", day: "numeric" });
}

function startOfDay(value = new Date()) { const d = new Date(value); d.setHours(0, 0, 0, 0); return d; }
function addDays(value: Date, days: number) { const d = new Date(value); d.setDate(d.getDate() + days); return d; }
function isOverdue(r: Reminder, now = new Date()) { return !!r.dueAt && !r.completed && new Date(r.dueAt).getTime() < now.getTime(); }
function matchesFilter(r: Reminder, filter: ReminderFilter, now = new Date()) {
  if (filter === "all") return true;
  if (filter === "nodate") return !r.dueAt;
  if (!r.dueAt) return false;
  const due = new Date(r.dueAt);
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const dayAfterTomorrow = addDays(today, 2);
  const nextWeek = addDays(today, 8);
  if (filter === "overdue") return due.getTime() < now.getTime();
  if (filter === "today") return due >= today && due < tomorrow;
  if (filter === "tomorrow") return due >= tomorrow && due < dayAfterTomorrow;
  if (filter === "week") return due >= today && due < nextWeek;
  if (filter === "later") return due >= nextWeek;
  return true;
}

export default function PrivateWorkspace({ currentUser }: { currentUser: PrivateWorkspaceUser }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("reminders");
  const [state, setState] = useState<PrivateState>(() => loadState());
  const [, tick] = useState(0);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => { const timer = window.setInterval(() => tick((v) => v + 1), 60_000); return () => window.clearInterval(timer); }, []);

  const activeReminders = useMemo(() => state.reminders.filter((r) => !r.completed).sort((a, b) => {
    if (!a.dueAt && !b.dueAt) return b.createdAt.localeCompare(a.createdAt);
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return a.dueAt.localeCompare(b.dueAt);
  }), [state.reminders]);

  const completedCount = state.reminders.filter((r) => r.completed).length;
  const overdueCount = activeReminders.filter((r) => isOverdue(r)).length;

  return <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="فتح مساحتي"
      title="مساحتي"
      className={`fixed bottom-[calc(82px+env(safe-area-inset-bottom))] left-4 z-[70] grid h-14 w-14 place-items-center rounded-full border shadow-2xl backdrop-blur transition hover:scale-105 active:scale-95 md:bottom-[calc(24px+env(safe-area-inset-bottom))] md:left-6 ${overdueCount ? "border-rose-400/40 bg-[#251018]/95 text-rose-200" : "border-cyan-300/25 bg-[#0b1727]/95 text-cyan-200"}`}
    >
      {overdueCount ? <AlertTriangle size={21} /> : <NotebookPen size={21} />}
      {activeReminders.length > 0 && <span className={`absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full border-2 border-[#08111f] px-1 text-[9px] font-black ${overdueCount ? "bg-rose-400 text-white" : "bg-cyan-300 text-slate-950"}`}>{activeReminders.length}</span>}
      <span className="sr-only">مساحتي</span>
    </button>

    {open && <div className="fixed inset-0 z-[100] flex max-w-full justify-end overflow-hidden bg-[#020611]/70 backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
      <section className="h-[100dvh] w-[min(100vw,36rem)] max-w-full overflow-hidden border-r border-white/10 bg-[#081321] shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex h-full min-w-0 flex-col overflow-hidden">
          <header className="sticky top-0 z-20 shrink-0 border-b border-white/8 bg-[#081321]/98 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur sm:px-5 sm:pb-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0 flex-1"><div className="truncate text-[9px] font-bold tracking-[.18em] text-cyan-300/45">PRIVATE WORKSPACE</div><h2 className="mt-1 text-lg font-black">المساحة الخاصة</h2><p className="mt-1 truncate text-[10px] text-slate-600">للمدير وقسم الدراسات فقط · {currentUser.label}</p></div>
              <button type="button" aria-label="إغلاق مساحتي" onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-white/8 bg-black/10 p-1 sm:mt-4"><button type="button" onClick={() => setTab("reminders")} className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[11px] font-bold sm:gap-2 sm:text-xs ${tab === "reminders" ? "bg-cyan-300 text-slate-950" : "text-slate-500"}`}><BellRing size={14} /><span className="truncate">التذكيرات</span>{overdueCount > 0 && <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[8px] text-white">{overdueCount}</span>}</button><button type="button" onClick={() => setTab("notes")} className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[11px] font-bold sm:gap-2 sm:text-xs ${tab === "notes" ? "bg-cyan-300 text-slate-950" : "text-slate-500"}`}><NotebookPen size={14} /><span className="truncate">الملاحظات</span></button></div>
          </header>
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-[max(20px,env(safe-area-inset-bottom))] sm:p-5">{tab === "reminders" ? <Reminders reminders={state.reminders} active={activeReminders} completedCount={completedCount} currentUser={currentUser} onAdd={(reminder) => setState((s) => ({ ...s, reminders: [reminder, ...s.reminders] }))} onComplete={(id) => setState((s) => ({ ...s, reminders: s.reminders.map((r) => r.id === id ? { ...r, completed: true, completedAt: new Date().toISOString() } : r) }))} onRestore={(id) => setState((s) => ({ ...s, reminders: s.reminders.map((r) => r.id === id ? { ...r, completed: false, completedAt: undefined } : r) }))} onDelete={(id) => setState((s) => ({ ...s, reminders: s.reminders.filter((r) => r.id !== id) }))} /> : <Notes notes={state.notes} currentUser={currentUser} onAdd={(note) => setState((s) => ({ ...s, notes: [note, ...s.notes] }))} onUpdate={(id, title, body) => setState((s) => ({ ...s, notes: s.notes.map((n) => n.id === id ? { ...n, title, body, updatedAt: new Date().toISOString() } : n) }))} onDelete={(id) => setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))} />}</div>
        </div>
      </section>
    </div>}
  </>;
}

function Reminders({ reminders, active, completedCount, currentUser, onAdd, onComplete, onRestore, onDelete }: { reminders: Reminder[]; active: Reminder[]; completedCount: number; currentUser: PrivateWorkspaceUser; onAdd: (r: Reminder) => void; onComplete: (id: string) => void; onRestore: (id: string) => void; onDelete: (id: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [filter, setFilter] = useState<ReminderFilter>("all");
  const [text, setText] = useState("");
  const [forWhom, setForWhom] = useState("");
  const [dueAt, setDueAt] = useState("");
  const completed = reminders.filter((r) => r.completed).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const visible = active.filter((r) => matchesFilter(r, filter));
  const overdueCount = active.filter((r) => isOverdue(r)).length;

  function add() {
    if (!text.trim() || !forWhom.trim()) return;
    const now = new Date().toISOString();
    onAdd({ id: uid(), text: text.trim(), forWhom: forWhom.trim(), dueAt: dueAt || undefined, createdBy: currentUser.id, createdAt: now, completed: false });
    setText(""); setForWhom(""); setDueAt(""); setCreating(false);
  }

  return <div className="min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="text-base font-black">التذكيرات</h3><p className="mt-1 text-[10px] leading-5 text-slate-600">المتأخر يتحول للأحمر. استخدم الفلاتر لعرض اليوم أو الأسبوع القادم.</p></div><button type="button" onClick={() => setCreating(true)} className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-cyan-300 px-3 text-[10px] font-black text-slate-950"><Plus size={13} />تذكير جديد</button></div>

    <div className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-1">{([['all','الكل'],['overdue',`متأخر ${overdueCount ? `(${overdueCount})` : ''}`],['today','اليوم'],['tomorrow','غداً'],['week','7 أيام'],['later','لاحقاً'],['nodate','بدون موعد']] as [ReminderFilter,string][]).map(([key,label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`shrink-0 rounded-xl border px-3 py-2 text-[9px] font-black ${filter === key ? key === 'overdue' ? 'border-rose-400/30 bg-rose-400/10 text-rose-200' : 'border-cyan-300/25 bg-cyan-300/8 text-cyan-200' : 'border-white/7 text-slate-600 hover:text-slate-400'}`}>{label}</button>)}</div>

    {creating && <div className="mt-4 max-w-full overflow-hidden rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-3 sm:p-4"><div className="space-y-3"><label className="block min-w-0"><span className="mb-1.5 block text-[9px] font-bold text-slate-500">ذكّرني بـ</span><input autoFocus value={text} onChange={(e) => setText(e.target.value)} className="tech-field min-w-0 max-w-full" placeholder="مثال: متابعة مخطط مدينة المعارض" /></label><label className="block min-w-0"><span className="mb-1.5 block text-[9px] font-bold text-slate-500">إلى / لمن؟</span><input value={forWhom} onChange={(e) => setForWhom(e.target.value)} className="tech-field min-w-0 max-w-full" placeholder="مثال: وسام" /></label><label className="block min-w-0"><span className="mb-1.5 block text-[9px] font-bold text-slate-500">موعد التذكير — اختياري</span><input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="tech-field min-w-0 max-w-full" /></label></div><div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setCreating(false)} className="px-3 text-[10px] font-bold text-slate-500">إلغاء</button><button type="button" disabled={!text.trim() || !forWhom.trim()} onClick={add} className="h-9 rounded-xl bg-cyan-300 px-4 text-[10px] font-black text-slate-950 disabled:opacity-30">إضافة التذكير</button></div></div>}

    <div className="mt-5 max-w-full overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">{visible.length ? <div className="divide-y divide-white/7">{visible.map((r) => { const overdue = isOverdue(r); return <div key={r.id} className={`group flex min-w-0 items-start gap-3 px-3 py-4 sm:px-4 ${overdue ? 'bg-rose-500/[0.075]' : ''}`}><button type="button" onClick={() => onComplete(r.id)} aria-label="إنهاء التذكير" className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-transparent transition ${overdue ? 'border-rose-400/70 hover:bg-rose-400' : 'border-cyan-300/45 hover:bg-cyan-300'} hover:text-slate-950`}><Check size={13} /></button><div className="min-w-0 flex-1"><div className={`break-words text-sm font-bold leading-6 ${overdue ? 'text-rose-100' : 'text-slate-100'}`}>{r.text}</div><div className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] ${overdue ? 'text-rose-300/75' : 'text-slate-600'}`}><span>إلى: <b className={overdue ? 'text-rose-200' : 'text-slate-400'}>{r.forWhom}</b></span><span className="inline-flex items-center gap-1"><Clock3 size={10} />{formatDue(r.dueAt)}</span>{overdue && <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 font-black text-rose-300"><AlertTriangle size={10} />متأخر</span>}</div></div><button type="button" onClick={() => onDelete(r.id)} className="mt-1 shrink-0 text-slate-600 transition hover:text-rose-300 md:opacity-0 md:group-hover:opacity-100"><Trash2 size={13} /></button></div>; })}</div> : <div className="px-5 py-12 text-center"><CalendarDays size={28} className="mx-auto text-slate-700" /><div className="mt-3 text-xs font-bold text-slate-500">لا توجد تذكيرات ضمن هذا العرض</div><div className="mt-1 text-[10px] text-slate-700">جرّب تغيير الفلتر أو أضف تذكيراً جديداً.</div></div>}</div>

    {completedCount > 0 && <div className="mt-4"><button type="button" onClick={() => setShowCompleted((v) => !v)} className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-[10px] font-bold text-slate-600 hover:text-slate-400"><span>المكتملة ({completedCount})</span><ChevronLeft size={13} className={showCompleted ? "-rotate-90" : ""} /></button>{showCompleted && <div className="mt-2 space-y-2">{completed.map((r) => <div key={r.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/6 bg-white/[0.015] px-3 py-3 opacity-65"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><Check size={11} /></span><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-bold line-through text-slate-500">{r.text}</div><div className="mt-0.5 text-[9px] text-slate-700">إلى: {r.forWhom}</div></div><button type="button" onClick={() => onRestore(r.id)} className="shrink-0 text-slate-600 hover:text-cyan-300" title="إعادة"><RotateCcw size={12} /></button><button type="button" onClick={() => onDelete(r.id)} className="shrink-0 text-slate-700 hover:text-rose-300"><Trash2 size={12} /></button></div>)}</div>}</div>}
  </div>;
}

function Notes({ notes, currentUser, onAdd, onUpdate, onDelete }: { notes: Note[]; currentUser: PrivateWorkspaceUser; onAdd: (n: Note) => void; onUpdate: (id: string, title: string, body: string) => void; onDelete: (id: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  function reset() { setCreating(false); setEditingId(null); setTitle(""); setBody(""); }
  function create() { if (!title.trim() && !body.trim()) return; const now = new Date().toISOString(); onAdd({ id: uid(), title: title.trim() || "ملاحظة", body: body.trim(), createdBy: currentUser.id, createdAt: now, updatedAt: now }); reset(); }
  function edit(note: Note) { setCreating(false); setEditingId(note.id); setTitle(note.title); setBody(note.body); }
  function saveEdit() { if (!editingId || (!title.trim() && !body.trim())) return; onUpdate(editingId, title.trim() || "ملاحظة", body.trim()); reset(); }

  return <div className="min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="text-base font-black">الملاحظات</h3><p className="mt-1 text-[10px] leading-5 text-slate-600">ملاحظات حرة غير مرتبطة بأي مشروع أو مهمة.</p></div><button type="button" onClick={() => { reset(); setCreating(true); }} className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-cyan-300 px-3 text-[10px] font-black text-slate-950"><Plus size={13} />ملاحظة جديدة</button></div>
    {(creating || editingId) && <div className="mt-4 max-w-full overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] p-3 sm:p-4"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="min-w-0 max-w-full w-full bg-transparent text-base font-black outline-none placeholder:text-slate-700" placeholder="عنوان الملاحظة" /><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="mt-3 min-w-0 max-w-full w-full resize-none rounded-xl border border-white/7 bg-black/10 p-3 text-sm leading-7 outline-none placeholder:text-slate-700" placeholder="اكتب أي شيء هنا..." /><div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" onClick={reset} className="px-3 text-[10px] font-bold text-slate-500">إلغاء</button><button type="button" onClick={editingId ? saveEdit : create} disabled={!title.trim() && !body.trim()} className="h-9 rounded-xl bg-cyan-300 px-4 text-[10px] font-black text-slate-950 disabled:opacity-30">حفظ</button></div></div>}
    <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">{notes.length ? notes.map((note) => <div key={note.id} role="button" tabIndex={0} onClick={() => edit(note)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') edit(note); }} className="group min-h-40 min-w-0 cursor-pointer overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-right transition hover:border-cyan-300/15 hover:bg-white/[0.04]"><div className="flex items-start justify-between gap-3"><FileText size={15} className="mt-0.5 shrink-0 text-cyan-300/70" /><button type="button" onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} className="text-slate-600 transition hover:text-rose-300 md:opacity-0 md:group-hover:opacity-100"><Trash2 size={13} /></button></div><h4 className="mt-3 line-clamp-2 break-words text-sm font-black leading-6">{note.title}</h4><p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-[11px] leading-6 text-slate-500">{note.body || "ملاحظة بدون نص"}</p><div className="mt-4 text-[9px] text-slate-700">آخر تعديل {formatDate(note.updatedAt)}</div></div>) : <div className="col-span-full py-12 text-center"><NotebookPen size={30} className="mx-auto text-slate-700" /><div className="mt-3 text-xs font-bold text-slate-500">لا توجد ملاحظات بعد</div></div>}</div>
  </div>;
}
