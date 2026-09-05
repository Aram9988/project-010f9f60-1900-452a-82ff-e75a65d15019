import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileText,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
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
} from "./model";

const nowIso = () => new Date().toISOString();
const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function safeLoad(): AppState {
  const seed = makeSeedState();
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const currentUserId = users.some((u) => u.id === parsed.currentUserId) ? parsed.currentUserId! : seed.currentUserId;
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks.map((task) => ({
          ...task,
          details: task.details ?? "",
          updates: Array.isArray(task.updates) ? task.updates : [],
          updatedAt: task.updatedAt ?? task.createdAt ?? nowIso(),
        }))
      : seed.tasks;
    return {
      currentUserId,
      tasks,
      notices: Array.isArray(parsed.notices) ? parsed.notices : seed.notices,
    };
  } catch {
    return seed;
  }
}

function dt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ar-SY", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function userName(userId?: string) {
  return users.find((u) => u.id === userId)?.name ?? "مستخدم تجريبي";
}

function deptName(departmentId: string) {
  return departments.find((d) => d.id === departmentId)?.name ?? "قسم غير محدد";
}

function visibleTo(user: DemoUser, task: Assignment) {
  return user.role === "boss" || task.departmentId === user.departmentId;
}

const chipTone: Record<string, string> = {
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function StatusChip({ status }: { status: TaskStatus }) {
  const meta = statusMeta[status];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${chipTone[meta.tone]}`}>{meta.label}</span>;
}

function PriorityChip({ priority }: { priority: Priority }) {
  const cls = priority === "urgent" ? "bg-rose-600 text-white" : priority === "important" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${cls}`}>{priorityMeta[priority]}</span>;
}

function IconButton({ children, onClick, label }: { children: React.ReactNode; onClick?: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50">
      {children}
    </button>
  );
}

export default function CommandCenterApp() {
  const [state, setState] = useState<AppState>(() => safeLoad());
  const [view, setView] = useState<View>("overview");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TaskStatus | "all" | "attention">("all");
  const [mobileNav, setMobileNav] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showNotices, setShowNotices] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const currentUser = users.find((u) => u.id === state.currentUserId) ?? users[0];
  const visibleTasks = useMemo(() => state.tasks.filter((task) => visibleTo(currentUser, task)), [state.tasks, currentUser]);
  const selectedTask = selectedTaskId ? visibleTasks.find((task) => task.id === selectedTaskId) ?? null : null;
  const unread = state.notices.filter((n) => n.userId === currentUser.id && !n.read).length;

  function changeUser(userId: string) {
    setState((s) => ({ ...s, currentUserId: userId }));
    setSelectedTaskId(null);
    setShowUserMenu(false);
  }

  function addNotice(userId: string, text: string, taskId?: string) {
    setState((s) => ({
      ...s,
      notices: [{ id: id(), userId, taskId, text, at: nowIso(), read: false }, ...s.notices],
    }));
  }

  function departmentRecipients(departmentId: string) {
    return users.filter((u) => u.departmentId === departmentId).map((u) => u.id);
  }

  function createTask(input: { title: string; details: string; departmentId: string; priority: Priority }) {
    const createdAt = nowIso();
    const nextNumber = `TK-${String(2700 + state.tasks.length + 1).padStart(4, "0")}`;
    const owner = users.find((u) => u.role === "head" && u.departmentId === input.departmentId);
    const task: Assignment = {
      id: id(),
      number: nextNumber,
      title: input.title.trim(),
      details: input.details.trim(),
      departmentId: input.departmentId,
      priority: input.priority,
      status: "new",
      createdAt,
      updatedAt: createdAt,
      issuedById: currentUser.id,
      ownerId: owner?.id,
      updates: [{ id: id(), authorId: currentUser.id, text: "تم إصدار التكليف وإحالته إلى القسم المسؤول.", at: createdAt, system: true }],
    };
    setState((s) => ({ ...s, tasks: [task, ...s.tasks] }));
    for (const recipient of departmentRecipients(input.departmentId)) addNotice(recipient, `تكليف جديد: ${task.title}`, task.id);
    setShowCreate(false);
    setView("tasks");
    setSelectedTaskId(task.id);
  }

  function mutateTask(taskId: string, updater: (task: Assignment) => Assignment) {
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === taskId ? updater(t) : t)) }));
  }

  function addUpdate(task: Assignment, text: string, status?: TaskStatus, attachment?: string) {
    const at = nowIso();
    const entry: UpdateEntry = { id: id(), authorId: currentUser.id, text: text.trim(), at, status, attachment };
    mutateTask(task.id, (t) => ({ ...t, status: status ?? t.status, updatedAt: at, updates: [...t.updates, entry] }));
    if (currentUser.role === "boss") {
      for (const recipient of departmentRecipients(task.departmentId)) addNotice(recipient, `تحديث من الإدارة على ${task.number}`, task.id);
    } else {
      addNotice("boss", `تحديث جديد على ${task.number}: ${task.title}`, task.id);
    }
  }

  function action(task: Assignment, status: TaskStatus, message: string) {
    const at = nowIso();
    const entry: UpdateEntry = { id: id(), authorId: currentUser.id, text: message, at, status, system: true };
    mutateTask(task.id, (t) => ({ ...t, status, updatedAt: at, updates: [...t.updates, entry] }));
    if (currentUser.role === "boss") {
      for (const recipient of departmentRecipients(task.departmentId)) addNotice(recipient, `${message} — ${task.number}`, task.id);
    } else {
      addNotice("boss", `${message} — ${task.number}`, task.id);
    }
  }

  function markNoticesRead() {
    setState((s) => ({ ...s, notices: s.notices.map((n) => (n.userId === currentUser.id ? { ...n, read: true } : n)) }));
  }

  function resetDemo() {
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    setState(makeSeedState());
    setView("overview");
    setSelectedTaskId(null);
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-[#f9fafc]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-[1500px] items-center gap-4 px-4 md:px-7">
          <button type="button" onClick={() => setMobileNav(true)} className="grid h-10 w-10 place-items-center rounded-xl text-slate-700 md:hidden"><Menu size={22} /></button>
          <Brand />
          <div className="hidden h-7 w-px bg-slate-200 md:block" />
          <div className="hidden flex-1 items-center md:flex">
            <div className="relative w-full max-w-xl">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setView("tasks"); }} placeholder="ابحث برقم التكليف أو العنوان..." className="h-11 w-full rounded-2xl border border-slate-200 bg-white pr-10 pl-4 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
            </div>
          </div>
          <div className="mr-auto flex items-center gap-2">
            <div className="relative">
              <IconButton label="الإشعارات" onClick={() => setShowNotices((v) => !v)}><Bell size={18} /></IconButton>
              {unread > 0 && <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{unread}</span>}
              {showNotices && <NoticesPanel state={state} currentUser={currentUser} onOpen={(taskId) => { setSelectedTaskId(taskId ?? null); setView("tasks"); setShowNotices(false); }} onReadAll={markNoticesRead} />}
            </div>
            <div className="relative">
              <button type="button" onClick={() => setShowUserMenu((v) => !v)} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white py-1.5 pr-2 pl-3 transition hover:bg-slate-50">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white"><UserRound size={17} /></span>
                <span className="hidden text-right sm:block"><span className="block text-xs font-bold">{currentUser.name}</span><span className="block text-[10px] text-slate-500">{currentUser.title}</span></span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
              {showUserMenu && <UserMenu currentUser={currentUser} onChange={changeUser} onReset={resetDemo} />}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px] gap-0 px-0 md:px-4 lg:px-6">
        <aside className="sticky top-18 hidden h-[calc(100vh-72px)] w-64 shrink-0 py-7 md:block">
          <Sidebar view={view} currentUser={currentUser} onView={(v) => { setView(v); setSelectedTaskId(null); }} onCreate={() => setShowCreate(true)} />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-7 md:py-8">
          {selectedTask ? (
            <TaskDetail task={selectedTask} currentUser={currentUser} onBack={() => setSelectedTaskId(null)} onUpdate={addUpdate} onAction={action} />
          ) : view === "overview" ? (
            <Overview tasks={visibleTasks} currentUser={currentUser} onOpen={setSelectedTaskId} onCreate={() => setShowCreate(true)} />
          ) : view === "tasks" ? (
            <TasksWorkspace tasks={visibleTasks} search={search} filter={filter} onSearch={setSearch} onFilter={setFilter} onOpen={setSelectedTaskId} onCreate={() => setShowCreate(true)} canCreate={currentUser.role === "boss"} />
          ) : (
            <Reports tasks={visibleTasks} />
          )}
        </main>
      </div>

      <MobileBar view={view} currentUser={currentUser} onView={(v) => { setView(v); setSelectedTaskId(null); }} onCreate={() => setShowCreate(true)} />
      {mobileNav && <MobileDrawer currentUser={currentUser} view={view} onClose={() => setMobileNav(false)} onView={(v) => { setView(v); setSelectedTaskId(null); setMobileNav(false); }} onCreate={() => { setShowCreate(true); setMobileNav(false); }} />}
      {showCreate && <CreateTaskDialog onClose={() => setShowCreate(false)} onCreate={createTask} />}
    </div>
  );
}

function Brand() {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-slate-950 text-white shadow-lg shadow-slate-900/10"><ShieldCheck size={20} /></div>
      <div><div className="text-sm font-black tracking-tight">مركز التكليفات</div><div className="text-[10px] font-medium text-slate-500">COMMAND CENTER</div></div>
    </div>
  );
}

function Sidebar({ view, currentUser, onView, onCreate }: { view: View; currentUser: DemoUser; onView: (view: View) => void; onCreate: () => void }) {
  const items = [
    { id: "overview" as View, label: "نظرة عامة", icon: LayoutDashboard },
    { id: "tasks" as View, label: currentUser.role === "boss" ? "جميع التكليفات" : "تكليفات القسم", icon: ClipboardCheck },
    { id: "reports" as View, label: "المتابعة والتقارير", icon: FileText },
  ];
  return (
    <div className="flex h-full flex-col px-2">
      {currentUser.role === "boss" && <button type="button" onClick={onCreate} className="mb-7 flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"><Plus size={18} /> إصدار تكليف</button>}
      <nav className="space-y-1.5">
        {items.map((item) => <button key={item.id} type="button" onClick={() => onView(item.id)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${view === item.id ? "bg-slate-950 text-white shadow-md" : "text-slate-600 hover:bg-white hover:text-slate-950"}`}><item.icon size={18} />{item.label}</button>)}
      </nav>
      <div className="mt-auto rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700"><CircleDotIcon /> وضع تجريبي</div><p className="text-[11px] leading-5 text-slate-500">هذه النسخة تستخدم بيانات تجريبية محلية فقط. قاعدة البيانات الحقيقية ستُربط عند النشر الداخلي.</p></div>
    </div>
  );
}

function CircleDotIcon() { return <span className="relative block h-2.5 w-2.5 rounded-full bg-emerald-500"><span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-40" /></span>; }

function Overview({ tasks, currentUser, onOpen, onCreate }: { tasks: Assignment[]; currentUser: DemoUser; onOpen: (id: string) => void; onCreate: () => void }) {
  const counts = {
    new: tasks.filter((t) => t.status === "new").length,
    active: tasks.filter((t) => t.status === "active").length,
    review: tasks.filter((t) => t.status === "review").length,
    attention: tasks.filter((t) => t.status === "waiting" || t.status === "returned").length,
  };
  const attention = tasks.filter((t) => t.status === "waiting" || t.status === "returned").slice(0, 4);
  const recent = [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 7);
  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[28px] bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-300">لوحة المتابعة التنفيذية</div><h1 className="text-2xl font-black md:text-3xl">صباح الخير، {currentUser.name}</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">كل ما يهمك اليوم في مكان واحد: التكليفات الجديدة، العمل الجاري، وما يحتاج قراراً أو اعتماداً.</p></div>
          {currentUser.role === "boss" && <button type="button" onClick={onCreate} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-950 transition hover:bg-indigo-50"><Plus size={18} /> إصدار تكليف جديد</button>}
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="جديد" value={counts.new} icon={<Inbox size={20} />} tone="sky" />
        <Metric title="قيد التنفيذ" value={counts.active} icon={<Clock3 size={20} />} tone="indigo" />
        <Metric title="بانتظار الاعتماد" value={counts.review} icon={<ClipboardCheck size={20} />} tone="violet" />
        <Metric title="تحتاج متابعة" value={counts.attention} icon={<MessageSquareText size={20} />} tone="amber" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6"><SectionTitle title="أحدث التكليفات" subtitle="آخر ما تم تحديثه ضمن نطاقك" /><div className="mt-4 divide-y divide-slate-100">{recent.map((task) => <CompactTask key={task.id} task={task} onOpen={onOpen} />)}</div></section>
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6"><SectionTitle title="تحتاج متابعة" subtitle="حالات تتطلب تدخلاً أو معلومة" />{attention.length ? <div className="mt-4 space-y-3">{attention.map((task) => <button key={task.id} onClick={() => onOpen(task.id)} className="w-full rounded-2xl border border-amber-100 bg-amber-50/60 p-4 text-right transition hover:border-amber-200"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-mono text-slate-500">{task.number}</span><StatusChip status={task.status} /></div><div className="mt-2 text-sm font-black leading-6 text-slate-900">{task.title}</div><div className="mt-2 text-[11px] text-slate-500">{deptName(task.departmentId)}</div></button>)}</div> : <Empty message="لا توجد حالات تحتاج متابعة حالياً." />}</section>
      </div>
    </div>
  );
}

function Metric({ title, value, icon, tone }: { title: string; value: number; icon: React.ReactNode; tone: string }) {
  const toneCls: Record<string, string> = { sky: "bg-sky-50 text-sky-700", indigo: "bg-indigo-50 text-indigo-700", violet: "bg-violet-50 text-violet-700", amber: "bg-amber-50 text-amber-800" };
  return <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><div className="text-3xl font-black tracking-tight">{value}</div><div className="mt-1 text-xs font-bold text-slate-500">{title}</div></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${toneCls[tone]}`}>{icon}</span></div></div>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div><h2 className="text-base font-black">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>; }

function CompactTask({ task, onOpen }: { task: Assignment; onOpen: (id: string) => void }) {
  return <button type="button" onClick={() => onOpen(task.id)} className="flex w-full items-center gap-4 py-4 text-right transition hover:bg-slate-50/80"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-mono text-slate-400">{task.number}</span><PriorityChip priority={task.priority} /></div><div className="mt-1 truncate text-sm font-black">{task.title}</div><div className="mt-1 text-[11px] text-slate-500">{deptName(task.departmentId)} · آخر تحديث {dt(task.updatedAt)}</div></div><StatusChip status={task.status} /></button>;
}

function TasksWorkspace({ tasks, search, filter, onSearch, onFilter, onOpen, onCreate, canCreate }: { tasks: Assignment[]; search: string; filter: TaskStatus | "all" | "attention"; onSearch: (v: string) => void; onFilter: (v: TaskStatus | "all" | "attention") => void; onOpen: (id: string) => void; onCreate: () => void; canCreate: boolean }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesQ = !q || `${task.number} ${task.title} ${task.details}`.toLowerCase().includes(q);
      const matchesFilter = filter === "all" || (filter === "attention" ? task.status === "waiting" || task.status === "returned" : task.status === filter);
      return matchesQ && matchesFilter;
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [tasks, search, filter]);
  const filters: { id: TaskStatus | "all" | "attention"; label: string }[] = [
    { id: "all", label: "الكل" }, { id: "new", label: "جديد" }, { id: "active", label: "قيد التنفيذ" }, { id: "review", label: "بانتظار الاعتماد" }, { id: "attention", label: "تحتاج متابعة" }, { id: "done", label: "مكتمل" },
  ];
  return <div className="space-y-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-black">التكليفات</h1><p className="mt-1 text-sm text-slate-500">قائمة واضحة لكل العمل الحالي وسجل ما تم إنجازه.</p></div>{canCreate && <button type="button" onClick={onCreate} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-600/15 hover:bg-indigo-700"><Plus size={17} /> إصدار تكليف</button>}</div><div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="بحث سريع..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-3 text-sm outline-none focus:border-indigo-300 focus:bg-white" /></div><div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">{filters.map((f) => <button key={f.id} type="button" onClick={() => onFilter(f.id)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${filter === f.id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{f.label}</button>)}</div></div></div><div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"><div className="hidden grid-cols-[minmax(0,1.7fr)_180px_130px_120px_120px] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-[11px] font-bold text-slate-500 lg:grid"><div>التكليف</div><div>القسم</div><div>الحالة</div><div>الأولوية</div><div>آخر تحديث</div></div><div className="divide-y divide-slate-100">{filtered.length ? filtered.map((task) => <TaskRow key={task.id} task={task} onOpen={onOpen} />) : <Empty message="لا توجد تكليفات مطابقة." />}</div></div></div>;
}

function TaskRow({ task, onOpen }: { task: Assignment; onOpen: (id: string) => void }) {
  return <button type="button" onClick={() => onOpen(task.id)} className="grid w-full gap-3 px-5 py-4 text-right transition hover:bg-slate-50 lg:grid-cols-[minmax(0,1.7fr)_180px_130px_120px_120px] lg:items-center"><div className="min-w-0"><div className="text-[10px] font-mono text-slate-400">{task.number}</div><div className="mt-1 truncate text-sm font-black">{task.title}</div><div className="mt-1 line-clamp-1 text-[11px] text-slate-500 lg:hidden">{deptName(task.departmentId)}</div></div><div className="hidden text-xs font-bold text-slate-600 lg:block">{deptName(task.departmentId)}</div><div><StatusChip status={task.status} /></div><div><PriorityChip priority={task.priority} /></div><div className="text-[11px] text-slate-500">{dt(task.updatedAt)}</div></button>;
}

function TaskDetail({ task, currentUser, onBack, onUpdate, onAction }: { task: Assignment; currentUser: DemoUser; onBack: () => void; onUpdate: (task: Assignment, text: string, status?: TaskStatus, attachment?: string) => void; onAction: (task: Assignment, status: TaskStatus, message: string) => void }) {
  const canWork = currentUser.role !== "boss" && currentUser.departmentId === task.departmentId;
  const canApprove = currentUser.role === "boss" && task.status === "review";
  return <div className="space-y-6"><button type="button" onClick={onBack} className="text-xs font-bold text-slate-500 hover:text-slate-950">← العودة إلى التكليفات</button><section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-7"><div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-mono font-bold text-slate-500">{task.number}</span><StatusChip status={task.status} /><PriorityChip priority={task.priority} /></div><h1 className="mt-4 text-2xl font-black leading-tight md:text-3xl">{task.title}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{task.details || "لا توجد تفاصيل إضافية."}</p></div><div className="flex flex-wrap gap-2">{canWork && task.status === "new" && <ActionButton onClick={() => onAction(task, "active", "تم تأكيد الاستلام وبدء التنفيذ.")} label="تأكيد الاستلام" icon={<Check size={16} />} />}{canWork && ["active", "waiting", "returned"].includes(task.status) && <ActionButton onClick={() => onAction(task, "review", "تم إنجاز العمل وإرساله للاعتماد.")} label="إرسال للاعتماد" icon={<Send size={16} />} />}{canApprove && <><ActionButton onClick={() => onAction(task, "done", "تم الاعتماد وإنهاء التكليف.")} label="اعتماد وإنهاء" icon={<CheckCircle2 size={16} />} /><button type="button" onClick={() => onAction(task, "returned", "أعيد التكليف للتعديل والمتابعة.")} className="h-11 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-xs font-bold text-rose-700 hover:bg-rose-100">إعادة للتعديل</button></>}</div></div><div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4"><Meta label="القسم" value={deptName(task.departmentId)} /><Meta label="المسؤول" value={userName(task.ownerId)} /><Meta label="صادر عن" value={userName(task.issuedById)} /><Meta label="تاريخ الإصدار" value={dt(task.createdAt)} /></div></section><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6"><SectionTitle title="المتابعة" subtitle="كل تحديث وقرار ومرفق في تسلسل واحد واضح" /><Timeline task={task} /><Composer task={task} currentUser={currentUser} onUpdate={onUpdate} /></section><aside className="space-y-4"><div className="rounded-[24px] bg-slate-950 p-5 text-white"><div className="text-[11px] font-bold text-slate-400">الوضع الحالي</div><div className="mt-3 text-xl font-black">{statusMeta[task.status].label}</div><p className="mt-2 text-xs leading-6 text-slate-300">آخر تحديث: {dt(task.updatedAt)}</p></div><div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm font-black">ملخص التكليف</div><div className="mt-4 space-y-4 text-xs"><SummaryLine label="الأولوية" value={priorityMeta[task.priority]} /><SummaryLine label="عدد التحديثات" value={String(task.updates.length)} /><SummaryLine label="القسم" value={deptName(task.departmentId)} /></div></div></aside></div></div>;
}

function ActionButton({ onClick, label, icon }: { onClick: () => void; label: string; icon: React.ReactNode }) { return <button type="button" onClick={onClick} className="flex h-11 items-center gap-2 rounded-2xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-lg shadow-indigo-600/15 hover:bg-indigo-700">{icon}{label}</button>; }
function Meta({ label, value }: { label: string; value: string }) { return <div><div className="text-[10px] font-bold text-slate-400">{label}</div><div className="mt-1 text-xs font-black text-slate-700">{value}</div></div>; }
function SummaryLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4"><span className="text-slate-500">{label}</span><span className="font-bold text-slate-900">{value}</span></div>; }

function Timeline({ task }: { task: Assignment }) {
  return <div className="relative mt-6 space-y-5 before:absolute before:right-[15px] before:top-3 before:h-[calc(100%-24px)] before:w-px before:bg-slate-200">{task.updates.map((u) => <div key={u.id} className="relative flex gap-4"><div className={`relative z-10 mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border-4 border-white ${u.system ? "bg-slate-300" : "bg-indigo-600"}`}>{u.system ? <Check size={12} className="text-white" /> : <MessageSquareText size={12} className="text-white" />}</div><div className="min-w-0 flex-1 rounded-2xl bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs font-black">{u.system ? "النظام" : userName(u.authorId)}</div><div className="text-[10px] text-slate-400">{dt(u.at)}</div></div><p className="mt-2 text-sm leading-7 text-slate-700">{u.text}</p><div className="mt-3 flex flex-wrap gap-2">{u.status && <StatusChip status={u.status} />}{u.attachment && <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600"><Paperclip size={11} />{u.attachment}</span>}</div></div></div>)}</div>;
}

function Composer({ task, currentUser, onUpdate }: { task: Assignment; currentUser: DemoUser; onUpdate: (task: Assignment, text: string, status?: TaskStatus, attachment?: string) => void }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [fileName, setFileName] = useState("");
  if (task.status === "done") return <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">هذا التكليف مكتمل ومعتمد. سجل المتابعة محفوظ للرجوع إليه.</div>;
  const canChangeStatus = currentUser.role !== "boss" && currentUser.departmentId === task.departmentId;
  function submit() {
    if (!text.trim() && !fileName) return;
    onUpdate(task, text.trim() || "تم إرفاق ملف جديد.", status || undefined, fileName || undefined);
    setText(""); setStatus(""); setFileName("");
  }
  function pick(e: ChangeEvent<HTMLInputElement>) { setFileName(e.target.files?.[0]?.name ?? ""); }
  return <div className="mt-7 rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100"><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب تحديثاً أو ملاحظة على التكليف..." rows={3} className="w-full resize-none bg-transparent px-2 py-2 text-sm leading-7 outline-none placeholder:text-slate-400" /><div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center"><label className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-200"><Paperclip size={14} />{fileName || "إرفاق ملف"}<input type="file" className="hidden" onChange={pick} /></label>{canChangeStatus && <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "")} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 outline-none"><option value="">بدون تغيير الحالة</option><option value="active">قيد التنفيذ</option><option value="waiting">بانتظار إجراء</option><option value="review">جاهز للاعتماد</option></select>}<button type="button" onClick={submit} className="mr-auto flex h-9 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-[11px] font-bold text-white hover:bg-indigo-700"><Send size={13} />إرسال التحديث</button></div></div>;
}

function Reports({ tasks }: { tasks: Assignment[] }) {
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const hours = period === "day" ? 24 : period === "week" ? 168 : 720;
  const cutoff = Date.now() - hours * 3_600_000;
  const active = tasks.filter((t) => t.status !== "done");
  const completed = tasks.filter((t) => t.status === "done" && new Date(t.updatedAt).getTime() >= cutoff);
  const touched = tasks.filter((t) => new Date(t.updatedAt).getTime() >= cutoff);
  return <div className="space-y-6"><div><h1 className="text-2xl font-black">المتابعة والتقارير</h1><p className="mt-1 text-sm text-slate-500">ملخص تنفيذي مختصر يساعد الإدارة على معرفة ما جرى وما يزال مفتوحاً.</p></div><div className="flex gap-2">{(["day", "week", "month"] as const).map((p) => <button key={p} type="button" onClick={() => setPeriod(p)} className={`rounded-xl px-4 py-2 text-xs font-bold ${period === p ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{p === "day" ? "اليوم" : p === "week" ? "هذا الأسبوع" : "هذا الشهر"}</button>)}</div><div className="grid gap-3 sm:grid-cols-3"><Metric title="نشاط خلال الفترة" value={touched.length} icon={<Clock3 size={20} />} tone="indigo" /><Metric title="مكتمل" value={completed.length} icon={<CheckCircle2 size={20} />} tone="sky" /><Metric title="مفتوح حالياً" value={active.length} icon={<ClipboardCheck size={20} />} tone="amber" /></div><section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6"><SectionTitle title="ملخص النشاط" subtitle="تكليفات تغيرت أو تم العمل عليها في الفترة المختارة" /><div className="mt-4 divide-y divide-slate-100">{touched.length ? touched.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).map((task) => <div key={task.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[10px] font-mono text-slate-400">{task.number}</div><div className="mt-1 text-sm font-black">{task.title}</div><div className="mt-1 text-[11px] text-slate-500">{deptName(task.departmentId)} · {dt(task.updatedAt)}</div></div><StatusChip status={task.status} /></div>) : <Empty message="لا يوجد نشاط في الفترة المحددة." />}</div></section></div>;
}

function CreateTaskDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (input: { title: string; details: string; departmentId: string; priority: Priority }) => void }) {
  const [title, setTitle] = useState(""); const [details, setDetails] = useState(""); const [departmentId, setDepartmentId] = useState(departments[0].id); const [priority, setPriority] = useState<Priority>("normal");
  const valid = title.trim().length >= 3;
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="w-full max-w-xl rounded-[28px] bg-white p-5 shadow-2xl md:p-7"><div className="flex items-start justify-between"><div><h2 className="text-xl font-black">إصدار تكليف جديد</h2><p className="mt-1 text-xs text-slate-500">أدخل المطلوب بشكل واضح. التفاصيل يمكن استكمالها أثناء المتابعة.</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"><X size={17} /></button></div><div className="mt-6 space-y-4"><Field label="عنوان التكليف"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: إعداد دراسة تغطية لموقع..." className="field" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="القسم المسؤول"><select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="field">{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Field label="الأولوية"><select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="field"><option value="normal">عادي</option><option value="important">مهم</option><option value="urgent">عاجل</option></select></Field></div><Field label="التفاصيل — اختياري"><textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} placeholder="ما النتيجة المطلوبة؟ أضف أي توضيح ضروري..." className="field resize-none" /></Field></div><div className="mt-6 flex items-center justify-end gap-2"><button type="button" onClick={onClose} className="h-11 rounded-2xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100">إلغاء</button><button type="button" disabled={!valid} onClick={() => valid && onCreate({ title, details, departmentId, priority })} className="flex h-11 items-center gap-2 rounded-2xl bg-indigo-600 px-5 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 disabled:cursor-not-allowed disabled:opacity-40"><Send size={15} />إصدار التكليف</button></div></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-[11px] font-bold text-slate-600">{label}</span>{children}</label>; }

function NoticesPanel({ state, currentUser, onOpen, onReadAll }: { state: AppState; currentUser: DemoUser; onOpen: (taskId?: string) => void; onReadAll: () => void }) {
  const items = state.notices.filter((n) => n.userId === currentUser.id).slice(0, 8);
  return <div className="absolute left-0 top-12 z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 p-4"><div className="text-sm font-black">الإشعارات</div><button type="button" onClick={onReadAll} className="text-[10px] font-bold text-indigo-600">تعليم الكل كمقروء</button></div><div className="max-h-96 overflow-y-auto">{items.length ? items.map((n) => <button key={n.id} type="button" onClick={() => onOpen(n.taskId)} className={`block w-full border-b border-slate-100 p-4 text-right transition hover:bg-slate-50 ${!n.read ? "bg-indigo-50/50" : ""}`}><div className="text-xs font-bold leading-6 text-slate-800">{n.text}</div><div className="mt-1 text-[10px] text-slate-400">{dt(n.at)}</div></button>) : <Empty message="لا توجد إشعارات." />}</div></div>;
}

function UserMenu({ currentUser, onChange, onReset }: { currentUser: DemoUser; onChange: (id: string) => void; onReset: () => void }) {
  return <div className="absolute left-0 top-14 z-50 w-72 rounded-[22px] border border-slate-200 bg-white p-2 shadow-2xl"><div className="px-3 py-2"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">وضع التجربة — تبديل المستخدم</div></div>{users.map((u) => <button key={u.id} type="button" onClick={() => onChange(u.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition hover:bg-slate-50 ${u.id === currentUser.id ? "bg-indigo-50" : ""}`}><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><UserRound size={14} /></span><span><span className="block text-xs font-bold">{u.name}</span><span className="block text-[10px] text-slate-400">{u.title}</span></span>{u.id === currentUser.id && <Check className="mr-auto text-indigo-600" size={15} />}</button>)}<div className="my-2 h-px bg-slate-100" /><button type="button" onClick={onReset} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50"><RotateCcw size={14} /> إعادة البيانات التجريبية</button></div>;
}

function MobileBar({ view, currentUser, onView, onCreate }: { view: View; currentUser: DemoUser; onView: (v: View) => void; onCreate: () => void }) {
  return <div className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-[22px] border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur md:hidden"><MobileNavButton active={view === "overview"} label="الرئيسية" icon={<LayoutDashboard size={19} />} onClick={() => onView("overview")} /><MobileNavButton active={view === "tasks"} label="التكليفات" icon={<ClipboardCheck size={19} />} onClick={() => onView("tasks")} />{currentUser.role === "boss" && <button type="button" onClick={onCreate} className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"><Plus size={22} /></button>}<MobileNavButton active={view === "reports"} label="التقارير" icon={<FileText size={19} />} onClick={() => onView("reports")} /></div>;
}
function MobileNavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[9px] font-bold ${active ? "text-indigo-700" : "text-slate-400"}`}>{icon}{label}</button>; }

function MobileDrawer({ currentUser, view, onClose, onView, onCreate }: { currentUser: DemoUser; view: View; onClose: () => void; onView: (v: View) => void; onCreate: () => void }) {
  return <div className="fixed inset-0 z-[70] bg-slate-950/45 md:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="h-full w-[84%] max-w-sm bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><Brand /><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100"><X size={17} /></button></div><div className="mt-8"><Sidebar view={view} currentUser={currentUser} onView={onView} onCreate={onCreate} /></div></div></div>;
}

function Empty({ message }: { message: string }) { return <div className="p-8 text-center text-xs font-medium text-slate-400">{message}</div>; }
