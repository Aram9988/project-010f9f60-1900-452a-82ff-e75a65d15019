import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import {
  Activity,
  Bell,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  Gauge,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Paperclip,
  Plus,
  Printer,
  Radar,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import {
  STORAGE_KEY,
  departments,
  makeSeedState,
  priorityMeta,
  statusMeta,
  users,
  type AppState,
  type Assignment,
  type DemoUser,
  type Priority,
  type TaskStatus,
  type UpdateEntry,
  type View,
} from "../v2/model";

type ReportPeriod = "day" | "week" | "month" | "custom";
type ReportType = "activity" | "completed" | "open";

const nowIso = () => new Date().toISOString();
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function loadState(): AppState {
  const seed = makeSeedState();
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      currentUserId: users.some((u) => u.id === parsed.currentUserId) ? parsed.currentUserId! : seed.currentUserId,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map((task) => ({ ...task, details: task.details ?? "", updates: Array.isArray(task.updates) ? task.updates : [], updatedAt: task.updatedAt ?? task.createdAt ?? nowIso() })) : seed.tasks,
      notices: Array.isArray(parsed.notices) ? parsed.notices : seed.notices,
    };
  } catch {
    return seed;
  }
}

function fmt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ar-SY", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function deptName(id: string) { return departments.find((d) => d.id === id)?.name ?? "قسم غير محدد"; }
function userName(id?: string) { return users.find((u) => u.id === id)?.name ?? "مستخدم تجريبي"; }
function visibleTo(user: DemoUser, task: Assignment) { return user.role === "boss" || task.departmentId === user.departmentId; }

function Status({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, string> = {
    new: "border-cyan-400/25 bg-cyan-400/10 text-cyan-300",
    active: "border-blue-400/25 bg-blue-400/10 text-blue-300",
    waiting: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    review: "border-violet-400/25 bg-violet-400/10 text-violet-300",
    returned: "border-rose-400/25 bg-rose-400/10 text-rose-300",
    done: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${map[status]}`}>{statusMeta[status].label}</span>;
}

function Priority({ value }: { value: Priority }) {
  const cls = value === "urgent" ? "bg-rose-500 text-white" : value === "important" ? "bg-amber-300 text-slate-950" : "bg-white/8 text-slate-300";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-black ${cls}`}>{priorityMeta[value]}</span>;
}

export default function ModernCommandCenter() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [view, setView] = useState<View>("overview");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TaskStatus | "all" | "attention">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);

  const currentUser = users.find((u) => u.id === state.currentUserId) ?? users[0];
  const tasks = useMemo(() => state.tasks.filter((t) => visibleTo(currentUser, t)), [state.tasks, currentUser]);
  const selected = taskId ? tasks.find((t) => t.id === taskId) ?? null : null;
  const unread = state.notices.filter((n) => n.userId === currentUser.id && !n.read).length;

  function setUser(id: string) {
    setState((s) => ({ ...s, currentUserId: id }));
    setTaskId(null);
    setUserOpen(false);
  }

  function notify(userId: string, text: string, taskId?: string) {
    setState((s) => ({ ...s, notices: [{ id: uid(), userId, taskId, text, at: nowIso(), read: false }, ...s.notices] }));
  }

  function createTask(input: { title: string; details: string; departmentId: string; priority: Priority }) {
    const at = nowIso();
    const owner = users.find((u) => u.role === "head" && u.departmentId === input.departmentId);
    const task: Assignment = {
      id: uid(),
      number: `TK-${String(3000 + state.tasks.length + 1)}`,
      title: input.title.trim(),
      details: input.details.trim(),
      departmentId: input.departmentId,
      priority: input.priority,
      status: "new",
      createdAt: at,
      updatedAt: at,
      issuedById: currentUser.id,
      ownerId: owner?.id,
      updates: [{ id: uid(), authorId: currentUser.id, text: "تم إصدار التكليف وإحالته إلى القسم المسؤول.", at, system: true }],
    };
    setState((s) => ({ ...s, tasks: [task, ...s.tasks] }));
    users.filter((u) => u.departmentId === input.departmentId).forEach((u) => notify(u.id, `تكليف جديد: ${task.title}`, task.id));
    setCreateOpen(false);
    setView("tasks");
    setTaskId(task.id);
  }

  function updateTask(task: Assignment, text: string, status?: TaskStatus, attachment?: string) {
    const at = nowIso();
    const update: UpdateEntry = { id: uid(), authorId: currentUser.id, text, at, status, attachment };
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => t.id === task.id ? { ...t, status: status ?? t.status, updatedAt: at, updates: [...t.updates, update] } : t) }));
    if (currentUser.role === "boss") users.filter((u) => u.departmentId === task.departmentId).forEach((u) => notify(u.id, `تحديث إداري على ${task.number}`, task.id));
    else notify("boss", `تحديث جديد على ${task.number}`, task.id);
  }

  function transition(task: Assignment, status: TaskStatus, text: string) {
    updateTask(task, text, status);
  }

  return (
    <div className="tech-shell min-h-screen text-slate-100">
      <div className="pointer-events-none fixed inset-0 tech-grid opacity-35" />
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#08111f]/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-[1560px] items-center gap-4 px-4 md:px-7">
          <button onClick={() => setMobileOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 md:hidden"><Menu size={20} /></button>
          <Brand />
          <div className="hidden h-8 w-px bg-white/10 md:block" />
          <div className="hidden flex-1 md:block">
            <div className="relative max-w-xl">
              <Search size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setView("tasks"); }} placeholder="بحث موحد في التكليفات..." className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pr-11 pl-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40 focus:bg-white/7 focus:ring-4 focus:ring-cyan-400/5" />
            </div>
          </div>
          <div className="mr-auto flex items-center gap-2">
            <div className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300"><Bell size={17} />{unread > 0 && <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-cyan-400 px-1 text-[9px] font-black text-slate-950">{unread}</span>}</div>
            <div className="relative">
              <button onClick={() => setUserOpen((v) => !v)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-1.5 pr-2 pl-3 hover:bg-white/8">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-950"><UserRound size={17} /></span>
                <span className="hidden text-right sm:block"><span className="block text-xs font-black">{currentUser.name}</span><span className="block text-[9px] uppercase tracking-widest text-cyan-300/70">{currentUser.title}</span></span>
                <ChevronDown size={14} className="text-slate-500" />
              </button>
              {userOpen && <UserMenu currentUser={currentUser} onChange={setUser} />}
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex max-w-[1560px]">
        <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] w-64 shrink-0 border-l border-white/8 p-5 md:block">
          <Sidebar view={view} currentUser={currentUser} onView={(v) => { setView(v); setTaskId(null); }} onCreate={() => setCreateOpen(true)} />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-7 md:py-8">
          {selected ? <TaskDetail task={selected} currentUser={currentUser} onBack={() => setTaskId(null)} onUpdate={updateTask} onTransition={transition} /> : view === "overview" ? <Overview tasks={tasks} user={currentUser} onOpen={setTaskId} onCreate={() => setCreateOpen(true)} /> : view === "tasks" ? <Tasks tasks={tasks} search={search} filter={filter} onSearch={setSearch} onFilter={setFilter} onOpen={setTaskId} onCreate={() => setCreateOpen(true)} canCreate={currentUser.role === "boss"} /> : <ReportCenter tasks={tasks} user={currentUser} />}
        </main>
      </div>

      <MobileNav view={view} canCreate={currentUser.role === "boss"} onView={(v) => { setView(v); setTaskId(null); }} onCreate={() => setCreateOpen(true)} />
      {mobileOpen && <MobileDrawer view={view} user={currentUser} onClose={() => setMobileOpen(false)} onView={(v) => { setView(v); setTaskId(null); setMobileOpen(false); }} onCreate={() => { setCreateOpen(true); setMobileOpen(false); }} />}
      {createOpen && <CreateDialog onClose={() => setCreateOpen(false)} onCreate={createTask} />}
    </div>
  );
}

function Brand() {
  return <div className="flex shrink-0 items-center gap-3"><div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-[14px] border border-cyan-300/30 bg-cyan-300/10 text-cyan-300"><Radar size={20} /><span className="absolute inset-0 animate-pulse rounded-[14px] ring-1 ring-inset ring-cyan-300/20" /></div><div><div className="text-sm font-black">مركز التكليفات</div><div className="mt-0.5 text-[9px] font-bold tracking-[0.24em] text-cyan-300/60">OPERATIONS COMMAND</div></div></div>;
}

function Sidebar({ view, currentUser, onView, onCreate }: { view: View; currentUser: DemoUser; onView: (v: View) => void; onCreate: () => void }) {
  const items = [
    { id: "overview" as View, label: "لوحة العمليات", icon: Gauge },
    { id: "tasks" as View, label: currentUser.role === "boss" ? "جميع التكليفات" : "تكليفات القسم", icon: ClipboardCheck },
    { id: "reports" as View, label: "التقارير", icon: FileSpreadsheet },
  ];
  return <div className="flex h-full flex-col">{currentUser.role === "boss" && <button onClick={onCreate} className="mb-6 flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-cyan-400 to-indigo-500 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30"><Plus size={17} /> إصدار تكليف</button>}<nav className="space-y-2">{items.map((item) => <button key={item.id} onClick={() => onView(item.id)} className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition ${view === item.id ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-200" : "border-transparent text-slate-400 hover:border-white/8 hover:bg-white/5 hover:text-white"}`}><item.icon size={18} />{item.label}{view === item.id && <span className="mr-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,.8)]" />}</button>)}</nav><div className="mt-auto rounded-2xl border border-white/8 bg-white/[0.035] p-4"><div className="flex items-center gap-2 text-[11px] font-black text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.7)]" />SYSTEM ONLINE</div><p className="mt-2 text-[10px] leading-5 text-slate-500">نسخة تجريبية محلية. لا تستخدم بيانات تشغيلية حقيقية.</p></div></div>;
}

function Overview({ tasks, user, onOpen, onCreate }: { tasks: Assignment[]; user: DemoUser; onOpen: (id: string) => void; onCreate: () => void }) {
  const counts = { new: tasks.filter((t) => t.status === "new").length, active: tasks.filter((t) => t.status === "active").length, review: tasks.filter((t) => t.status === "review").length, attention: tasks.filter((t) => ["waiting", "returned"].includes(t.status)).length };
  const recent = [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 7);
  const attention = tasks.filter((t) => ["waiting", "returned"].includes(t.status)).slice(0, 4);
  return <div className="space-y-6"><section className="tech-panel relative overflow-hidden p-6 md:p-8"><div className="absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(34,211,238,.09),transparent_70%)]" /><div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-[10px] font-black text-cyan-300"><Activity size={12} />LIVE OPERATIONS</div><h1 className="text-2xl font-black md:text-4xl">لوحة المتابعة التنفيذية</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">صورة مباشرة عن التكليفات الجديدة، العمل الجاري، وما يحتاج قراراً أو اعتماداً من الإدارة.</p></div>{user.role === "boss" && <button onClick={onCreate} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-50"><Zap size={17} /> إصدار تكليف جديد</button>}</div></section><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="جديد" value={counts.new} icon={<Inbox size={19} />} accent="cyan" /><Metric label="قيد التنفيذ" value={counts.active} icon={<Activity size={19} />} accent="blue" /><Metric label="بانتظار الاعتماد" value={counts.review} icon={<ClipboardCheck size={19} />} accent="violet" /><Metric label="تحتاج متابعة" value={counts.attention} icon={<MessageSquareText size={19} />} accent="amber" /></div><div className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]"><section className="tech-panel p-5 md:p-6"><Title title="آخر النشاط" subtitle="آخر التكليفات التي تم تحديثها ضمن نطاقك" /><div className="mt-4 divide-y divide-white/7">{recent.map((task) => <TaskStrip key={task.id} task={task} onOpen={onOpen} />)}</div></section><section className="tech-panel p-5 md:p-6"><Title title="تحتاج تدخل" subtitle="حالات متوقفة أو معادة للتعديل" /><div className="mt-4 space-y-3">{attention.length ? attention.map((task) => <button key={task.id} onClick={() => onOpen(task.id)} className="w-full rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] p-4 text-right hover:border-amber-300/30"><div className="flex items-center justify-between"><span className="text-[9px] font-mono text-slate-500">{task.number}</span><Status status={task.status} /></div><div className="mt-2 text-sm font-black leading-6">{task.title}</div><div className="mt-2 text-[10px] text-slate-500">{deptName(task.departmentId)}</div></button>) : <Empty text="لا توجد حالات تحتاج تدخلاً حالياً." />}</div></section></div></div>;
}

function Metric({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent: string }) {
  const m: Record<string, string> = { cyan: "text-cyan-300 border-cyan-300/15 bg-cyan-300/5", blue: "text-blue-300 border-blue-300/15 bg-blue-300/5", violet: "text-violet-300 border-violet-300/15 bg-violet-300/5", amber: "text-amber-300 border-amber-300/15 bg-amber-300/5" };
  return <div className="tech-panel p-5"><div className="flex items-start justify-between"><div><div className="font-mono text-3xl font-black tracking-tight text-white">{String(value).padStart(2, "0")}</div><div className="mt-1 text-[11px] font-bold text-slate-500">{label}</div></div><span className={`grid h-10 w-10 place-items-center rounded-xl border ${m[accent]}`}>{icon}</span></div><div className="mt-5 h-px bg-gradient-to-l from-white/10 to-transparent" /></div>;
}

function Title({ title, subtitle }: { title: string; subtitle: string }) { return <div><h2 className="text-base font-black">{title}</h2><p className="mt-1 text-[11px] text-slate-500">{subtitle}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="py-10 text-center text-xs text-slate-600">{text}</div>; }

function TaskStrip({ task, onOpen }: { task: Assignment; onOpen: (id: string) => void }) {
  return <button onClick={() => onOpen(task.id)} className="flex w-full items-center gap-4 py-4 text-right hover:bg-white/[0.025]"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-mono text-[9px] text-cyan-300/50">{task.number}</span><Priority value={task.priority} /></div><div className="mt-1 truncate text-sm font-black">{task.title}</div><div className="mt-1 text-[10px] text-slate-500">{deptName(task.departmentId)} · {fmt(task.updatedAt)}</div></div><Status status={task.status} /></button>;
}

function Tasks({ tasks, search, filter, onSearch, onFilter, onOpen, onCreate, canCreate }: { tasks: Assignment[]; search: string; filter: TaskStatus | "all" | "attention"; onSearch: (v: string) => void; onFilter: (v: TaskStatus | "all" | "attention") => void; onOpen: (id: string) => void; onCreate: () => void; canCreate: boolean }) {
  const list = useMemo(() => tasks.filter((task) => { const q = search.trim().toLowerCase(); const qOk = !q || `${task.number} ${task.title} ${task.details}`.toLowerCase().includes(q); const fOk = filter === "all" || (filter === "attention" ? ["waiting", "returned"].includes(task.status) : task.status === filter); return qOk && fOk; }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [tasks, search, filter]);
  const filters: Array<[TaskStatus | "all" | "attention", string]> = [["all", "الكل"], ["new", "جديد"], ["active", "قيد التنفيذ"], ["review", "بانتظار الاعتماد"], ["attention", "تحتاج متابعة"], ["done", "مكتمل"]];
  return <div className="space-y-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-[10px] font-bold tracking-[.2em] text-cyan-300/50">TASK MATRIX</div><h1 className="mt-2 text-2xl font-black">التكليفات</h1><p className="mt-1 text-xs text-slate-500">متابعة تشغيلية مباشرة لجميع الأعمال ضمن صلاحياتك.</p></div>{canCreate && <button onClick={onCreate} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 text-xs font-black text-slate-950"><Plus size={16} /> إصدار تكليف</button>}</div><div className="tech-panel p-4"><div className="flex flex-col gap-3 lg:flex-row"><div className="relative flex-1"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600" /><input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="بحث سريع..." className="h-11 w-full rounded-xl border border-white/8 bg-black/15 pr-9 pl-3 text-sm outline-none focus:border-cyan-300/30" /></div><div className="flex gap-2 overflow-x-auto">{filters.map(([key, label]) => <button key={key} onClick={() => onFilter(key)} className={`shrink-0 rounded-xl border px-3 py-2 text-[11px] font-bold ${filter === key ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200" : "border-white/8 bg-white/3 text-slate-500"}`}>{label}</button>)}</div></div></div><div className="tech-panel overflow-hidden"><div className="hidden grid-cols-[minmax(0,1.7fr)_170px_130px_100px_140px] gap-4 border-b border-white/8 bg-white/[0.02] px-5 py-3 text-[9px] font-black tracking-wider text-slate-500 lg:grid"><div>التكليف</div><div>القسم</div><div>الحالة</div><div>الأولوية</div><div>آخر تحديث</div></div><div className="divide-y divide-white/7">{list.length ? list.map((task) => <button key={task.id} onClick={() => onOpen(task.id)} className="grid w-full gap-3 px-5 py-4 text-right hover:bg-white/[0.025] lg:grid-cols-[minmax(0,1.7fr)_170px_130px_100px_140px] lg:items-center"><div className="min-w-0"><div className="font-mono text-[9px] text-cyan-300/50">{task.number}</div><div className="mt-1 truncate text-sm font-black">{task.title}</div><div className="mt-1 text-[10px] text-slate-500 lg:hidden">{deptName(task.departmentId)}</div></div><div className="hidden text-[11px] font-bold text-slate-400 lg:block">{deptName(task.departmentId)}</div><div><Status status={task.status} /></div><div><Priority value={task.priority} /></div><div className="text-[10px] text-slate-500">{fmt(task.updatedAt)}</div></button>) : <Empty text="لا توجد تكليفات مطابقة." />}</div></div></div>;
}

function TaskDetail({ task, currentUser, onBack, onUpdate, onTransition }: { task: Assignment; currentUser: DemoUser; onBack: () => void; onUpdate: (task: Assignment, text: string, status?: TaskStatus, attachment?: string) => void; onTransition: (task: Assignment, status: TaskStatus, text: string) => void }) {
  const canWork = currentUser.role !== "boss" && currentUser.departmentId === task.departmentId;
  const canApprove = currentUser.role === "boss" && task.status === "review";
  return <div className="space-y-5"><button onClick={onBack} className="text-[11px] font-bold text-slate-500 hover:text-cyan-300">← العودة إلى التكليفات</button><section className="tech-panel relative overflow-hidden p-5 md:p-7"><div className="absolute left-0 top-0 h-32 w-32 bg-cyan-300/5 blur-3xl" /><div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 font-mono text-[9px] text-cyan-300/60">{task.number}</span><Status status={task.status} /><Priority value={task.priority} /></div><h1 className="mt-4 text-2xl font-black md:text-3xl">{task.title}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{task.details || "لا توجد تفاصيل إضافية."}</p></div><div className="flex flex-wrap gap-2">{canWork && task.status === "new" && <Primary onClick={() => onTransition(task, "active", "تم تأكيد الاستلام وبدء التنفيذ.")}>تأكيد الاستلام</Primary>}{canWork && ["active", "waiting", "returned"].includes(task.status) && <Primary onClick={() => onTransition(task, "review", "تم إنجاز العمل وإرساله للاعتماد.")}>إرسال للاعتماد</Primary>}{canApprove && <><Primary onClick={() => onTransition(task, "done", "تم الاعتماد وإنهاء التكليف.")}>اعتماد وإنهاء</Primary><button onClick={() => onTransition(task, "returned", "أعيد التكليف للتعديل والمتابعة.")} className="h-11 rounded-xl border border-rose-400/20 bg-rose-400/8 px-4 text-xs font-black text-rose-300">إعادة للتعديل</button></>}</div></div><div className="mt-6 grid gap-3 border-t border-white/8 pt-5 sm:grid-cols-2 lg:grid-cols-4"><Meta label="القسم" value={deptName(task.departmentId)} /><Meta label="المسؤول" value={userName(task.ownerId)} /><Meta label="صادر عن" value={userName(task.issuedById)} /><Meta label="آخر تحديث" value={fmt(task.updatedAt)} /></div></section><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"><section className="tech-panel p-5 md:p-6"><Title title="سجل المتابعة" subtitle="التحديثات والقرارات والمرفقات في تسلسل زمني واحد" /><div className="relative mt-6 space-y-5 before:absolute before:right-[15px] before:top-3 before:h-[calc(100%-24px)] before:w-px before:bg-cyan-300/15">{task.updates.map((u) => <div key={u.id} className="relative flex gap-4"><div className={`relative z-10 mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border-4 border-[#0b1524] ${u.system ? "bg-slate-600" : "bg-cyan-400 text-slate-950"}`}>{u.system ? <ShieldCheck size={12} /> : <MessageSquareText size={12} />}</div><div className="min-w-0 flex-1 rounded-2xl border border-white/7 bg-white/[0.025] p-4"><div className="flex justify-between gap-3"><span className="text-[11px] font-black">{u.system ? "النظام" : userName(u.authorId)}</span><span className="text-[9px] text-slate-600">{fmt(u.at)}</span></div><p className="mt-2 text-sm leading-7 text-slate-300">{u.text}</p><div className="mt-3 flex gap-2">{u.status && <Status status={u.status} />}{u.attachment && <span className="flex items-center gap-1 rounded-lg border border-white/8 px-2 py-1 text-[9px] text-slate-400"><Paperclip size={10} />{u.attachment}</span>}</div></div></div>)}</div><Composer task={task} user={currentUser} onUpdate={onUpdate} /></section><aside className="space-y-4"><div className="rounded-[24px] border border-cyan-300/15 bg-gradient-to-br from-cyan-300/10 to-indigo-500/5 p-5"><div className="text-[9px] font-bold tracking-widest text-cyan-300/60">CURRENT STATE</div><div className="mt-3 text-xl font-black">{statusMeta[task.status].label}</div><p className="mt-2 text-[10px] leading-5 text-slate-500">آخر تغيير مسجل في {fmt(task.updatedAt)}</p></div><div className="tech-panel p-5"><div className="text-sm font-black">بيانات التكليف</div><div className="mt-4 space-y-4"><Meta label="الأولوية" value={priorityMeta[task.priority]} /><Meta label="عدد التحديثات" value={String(task.updates.length)} /><Meta label="القسم" value={deptName(task.departmentId)} /></div></div></aside></div></div>;
}

function Primary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className="h-11 rounded-xl bg-cyan-300 px-4 text-xs font-black text-slate-950 shadow-lg shadow-cyan-950/30">{children}</button>; }
function Meta({ label, value }: { label: string; value: string }) { return <div><div className="text-[9px] font-bold text-slate-600">{label}</div><div className="mt-1 text-[11px] font-black text-slate-300">{value}</div></div>; }

function Composer({ task, user, onUpdate }: { task: Assignment; user: DemoUser; onUpdate: (task: Assignment, text: string, status?: TaskStatus, attachment?: string) => void }) {
  const [text, setText] = useState(""); const [status, setStatus] = useState<TaskStatus | "">(""); const [file, setFile] = useState("");
  if (task.status === "done") return <div className="mt-6 rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-4 text-xs font-bold text-emerald-300">التكليف مكتمل ومعتمد. سجل المتابعة محفوظ.</div>;
  const canStatus = user.role !== "boss" && user.departmentId === task.departmentId;
  function submit() { if (!text.trim() && !file) return; onUpdate(task, text.trim() || "تم إرفاق ملف جديد.", status || undefined, file || undefined); setText(""); setStatus(""); setFile(""); }
  function pick(e: ChangeEvent<HTMLInputElement>) { setFile(e.target.files?.[0]?.name ?? ""); }
  return <div className="mt-7 rounded-2xl border border-cyan-300/15 bg-black/15 p-3"><textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="أضف تحديثاً على التكليف..." className="w-full resize-none bg-transparent p-2 text-sm leading-7 outline-none placeholder:text-slate-600" /><div className="flex flex-col gap-2 border-t border-white/7 pt-3 sm:flex-row"><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-[10px] font-bold text-slate-400"><Paperclip size={13} />{file || "إرفاق ملف"}<input type="file" className="hidden" onChange={pick} /></label>{canStatus && <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "")} className="rounded-xl border border-white/8 bg-[#0d1827] px-3 py-2 text-[10px] text-slate-400 outline-none"><option value="">بدون تغيير الحالة</option><option value="active">قيد التنفيذ</option><option value="waiting">بانتظار إجراء</option><option value="review">جاهز للاعتماد</option></select>}<button onClick={submit} className="mr-auto flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-[10px] font-black text-slate-950"><Send size={12} />إرسال التحديث</button></div></div>;
}

function ReportCenter({ tasks, user }: { tasks: Assignment[]; user: DemoUser }) {
  const today = new Date();
  const [period, setPeriod] = useState<ReportPeriod>("week");
  const [type, setType] = useState<ReportType>("activity");
  const [departmentId, setDepartmentId] = useState("all");
  const [from, setFrom] = useState(isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)));
  const [to, setTo] = useState(isoDate(today));

  const range = useMemo(() => {
    const end = period === "custom" ? new Date(`${to}T23:59:59`) : new Date();
    const start = period === "custom" ? new Date(`${from}T00:00:00`) : new Date(end.getTime() - (period === "day" ? 24 : period === "week" ? 168 : 720) * 3_600_000);
    return { start, end };
  }, [period, from, to]);

  const rows = useMemo(() => tasks.filter((task) => {
    const changed = new Date(task.updatedAt);
    const inRange = changed >= range.start && changed <= range.end;
    const deptOk = departmentId === "all" || task.departmentId === departmentId;
    const typeOk = type === "activity" ? inRange : type === "completed" ? task.status === "done" && inRange : task.status !== "done";
    return deptOk && typeOk;
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [tasks, range, departmentId, type]);

  const completed = rows.filter((t) => t.status === "done").length;
  const open = rows.filter((t) => t.status !== "done").length;
  const attention = rows.filter((t) => ["waiting", "returned"].includes(t.status)).length;

  function exportCsv() {
    const header = ["رقم التكليف", "العنوان", "القسم", "الحالة", "الأولوية", "آخر تحديث"];
    const data = rows.map((t) => [t.number, t.title, deptName(t.departmentId), statusMeta[t.status].label, priorityMeta[t.priority], fmt(t.updatedAt)]);
    const csv = [header, ...data].map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `task-report-${isoDate(new Date())}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const data = rows.map((t) => ({ "رقم التكليف": t.number, "العنوان": t.title, "القسم": deptName(t.departmentId), "الحالة": statusMeta[t.status].label, "الأولوية": priorityMeta[t.priority], "آخر تحديث": fmt(t.updatedAt) }));
    const ws = XLSX.utils.json_to_sheet(data); ws["!cols"] = [{ wch: 16 }, { wch: 42 }, { wch: 24 }, { wch: 20 }, { wch: 14 }, { wch: 24 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "التقرير"); XLSX.writeFile(wb, `task-report-${isoDate(new Date())}.xlsx`);
  }

  function printReport() { window.print(); }

  return <div className="space-y-5"><div className="no-print flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="text-[10px] font-bold tracking-[.2em] text-cyan-300/50">REPORT ENGINE</div><h1 className="mt-2 text-2xl font-black">مولد التقارير</h1><p className="mt-1 text-xs text-slate-500">أنشئ تقريراً تنفيذياً فورياً، ثم اطبعه PDF أو صدّره Excel/CSV.</p></div><div className="flex flex-wrap gap-2"><button onClick={printReport} className="report-action"><Printer size={14} />طباعة / PDF</button><button onClick={exportExcel} className="report-action"><FileSpreadsheet size={14} />Excel</button><button onClick={exportCsv} className="report-action"><Download size={14} />CSV</button></div></div><section className="no-print tech-panel p-4 md:p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="الفترة"><select value={period} onChange={(e) => setPeriod(e.target.value as ReportPeriod)} className="tech-field"><option value="day">اليوم</option><option value="week">هذا الأسبوع</option><option value="month">هذا الشهر</option><option value="custom">فترة مخصصة</option></select></Field><Field label="نوع التقرير"><select value={type} onChange={(e) => setType(e.target.value as ReportType)} className="tech-field"><option value="activity">النشاط</option><option value="completed">المنجز</option><option value="open">قيد التنفيذ / المفتوح</option></select></Field>{user.role === "boss" && <Field label="القسم"><select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="tech-field"><option value="all">جميع الأقسام</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>}{period === "custom" && <div className="grid grid-cols-2 gap-2"><Field label="من"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="tech-field" /></Field><Field label="إلى"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="tech-field" /></Field></div>}</div></section><section id="print-report" className="tech-panel overflow-hidden print-report"><div className="border-b border-white/8 bg-gradient-to-l from-cyan-300/8 to-transparent p-5 md:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-[9px] font-black tracking-[.2em] text-cyan-300/60"><FileText size={13} />EXECUTIVE REPORT</div><h2 className="mt-3 text-2xl font-black">تقرير متابعة التكليفات</h2><p className="mt-2 text-[11px] text-slate-500">الفترة: {range.start.toLocaleDateString("ar-SY")} — {range.end.toLocaleDateString("ar-SY")}</p></div><div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3"><div className="text-[9px] text-slate-600">تاريخ الإصدار</div><div className="mt-1 text-xs font-black">{fmt(nowIso())}</div></div></div></div><div className="grid gap-px bg-white/7 sm:grid-cols-4"><ReportStat label="إجمالي السجلات" value={rows.length} /><ReportStat label="منجز" value={completed} /><ReportStat label="مفتوح" value={open} /><ReportStat label="تحتاج متابعة" value={attention} /></div><div className="p-5 md:p-7"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-black">تفاصيل التقرير</h3><p className="mt-1 text-[10px] text-slate-600">{type === "activity" ? "التكليفات التي شهدت نشاطاً خلال الفترة" : type === "completed" ? "التكليفات المنجزة خلال الفترة" : "التكليفات المفتوحة حالياً"}</p></div><span className="rounded-full border border-cyan-300/15 bg-cyan-300/5 px-3 py-1 text-[9px] font-black text-cyan-300">{rows.length} RECORDS</span></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right"><thead><tr className="border-y border-white/8 text-[9px] font-black text-slate-600"><th className="py-3">الرقم</th><th>التكليف</th><th>القسم</th><th>الحالة</th><th>الأولوية</th><th>آخر تحديث</th></tr></thead><tbody className="divide-y divide-white/7">{rows.map((task) => <tr key={task.id} className="text-[11px]"><td className="py-4 font-mono text-cyan-300/60">{task.number}</td><td className="max-w-xs font-bold">{task.title}</td><td className="text-slate-400">{deptName(task.departmentId)}</td><td><Status status={task.status} /></td><td>{priorityMeta[task.priority]}</td><td className="text-slate-500">{fmt(task.updatedAt)}</td></tr>)}</tbody></table>{rows.length === 0 && <Empty text="لا توجد بيانات مطابقة لخيارات التقرير." />}</div></div></section></div>;
}

function ReportStat({ label, value }: { label: string; value: number }) { return <div className="bg-[#0b1524] p-4 text-center"><div className="font-mono text-2xl font-black text-white">{String(value).padStart(2, "0")}</div><div className="mt-1 text-[9px] font-bold text-slate-600">{label}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-2 block text-[9px] font-black text-slate-500">{label}</span>{children}</label>; }

function CreateDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (v: { title: string; details: string; departmentId: string; priority: Priority }) => void }) {
  const [title, setTitle] = useState(""); const [details, setDetails] = useState(""); const [departmentId, setDepartmentId] = useState(departments[0].id); const [priority, setPriority] = useState<Priority>("normal");
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-[#020611]/80 p-4 backdrop-blur-md" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="tech-panel w-full max-w-xl p-5 shadow-2xl md:p-7"><div className="flex items-start justify-between"><div><div className="text-[9px] font-bold tracking-[.2em] text-cyan-300/50">NEW ASSIGNMENT</div><h2 className="mt-2 text-xl font-black">إصدار تكليف جديد</h2></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-white/8 bg-white/5"><X size={16} /></button></div><div className="mt-6 space-y-4"><Field label="عنوان التكليف"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="tech-field" placeholder="اكتب المطلوب بشكل مباشر..." /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="القسم المسؤول"><select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="tech-field">{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Field label="الأولوية"><select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="tech-field"><option value="normal">عادي</option><option value="important">مهم</option><option value="urgent">عاجل</option></select></Field></div><Field label="التفاصيل"><textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} className="tech-field resize-none" placeholder="التفاصيل أو النتيجة المطلوبة..." /></Field></div><div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="h-11 rounded-xl px-4 text-xs font-bold text-slate-500">إلغاء</button><button disabled={title.trim().length < 3} onClick={() => title.trim().length >= 3 && onCreate({ title, details, departmentId, priority })} className="flex h-11 items-center gap-2 rounded-xl bg-cyan-300 px-5 text-xs font-black text-slate-950 disabled:opacity-30"><Send size={14} />إصدار التكليف</button></div></div></div>;
}

function UserMenu({ currentUser, onChange }: { currentUser: DemoUser; onChange: (id: string) => void }) { return <div className="absolute left-0 top-14 z-50 w-72 rounded-2xl border border-white/10 bg-[#0c1726] p-2 shadow-2xl">{users.map((u) => <button key={u.id} onClick={() => onChange(u.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right hover:bg-white/5 ${u.id === currentUser.id ? "bg-cyan-300/7" : ""}`}><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5"><UserRound size={13} /></span><span><span className="block text-[11px] font-black">{u.name}</span><span className="block text-[9px] text-slate-600">{u.title}</span></span></button>)}</div>; }

function MobileNav({ view, canCreate, onView, onCreate }: { view: View; canCreate: boolean; onView: (v: View) => void; onCreate: () => void }) { return <div className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-[22px] border border-white/10 bg-[#0b1524]/95 p-2 shadow-2xl backdrop-blur md:hidden"><button onClick={() => onView("overview")} className={view === "overview" ? "text-cyan-300" : "text-slate-600"}><LayoutDashboard size={19} /></button><button onClick={() => onView("tasks")} className={view === "tasks" ? "text-cyan-300" : "text-slate-600"}><ClipboardCheck size={19} /></button>{canCreate && <button onClick={onCreate} className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300 text-slate-950"><Plus size={21} /></button>}<button onClick={() => onView("reports")} className={view === "reports" ? "text-cyan-300" : "text-slate-600"}><FileSpreadsheet size={19} /></button></div>; }

function MobileDrawer({ view, user, onClose, onView, onCreate }: { view: View; user: DemoUser; onClose: () => void; onView: (v: View) => void; onCreate: () => void }) { return <div className="fixed inset-0 z-[70] bg-[#020611]/80 md:hidden" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="h-full w-[84%] max-w-sm border-l border-white/10 bg-[#08111f] p-5"><div className="flex justify-between"><Brand /><button onClick={onClose}><X size={18} /></button></div><div className="mt-8 h-[calc(100%-80px)]"><Sidebar view={view} currentUser={user} onView={onView} onCreate={onCreate} /></div></div></div>; }
