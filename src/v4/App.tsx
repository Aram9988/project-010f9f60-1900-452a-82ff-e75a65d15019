import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Activity, Bell, ChevronDown, ClipboardCheck, FileSpreadsheet, Gauge, LayoutDashboard, LogOut, Menu, Plus, Radar, Search, Send, UserRound, X, Zap } from "lucide-react";
import { STORAGE_KEY, departments, makeSeedState, users, type AppState, type Assignment, type DemoUser, type Priority, type TaskStatus, type UpdateEntry, type View } from "../v2/model";
import LoginScreen, { DEMO_ACCOUNTS } from "./LoginScreen";
import NotificationsPanel from "./NotificationsPanel";
import TaskDetail, { PriorityChip, StatusChip } from "./TaskDetail";
import Reports from "./Reports";

const SESSION_KEY = "command-center-demo-session";
const nowIso = () => new Date().toISOString();
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function loadState(): AppState {
  const seed = makeSeedState();
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      currentUserId: users.some((u) => u.id === parsed.currentUserId) ? parsed.currentUserId! : seed.currentUserId,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map((t) => ({ ...t, details: t.details ?? "", updates: Array.isArray(t.updates) ? t.updates : [], updatedAt: t.updatedAt ?? t.createdAt ?? nowIso() })) : seed.tasks,
      notices: Array.isArray(parsed.notices) ? parsed.notices : seed.notices,
    };
  } catch { return seed; }
}

function fmt(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ar-SY", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function deptName(id: string) { return departments.find((d) => d.id === id)?.name ?? "قسم غير محدد"; }
function visibleTo(user: DemoUser, task: Assignment) { return user.role === "boss" || user.departmentId === task.departmentId; }

export default function App() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(() => typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null);
  const [state, setState] = useState<AppState>(() => loadState());
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);

  function login(username: string, password: string) {
    const userId = DEMO_ACCOUNTS[username.trim().toLowerCase()];
    if (!userId || password !== "demo") return false;
    sessionStorage.setItem(SESSION_KEY, userId);
    setSessionUserId(userId);
    setState((s) => ({ ...s, currentUserId: userId }));
    return true;
  }

  function logout() { sessionStorage.removeItem(SESSION_KEY); setSessionUserId(null); }
  if (!sessionUserId) return <LoginScreen onLogin={login} />;
  return <Shell state={state} setState={setState} sessionUserId={sessionUserId} onLogout={logout} />;
}

function Shell({ state, setState, sessionUserId, onLogout }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; sessionUserId: string; onLogout: () => void }) {
  const [view, setView] = useState<View>("overview");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TaskStatus | "all" | "attention">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? users[0];
  const tasks = useMemo(() => state.tasks.filter((t) => visibleTo(currentUser, t)), [state.tasks, currentUser]);
  const selected = taskId ? tasks.find((t) => t.id === taskId) ?? null : null;
  const notices = state.notices.filter((n) => n.userId === currentUser.id).sort((a, b) => b.at.localeCompare(a.at));
  const unread = notices.filter((n) => !n.read).length;

  function notify(userId: string, text: string, taskId?: string) {
    setState((s) => ({ ...s, notices: [{ id: uid(), userId, taskId, text, at: nowIso(), read: false }, ...s.notices] }));
  }
  function markRead(id: string) { setState((s) => ({ ...s, notices: s.notices.map((n) => n.id === id ? { ...n, read: true } : n) })); }
  function markAllRead() { setState((s) => ({ ...s, notices: s.notices.map((n) => n.userId === currentUser.id ? { ...n, read: true } : n) })); }
  function openNotice(notice: AppState["notices"][number]) {
    markRead(notice.id);
    if (notice.taskId) {
      const target = tasks.find((t) => t.id === notice.taskId);
      if (target) { setTaskId(target.id); setView("tasks"); }
    }
    setNoticeOpen(false);
  }

  function createTask(input: { title: string; details: string; departmentId: string; priority: Priority }) {
    const at = nowIso();
    const owner = users.find((u) => u.role === "head" && u.departmentId === input.departmentId);
    const task: Assignment = {
      id: uid(), number: `TK-${String(3000 + state.tasks.length + 1)}`, title: input.title.trim(), details: input.details.trim(), departmentId: input.departmentId, priority: input.priority, status: "new", createdAt: at, updatedAt: at, issuedById: currentUser.id, ownerId: owner?.id,
      updates: [{ id: uid(), authorId: currentUser.id, text: "تم إصدار التكليف وإحالته إلى القسم المسؤول.", at, system: true }],
    };
    setState((s) => ({ ...s, tasks: [task, ...s.tasks] }));
    users.filter((u) => u.departmentId === input.departmentId).forEach((u) => notify(u.id, `تكليف جديد: ${task.title}`, task.id));
    setCreateOpen(false); setView("tasks"); setTaskId(task.id);
  }

  function updateTask(task: Assignment, text: string, status?: TaskStatus, attachment?: string) {
    const at = nowIso();
    const entry: UpdateEntry = { id: uid(), authorId: currentUser.id, text, at, status, attachment };
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => t.id === task.id ? { ...t, status: status ?? t.status, updatedAt: at, updates: [...t.updates, entry] } : t) }));
    if (currentUser.role === "boss") users.filter((u) => u.departmentId === task.departmentId).forEach((u) => notify(u.id, `تحديث إداري على ${task.number}`, task.id));
    else notify("boss", `تحديث جديد على ${task.number}`, task.id);
  }

  return (
    <div className="tech-shell min-h-screen text-slate-100">
      <div className="pointer-events-none fixed inset-0 tech-grid opacity-35" />
      <Header currentUser={currentUser} search={search} onSearch={(v) => { setSearch(v); setView("tasks"); }} unread={unread} noticeOpen={noticeOpen} userOpen={userOpen} onToggleNotice={() => { setNoticeOpen((v) => !v); setUserOpen(false); }} onToggleUser={() => { setUserOpen((v) => !v); setNoticeOpen(false); }} notices={notices} onOpenNotice={openNotice} onReadAll={markAllRead} onLogout={onLogout} onMobile={() => setMobileOpen(true)} />
      <div className="relative z-10 mx-auto flex max-w-[1560px]">
        <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] w-64 shrink-0 border-l border-white/8 p-5 md:block"><Sidebar view={view} user={currentUser} onView={(v) => { setView(v); setTaskId(null); }} onCreate={() => setCreateOpen(true)} /></aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-7 md:py-8">
          {selected ? <TaskDetail task={selected} currentUser={currentUser} onBack={() => setTaskId(null)} onUpdate={updateTask} onTransition={(task, status, text) => updateTask(task, text, status)} /> : view === "overview" ? <Overview tasks={tasks} user={currentUser} onOpen={setTaskId} onCreate={() => setCreateOpen(true)} /> : view === "tasks" ? <Tasks tasks={tasks} search={search} filter={filter} onSearch={setSearch} onFilter={setFilter} onOpen={setTaskId} onCreate={() => setCreateOpen(true)} canCreate={currentUser.role === "boss"} /> : <Reports tasks={tasks} user={currentUser} />}
        </main>
      </div>
      <MobileNav view={view} canCreate={currentUser.role === "boss"} onView={(v) => { setView(v); setTaskId(null); }} onCreate={() => setCreateOpen(true)} />
      {mobileOpen && <MobileDrawer view={view} user={currentUser} onClose={() => setMobileOpen(false)} onView={(v) => { setView(v); setTaskId(null); setMobileOpen(false); }} onCreate={() => { setCreateOpen(true); setMobileOpen(false); }} />}
      {createOpen && <CreateDialog onClose={() => setCreateOpen(false)} onCreate={createTask} />}
    </div>
  );
}

function Header({ currentUser, search, onSearch, unread, noticeOpen, userOpen, onToggleNotice, onToggleUser, notices, onOpenNotice, onReadAll, onLogout, onMobile }: { currentUser: DemoUser; search: string; onSearch: (v: string) => void; unread: number; noticeOpen: boolean; userOpen: boolean; onToggleNotice: () => void; onToggleUser: () => void; notices: AppState["notices"]; onOpenNotice: (n: AppState["notices"][number]) => void; onReadAll: () => void; onLogout: () => void; onMobile: () => void }) {
  return <header className="sticky top-0 z-50 border-b border-white/10 bg-[#08111f]/85 backdrop-blur-2xl"><div className="mx-auto flex h-[72px] max-w-[1560px] items-center gap-4 px-4 md:px-7"><button onClick={onMobile} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 md:hidden"><Menu size={20} /></button><Brand /><div className="hidden h-8 w-px bg-white/10 md:block" /><div className="hidden flex-1 md:block"><div className="relative max-w-xl"><Search size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="بحث موحد في التكليفات..." className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pr-11 pl-4 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-400/40" /></div></div><div className="mr-auto flex items-center gap-2"><div className="relative"><button onClick={onToggleNotice} aria-label="الإشعارات" className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/20 hover:text-cyan-300"><Bell size={17} />{unread > 0 && <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-cyan-400 px-1 text-[9px] font-black text-slate-950">{unread}</span>}</button>{noticeOpen && <NotificationsPanel notices={notices} onOpen={onOpenNotice} onReadAll={onReadAll} />}</div><div className="relative"><button onClick={onToggleUser} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-1.5 pr-2 pl-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-950"><UserRound size={17} /></span><span className="hidden text-right sm:block"><span className="block text-xs font-black">{currentUser.name}</span><span className="block text-[9px] text-cyan-300/60">{currentUser.title}</span></span><ChevronDown size={14} className="text-slate-500" /></button>{userOpen && <div className="absolute left-0 top-14 z-50 w-64 rounded-2xl border border-white/10 bg-[#0c1726] p-2 shadow-2xl"><div className="px-3 py-3"><div className="text-xs font-black">{currentUser.name}</div><div className="mt-1 text-[10px] text-slate-600">{currentUser.title}</div></div><div className="h-px bg-white/7" /><button onClick={onLogout} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-400/7"><LogOut size={14} />تسجيل الخروج</button></div>}</div></div></div></header>;
}

function Brand() { return <div className="flex shrink-0 items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-[14px] border border-cyan-300/30 bg-cyan-300/10 text-cyan-300"><Radar size={20} /></div><div><div className="text-sm font-black">مركز التكليفات</div><div className="mt-0.5 text-[9px] font-bold tracking-[0.24em] text-cyan-300/60">OPERATIONS COMMAND</div></div></div>; }
function Sidebar({ view, user, onView, onCreate }: { view: View; user: DemoUser; onView: (v: View) => void; onCreate: () => void }) { const items = [{ id: "overview" as View, label: "لوحة العمليات", icon: Gauge }, { id: "tasks" as View, label: user.role === "boss" ? "جميع التكليفات" : "تكليفات القسم", icon: ClipboardCheck }, { id: "reports" as View, label: "التقارير", icon: FileSpreadsheet }]; return <div className="flex h-full flex-col">{user.role === "boss" && <button onClick={onCreate} className="mb-6 flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-cyan-400 to-indigo-500 text-sm font-black text-slate-950"><Plus size={17} />إصدار تكليف</button>}<nav className="space-y-2">{items.map((i) => <button key={i.id} onClick={() => onView(i.id)} className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${view === i.id ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-200" : "border-transparent text-slate-400 hover:bg-white/5"}`}><i.icon size={18} />{i.label}</button>)}</nav></div>; }

function Overview({ tasks, user, onOpen, onCreate }: { tasks: Assignment[]; user: DemoUser; onOpen: (id: string) => void; onCreate: () => void }) { const counts = { new: tasks.filter((t) => t.status === "new").length, active: tasks.filter((t) => t.status === "active").length, review: tasks.filter((t) => t.status === "review").length, attention: tasks.filter((t) => ["waiting","returned"].includes(t.status)).length }; const recent = [...tasks].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0,7); return <div className="space-y-6"><section className="tech-panel p-6 md:p-8"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-[10px] font-black text-cyan-300"><Activity size={12} />LIVE OPERATIONS</div><h1 className="text-2xl font-black md:text-4xl">لوحة المتابعة التنفيذية</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">صورة مباشرة عن التكليفات الجديدة والعمل الجاري وما يحتاج قراراً أو اعتماداً.</p></div>{user.role === "boss" && <button onClick={onCreate} className="flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-950"><Zap size={17} />إصدار تكليف جديد</button>}</div></section><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="جديد" value={counts.new} /><Metric label="قيد التنفيذ" value={counts.active} /><Metric label="بانتظار الاعتماد" value={counts.review} /><Metric label="تحتاج متابعة" value={counts.attention} /></div><section className="tech-panel p-5 md:p-6"><h2 className="text-base font-black">آخر النشاط</h2><div className="mt-4 divide-y divide-white/7">{recent.map((t) => <TaskRow key={t.id} task={t} onOpen={onOpen} />)}</div></section></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="tech-panel p-5"><div className="font-mono text-3xl font-black">{String(value).padStart(2,"0")}</div><div className="mt-1 text-[11px] font-bold text-slate-500">{label}</div><div className="mt-5 h-px bg-gradient-to-l from-cyan-300/20 to-transparent" /></div>; }
function TaskRow({ task, onOpen }: { task: Assignment; onOpen: (id: string) => void }) { return <button onClick={() => onOpen(task.id)} className="flex w-full items-center gap-4 py-4 text-right hover:bg-white/[0.025]"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-mono text-[9px] text-cyan-300/50">{task.number}</span><PriorityChip value={task.priority} /></div><div className="mt-1 truncate text-sm font-black">{task.title}</div><div className="mt-1 text-[10px] text-slate-500">{deptName(task.departmentId)} · {fmt(task.updatedAt)}</div></div><StatusChip status={task.status} /></button>; }

function Tasks({ tasks, search, filter, onSearch, onFilter, onOpen, onCreate, canCreate }: { tasks: Assignment[]; search: string; filter: TaskStatus | "all" | "attention"; onSearch: (v: string) => void; onFilter: (v: TaskStatus | "all" | "attention") => void; onOpen: (id: string) => void; onCreate: () => void; canCreate: boolean }) { const list = useMemo(() => tasks.filter((t) => { const q = search.trim().toLowerCase(); return (!q || `${t.number} ${t.title} ${t.details}`.toLowerCase().includes(q)) && (filter === "all" || (filter === "attention" ? ["waiting","returned"].includes(t.status) : t.status === filter)); }).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)), [tasks,search,filter]); const filters: Array<[TaskStatus|"all"|"attention",string]> = [["all","الكل"],["new","جديد"],["active","قيد التنفيذ"],["review","بانتظار الاعتماد"],["attention","تحتاج متابعة"],["done","مكتمل"]]; return <div className="space-y-5"><div className="flex items-end justify-between"><div><div className="text-[10px] tracking-[.2em] text-cyan-300/50">TASK MATRIX</div><h1 className="mt-2 text-2xl font-black">التكليفات</h1></div>{canCreate && <button onClick={onCreate} className="flex h-11 items-center gap-2 rounded-xl bg-cyan-300 px-5 text-xs font-black text-slate-950"><Plus size={16} />إصدار تكليف</button>}</div><div className="tech-panel p-4"><div className="flex flex-col gap-3 lg:flex-row"><input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="بحث سريع..." className="tech-field flex-1" /><div className="flex gap-2 overflow-x-auto">{filters.map(([k,l]) => <button key={k} onClick={() => onFilter(k)} className={`shrink-0 rounded-xl border px-3 py-2 text-[11px] font-bold ${filter === k ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200" : "border-white/8 bg-white/3 text-slate-500"}`}>{l}</button>)}</div></div></div><div className="tech-panel divide-y divide-white/7">{list.length ? list.map((t) => <TaskRow key={t.id} task={t} onOpen={onOpen} />) : <div className="p-10 text-center text-xs text-slate-600">لا توجد تكليفات مطابقة.</div>}</div></div>; }

function CreateDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (v: { title: string; details: string; departmentId: string; priority: Priority }) => void }) { const [title,setTitle]=useState(""); const [details,setDetails]=useState(""); const [departmentId,setDepartmentId]=useState(departments[0].id); const [priority,setPriority]=useState<Priority>("normal"); return <div className="fixed inset-0 z-[80] grid place-items-center bg-[#020611]/80 p-4 backdrop-blur-md"><div className="tech-panel w-full max-w-xl p-6"><div className="flex justify-between"><h2 className="text-xl font-black">إصدار تكليف جديد</h2><button onClick={onClose}><X size={17} /></button></div><div className="mt-6 space-y-4"><label><span className="mb-2 block text-[9px] text-slate-500">عنوان التكليف</span><input value={title} onChange={(e)=>setTitle(e.target.value)} className="tech-field" /></label><div className="grid gap-3 sm:grid-cols-2"><select value={departmentId} onChange={(e)=>setDepartmentId(e.target.value)} className="tech-field">{departments.map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select><select value={priority} onChange={(e)=>setPriority(e.target.value as Priority)} className="tech-field"><option value="normal">عادي</option><option value="important">مهم</option><option value="urgent">عاجل</option></select></div><textarea value={details} onChange={(e)=>setDetails(e.target.value)} rows={4} className="tech-field resize-none" placeholder="التفاصيل..." /></div><div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="px-4 text-xs text-slate-500">إلغاء</button><button disabled={title.trim().length<3} onClick={()=>title.trim().length>=3&&onCreate({title,details,departmentId,priority})} className="flex h-11 items-center gap-2 rounded-xl bg-cyan-300 px-5 text-xs font-black text-slate-950 disabled:opacity-30"><Send size={14} />إصدار التكليف</button></div></div></div>; }
function MobileNav({ view, canCreate, onView, onCreate }: { view: View; canCreate: boolean; onView: (v: View) => void; onCreate: () => void }) { return <div className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-[22px] border border-white/10 bg-[#0b1524]/95 p-2 shadow-2xl backdrop-blur md:hidden"><button onClick={()=>onView("overview")} className={view==="overview"?"text-cyan-300":"text-slate-600"}><LayoutDashboard size={19}/></button><button onClick={()=>onView("tasks")} className={view==="tasks"?"text-cyan-300":"text-slate-600"}><ClipboardCheck size={19}/></button>{canCreate&&<button onClick={onCreate} className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300 text-slate-950"><Plus size={21}/></button>}<button onClick={()=>onView("reports")} className={view==="reports"?"text-cyan-300":"text-slate-600"}><FileSpreadsheet size={19}/></button></div>; }
function MobileDrawer({ view, user, onClose, onView, onCreate }: { view: View; user: DemoUser; onClose: () => void; onView: (v: View) => void; onCreate: () => void }) { return <div className="fixed inset-0 z-[70] bg-[#020611]/80 md:hidden"><div className="h-full w-[84%] max-w-sm border-l border-white/10 bg-[#08111f] p-5"><div className="flex justify-between"><Brand/><button onClick={onClose}><X size={18}/></button></div><div className="mt-8 h-[calc(100%-80px)]"><Sidebar view={view} user={user} onView={onView} onCreate={onCreate}/></div></div></div>; }
