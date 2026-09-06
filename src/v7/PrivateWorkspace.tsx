import { useEffect, useMemo, useState } from "react";
import { BellRing, Check, ChevronLeft, Circle, Clock3, FileText, NotebookPen, Plus, RotateCcw, Trash2, X } from "lucide-react";

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

export default function PrivateWorkspace({ currentUser }: { currentUser: PrivateWorkspaceUser }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("reminders");
  const [state, setState] = useState<PrivateState>(() => loadState());

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);

  const activeReminders = useMemo(() => state.reminders.filter((r) => !r.completed).sort((a, b) => {
    if (!a.dueAt && !b.dueAt) return b.createdAt.localeCompare(a.createdAt);
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return a.dueAt.localeCompare(b.dueAt);
  }), [state.reminders]);

  const completedCount = state.reminders.filter((r) => r.completed).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[92px] left-4 z-[55] flex h-12 items-center gap-2 rounded-2xl border border-cyan-300/20 bg-[#0b1727]/95 px-4 text-xs font-black text-cyan-200 shadow-2xl backdrop-blur md:bottom-6 md:left-6"
      >
        <NotebookPen size={16} />
        <span className="hidden sm:inline">مساحتي</span>
        {activeReminders.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-cyan-300 px-1 text-[9px] text-slate-950">{activeReminders.length}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-[#020611]/70 backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
          <section className="h-full w-full max-w-xl overflow-hidden border-r border-white/10 bg-[#081321] shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex h-full flex-col">
              <header className="border-b border-white/8 px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[9px] font-bold tracking-[.18em] text-cyan-300/45">PRIVATE WORKSPACE</div>
                    <h2 className="mt-1 text-lg font-black">المساحة الخاصة</h2>
                    <p className="mt-1 text-[10px] text-slate-600">للمدير وقسم الدراسات فقط · {currentUser.label}</p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/8 text-slate-500 hover:text-white"><X size={16} /></button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/8 bg-black/10 p-1">
                  <button type="button" onClick={() => setTab("reminders")} className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold ${tab === "reminders" ? "bg-cyan-300 text-slate-950" : "text-slate-500"}`}><BellRing size={14} />التذكيرات</button>
                  <button type="button" onClick={() => setTab("notes")} className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold ${tab === "notes" ? "bg-cyan-300 text-slate-950" : "text-slate-500"}`}><NotebookPen size={14} />الملاحظات</button>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {tab === "reminders" ? (
                  <Reminders
                    reminders={state.reminders}
                    active={activeReminders}
                    completedCount={completedCount}
                    currentUser={currentUser}
                    onAdd={(reminder) => setState((s) => ({ ...s, reminders: [reminder, ...s.reminders] }))}
                    onComplete={(id) => setState((s) => ({ ...s, reminders: s.reminders.map((r) => r.id === id ? { ...r, completed: true, completedAt: new Date().toISOString() } : r) }))}
                    onRestore={(id) => setState((s) => ({ ...s, reminders: s.reminders.map((r) => r.id === id ? { ...r, completed: false, completedAt: undefined } : r) }))}
                    onDelete={(id) => setState((s) => ({ ...s, reminders: s.reminders.filter((r) => r.id !== id) }))}
                  />
                ) : (
                  <Notes
                    notes={state.notes}
                    currentUser={currentUser}
                    onAdd={(note) => setState((s) => ({ ...s, notes: [note, ...s.notes] }))}
                    onUpdate={(id, title, body) => setState((s) => ({ ...s, notes: s.notes.map((n) => n.id === id ? { ...n, title, body, updatedAt: new Date().toISOString() } : n) }))}
                    onDelete={(id) => setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))}
                  />
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Reminders({ reminders, active, completedCount, currentUser, onAdd, onComplete, onRestore, onDelete }: { reminders: Reminder[]; active: Reminder[]; completedCount: number; currentUser: PrivateWorkspaceUser; onAdd: (r: Reminder) => void; onComplete: (id: string) => void; onRestore: (id: string) => void; onDelete: (id: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [text, setText] = useState("");
  const [forWhom, setForWhom] = useState("");
  const [dueAt, setDueAt] = useState("");
  const completed = reminders.filter((r) => r.completed).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  function add() {
    if (!text.trim() || !forWhom.trim()) return;
    const now = new Date().toISOString();
    onAdd({ id: uid(), text: text.trim(), forWhom: forWhom.trim(), dueAt: dueAt || undefined, createdBy: currentUser.id, createdAt: now, completed: false });
    setText(""); setForWhom(""); setDueAt(""); setCreating(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-base font-black">التذكيرات</h3><p className="mt-1 text-[10px] text-slate-600">اضغط الدائرة عند الانتهاء ليختفي التذكير.</p></div>
        <button type="button" onClick={() => setCreating(true)} className="flex h-9 items-center gap-2 rounded-xl bg-cyan-300 px-3 text-[10px] font-black text-slate-950"><Plus size={13} />تذكير جديد</button>
      </div>

      {creating && <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-4"><div className="space-y-3"><label className="block"><span className="mb-1.5 block text-[9px] font-bold text-slate-500">ذكّرني بـ</span><input autoFocus value={text} onChange={(e) => setText(e.target.value)} className="tech-field" placeholder="مثال: متابعة مخطط مدينة المعارض" /></label><label className="block"><span className="mb-1.5 block text-[9px] font-bold text-slate-500">إلى / لمن؟</span><input value={forWhom} onChange={(e) => setForWhom(e.target.value)} className="tech-field" placeholder="مثال: وسام" /></label><label className="block"><span className="mb-1.5 block text-[9px] font-bold text-slate-500">موعد التذكير — اختياري</span><input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="tech-field" /></label></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setCreating(false)} className="px-3 text-[10px] font-bold text-slate-500">إلغاء</button><button type="button" disabled={!text.trim() || !forWhom.trim()} onClick={add} className="h-9 rounded-xl bg-cyan-300 px-4 text-[10px] font-black text-slate-950 disabled:opacity-30">إضافة التذكير</button></div></div>}

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
        {active.length ? <div className="divide-y divide-white/7">{active.map((r) => <div key={r.id} className="group flex items-start gap-3 px-4 py-4"><button type="button" onClick={() => onComplete(r.id)} aria-label="إنهاء التذكير" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-cyan-300/45 text-transparent transition hover:border-cyan-300 hover:bg-cyan-300 hover:text-slate-950"><Check size={13} /></button><div className="min-w-0 flex-1"><div className="text-sm font-bold leading-6 text-slate-100">{r.text}</div><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-600"><span>إلى: <b className="text-slate-400">{r.forWhom}</b></span><span className="inline-flex items-center gap-1"><Clock3 size={10} />{formatDue(r.dueAt)}</span></div></div><button type="button" onClick={() => onDelete(r.id)} className="mt-1 opacity-0 text-slate-700 transition group-hover:opacity-100 hover:text-rose-300"><Trash2 size={13} /></button></div>)}</div> : <div className="px-5 py-12 text-center"><Circle size={28} className="mx-auto text-slate-700" /><div className="mt-3 text-xs font-bold text-slate-500">لا توجد تذكيرات حالية</div><div className="mt-1 text-[10px] text-slate-700">كل شيء منجز.</div></div>}
      </div>

      {completedCount > 0 && <div className="mt-4"><button type="button" onClick={() => setShowCompleted((v) => !v)} className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-[10px] font-bold text-slate-600 hover:text-slate-400"><span>المكتملة ({completedCount})</span><ChevronLeft size={13} className={showCompleted ? "-rotate-90" : ""} /></button>{showCompleted && <div className="mt-2 space-y-2">{completed.map((r) => <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.015] px-3 py-3 opacity-65"><span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><Check size={11} /></span><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-bold line-through text-slate-500">{r.text}</div><div className="mt-0.5 text-[9px] text-slate-700">إلى: {r.forWhom}</div></div><button type="button" onClick={() => onRestore(r.id)} className="text-slate-600 hover:text-cyan-300" title="إعادة"><RotateCcw size={12} /></button><button type="button" onClick={() => onDelete(r.id)} className="text-slate-700 hover:text-rose-300"><Trash2 size={12} /></button></div>)}</div>}</div>}
    </div>
  );
}

function Notes({ notes, currentUser, onAdd, onUpdate, onDelete }: { notes: Note[]; currentUser: PrivateWorkspaceUser; onAdd: (n: Note) => void; onUpdate: (id: string, title: string, body: string) => void; onDelete: (id: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  function reset() { setCreating(false); setEditingId(null); setTitle(""); setBody(""); }
  function create() {
    if (!title.trim() && !body.trim()) return;
    const now = new Date().toISOString();
    onAdd({ id: uid(), title: title.trim() || "ملاحظة", body: body.trim(), createdBy: currentUser.id, createdAt: now, updatedAt: now });
    reset();
  }
  function edit(note: Note) { setCreating(false); setEditingId(note.id); setTitle(note.title); setBody(note.body); }
  function saveEdit() { if (!editingId || (!title.trim() && !body.trim())) return; onUpdate(editingId, title.trim() || "ملاحظة", body.trim()); reset(); }

  return (
    <div>
      <div className="flex items-center justify-between gap-3"><div><h3 className="text-base font-black">الملاحظات</h3><p className="mt-1 text-[10px] text-slate-600">ملاحظات حرة غير مرتبطة بأي مشروع أو مهمة.</p></div><button type="button" onClick={() => { reset(); setCreating(true); }} className="flex h-9 items-center gap-2 rounded-xl bg-cyan-300 px-3 text-[10px] font-black text-slate-950"><Plus size={13} />ملاحظة جديدة</button></div>

      {(creating || editingId) && <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-transparent text-base font-black outline-none placeholder:text-slate-700" placeholder="عنوان الملاحظة" /><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="mt-3 w-full resize-none rounded-xl border border-white/7 bg-black/10 p-3 text-sm leading-7 outline-none placeholder:text-slate-700" placeholder="اكتب أي شيء هنا..." /><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={reset} className="px-3 text-[10px] font-bold text-slate-500">إلغاء</button><button type="button" onClick={editingId ? saveEdit : create} disabled={!title.trim() && !body.trim()} className="h-9 rounded-xl bg-cyan-300 px-4 text-[10px] font-black text-slate-950 disabled:opacity-30">حفظ</button></div></div>}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {notes.length ? notes.map((note) => <button key={note.id} type="button" onClick={() => edit(note)} className="group min-h-40 rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-right transition hover:border-cyan-300/15 hover:bg-white/[0.04]"><div className="flex items-start justify-between gap-3"><FileText size={15} className="mt-0.5 shrink-0 text-cyan-300/70" /><button type="button" onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} className="opacity-0 text-slate-700 transition group-hover:opacity-100 hover:text-rose-300"><Trash2 size={13} /></button></div><h4 className="mt-3 line-clamp-2 text-sm font-black leading-6">{note.title}</h4><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[11px] leading-6 text-slate-500">{note.body || "ملاحظة بدون نص"}</p><div className="mt-4 text-[9px] text-slate-700">آخر تعديل {formatDate(note.updatedAt)}</div></button>) : <div className="col-span-full py-12 text-center"><NotebookPen size={30} className="mx-auto text-slate-700" /><div className="mt-3 text-xs font-bold text-slate-500">لا توجد ملاحظات بعد</div></div>}
      </div>
    </div>
  );
}
