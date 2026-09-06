import { useEffect, useMemo, useState } from "react";
import { Activity, Bell, BriefcaseBusiness, ChevronDown, FileSpreadsheet, Gauge, LayoutDashboard, ListTodo, LogOut, Menu, Plus, Radar, Search, Send, UserRound, X, Zap } from "lucide-react";
import { STORAGE_KEY, departments, makeSeedState, users, type AppState, type Assignment, type DemoUser, type Priority, type TaskStatus, type UpdateEntry, type View, type WorkType } from "../v2/model";
import LoginScreen, { DEMO_ACCOUNTS } from "../v4/LoginScreen";
import NotificationsPanel from "../v4/NotificationsPanel";
import TaskDetail from "../v4/TaskDetail";
import Reports from "../v4/Reports";

const SESSION_KEY = "command-center-demo-session";
const nowIso = () => new Date().toISOString();
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const kindOf = (item: Assignment): WorkType => item.kind ?? "task";

function loadState(): AppState {
  const seed = makeSeedState();
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      currentUserId: users.some((u) => u.id === parsed.currentUserId) ? parsed.currentUserId! : seed.currentUserId,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map((t) => ({ ...t, kind: t.kind ?? "task", details: t.details ?? "", updates: Array.isArray(t.updates) ? t.updates : [], updatedAt: t.updatedAt ?? t.createdAt ?? nowIso() })) : seed.tasks,
      notices: Array.isArray(parsed.notices) ? parsed.notices : seed.notices,
    };
  } catch { return seed; }
}

function visibleTo(user: DemoUser, item: Assignment) { return user.role === "boss" || user.departmentId === item.departmentId; }

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workType, setWorkType] = useState<WorkType>("project");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all" | "attention">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<WorkType>("task");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? users[0];
  const allItems = useMemo(() => state.tasks.filter((t) => visibleTo(currentUser, t)), [state.tasks, currentUser]);
  const selected = selectedId ? allItems.find((t) => t.id === selectedId) ?? null : null;
  const notices = state.notices.filter((n) => n.userId === currentUser.id).sort((a, b) => b.at.localeCompare(a.at));
  const unread = notices.filter((n) => !n.read).length;

  function notify(userId: string, text: string, itemId?: string) {
    setState((s) => ({ ...s, notices: [{ id: uid(), userId, taskId: itemId, text, at: nowIso(), read: false }, ...s.notices] }));
  }
  function markRead(id: string) { setState((s) => ({ ...s, notices: s.notices.map((n) => n.id === id ? { ...n, read: true } : n) })); }
  function markAllRead() { setState((s) => ({ ...s, notices: s.notices.map((n) => n.userId === currentUser.id ? { ...n, read: true } : n) })); }
  function openNotice(notice: AppState["notices"][number]) {
    markRead(notice.id);
    if (notice.taskId) {
      const target = allItems.find((t) => t.id === notice.taskId);
      if (target) { setSelectedId(target.id); setWorkType(kindOf(target)); setView("tasks"); }
    }
    setNoticeOpen(false);
  }

  function openCreate(kind: WorkType) {
    setCreateKind(kind);
    setCreateOpen(true);
  }

  function createItem(input: { title: string; details: string; departmentId: string; priority: Priority; kind: WorkType }) {
    const at = nowIso();
    const owner = users.find((u) => u.role === "head" && u.departmentId === input.departmentId);
    const isProject = input.kind === "project";
    const item: Assignment = {
      id: uid(),
      number: `${isProject ? "PR" : "TS"}-${String(3000 + state.tasks.length + 1)}`,
      kind: input.kind,
      title: input.title.trim(),
      details: input.details.trim(),
      departmentId: input.departmentId,
      priority: input.priority,
      status: "new",
      createdAt: at,
      updatedAt: at,
      issuedById: currentUser.id,
      ownerId: owner?.id,
      updates: [{ id: uid(), authorId: currentUser.id, text: `تم إنشاء ${isProject ? "المشروع" : "المهمة"} وإحالته إلى القسم المسؤول.`, at, system: true }],
    };
    setState((s) => ({ ...s, tasks: [item, ...s.tasks] }));
    users.filter((u) => u.departmentId === input.departmentId).forEach((u) => notify(u.id, `${isProject ? "مشروع" : "مهمة"} جديدة: ${item.title}`, item.id));
    setCreateOpen(false);
    setWorkType(input.kind);
    setView("tasks");
    setSelectedId(item.id);
  }

  function updateItem(item: Assignment, text: string, status?: TaskStatus, attachment?: string) {
    const at = nowIso();
    const entry: UpdateEntry = { id: uid(), authorId: currentUser.id, text, at, status, attachment };
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => t.id === item.id ? { ...t, status: status ?? t.status, updatedAt: at, updates: [...t.updates, entry] } : t) }));
    const label = kindOf(item) === "project" ? "المشروع" : "المهمة";
    if (currentUser.role === "boss") users.filter((u) => u.departmentId === item.departmentId).forEach((u) => notify(u.id, `تحديث إداري على ${label}: ${item.title}`, item.id));
    else notify("boss", `تحديث جديد على ${label}: ${item.title}`, item.id);
  }

  return (
    <div className="tech-shell min-h-screen text-slate-100">
      <div className="pointer-events-none fixed inset-0 tech-grid opacity-35" />
      <Header currentUser={currentUser} search={search} onSearch={(value) => { setSearch(value); setView("tasks"); }} unread={unread} noticeOpen={noticeOpen} userOpen={userOpen} onToggleNotice={() => { setNoticeOpen((v) => !v); setUserOpen(false); }} onToggleUser={() => { setUserOpen((v) => !v); setNoticeOpen(false); }} notices={notices} onOpenNotice={openNotice} onReadAll={markAllRead} onLogout={onLogout} onMobile={() => setMobileOpen(true)} />

      <div className="relative z-10 mx-auto flex max-w-[1560px]">
        <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] w-64 shrink-0 border-l border-white/8 p-5 md:block"><Sidebar view={view} user={currentUser} onView={(v) => { setView(v); setSelectedId(null); }} onWork={(kind) => { setWorkType(kind); setView("tasks"); setSelectedId(null); }} onCreate={openCreate} /></aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-7 md:py-8">
          {selected ? <TaskDetail task={selected} currentUser={currentUser} onBack={() => setSelectedId(null)} onUpdate={updateItem} onTransition={(item, status, text) => updateItem(item, text, status)} /> : view === "overview" ? <Overview items={allItems} user={currentUser} onOpen={(item) => { setWorkType(kindOf(item)); setSelectedId(item.id); }} onWork={(kind) => { setWorkType(kind); setView("tasks"); }} onCreate={openCreate} /> : view === "tasks" ? <WorkList items={allItems} kind={workType} search={search} statusFilter={statusFilter} onSearch={setSearch} onStatusFilter={setStatusFilter} onKind={setWorkType} onOpen={setSelectedId} onCreate={openCreate} canCreate={currentUser.role === "boss"} /> : <Reports tasks={allItems} user={currentUser} />}
        </main>
      </div>

      <MobileNav view={view} workType={workType} canCreate={currentUser.role === "boss"} onView={(v) => { setView(v); setSelectedId(null); }} onWork={(kind) => { setWorkType(kind); setView("tasks"); setSelectedId(null); }} onCreate={() => openCreate(workType)} />
      {mobileOpen && <MobileDrawer view={view} user={currentUser} onClose={() => setMobileOpen(false)} onView={(v) => { setView(v); setSelectedId(null); setMobileOpen(false); }} onWork={(kind) => { setWorkType(kind); setView("tasks"); setSelectedId(null); setMobileOpen(false); }} onCreate={(kind) => { openCreate(kind); setMobileOpen(false); }} />}
      {createOpen && <CreateDialog defaultKind={createKind} onClose={() => setCreateOpen(false)} onCreate={createItem} />}
    </div>
  );
}

function Header({ currentUser, search, onSearch, unread, noticeOpen, userOpen, onToggleNotice, onToggleUser, notices, onOpenNotice, onReadAll, onLogout, onMobile }: { currentUser: DemoUser; search: string; onSearch: (v: string) => void; unread: number; noticeOpen: boolean; userOpen: boolean; onToggleNotice: () => void; onToggleUser: () => void; notices: AppState["notices"]; onOpenNotice: (n: AppState["notices"][number]) => void; onReadAll: () => void; onLogout: () => void; onMobile: () => void }) {
  return <header className="sticky top-0 z-50 border-b border-white/10 bg-[#08111f]/85 backdrop-blur-2xl"><div className="mx-auto flex h-[72px] max-w-[1560px] items-center gap-4 px-4 md:px-7"><button type="button" onClick={onMobile} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 md:hidden"><Menu size={20} /></button><Brand /><div className="hidden h-8 w-px bg-white/10 md:block" /><div className="hidden flex-1 md:block"><div className="relative max-w-xl"><Search size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="بحث في المشاريع والمهام..." className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pr-11 pl-4 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-400/40" /></div></div><div className="mr-auto flex items-center gap-2"><div className="relative"><button type="button" onClick={onToggleNotice} className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300"><Bell size={17} />{unread > 0 && <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-cyan-400 px-1 text-[9px] font-black text-slate-950">{unread}</span>}</button>{noticeOpen && <NotificationsPanel notices={notices} onOpen={onOpenNotice} onReadAll={onReadAll} />}</div><div className="relative"><button type="button" onClick={onToggleUser} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-1.5 pr-2 pl-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-950"><UserRound size={17} /></span><span className="hidden text-right sm:block"><span className="block text-xs font-black">{currentUser.name}</span><span className="block text-[9px] text-cyan-300/60">{currentUser.title}</span></span><ChevronDown size={14} className="text-slate-500" /></button>{userOpen && <div className="absolute left-0 top-14 z-50 w-64 rounded-2xl border border-white/10 bg-[#0c1726] p-2 shadow-2xl"><div className="px-3 py-3"><div className="text-xs font-black">{currentUser.name}</div><div className="mt-1 text-[10px] text-slate-600">{currentUser.title}</div></div><div className="h-px bg-white/7" /><button type="button" onClick={onLogout} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-400/7"><LogOut size={14} />تسجيل الخروج</button></div>}</div></div></div></header>;
}

function Brand() { return <div className="flex shrink-0 items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-[14px] border border-cyan-300/30 bg-cyan-300/10 text-cyan-300"><Radar size={20} /></div><div><div className="text-sm font-black">مركز المشاريع والمهام</div><div className="mt-0.5 text-[9px] font-bold tracking-[0.2em] text-cyan-300/60">OPERATIONS COMMAND</div></div></div>; }

function Sidebar({ view, user, onView, onWork, onCreate }: { view: View; user: DemoUser; onView: (v: View) => void; onWork: (kind: WorkType) => void; onCreate: (kind: WorkType) => void }) {
  return <div className="flex h-full flex-col"><nav className="space-y-2"><button type="button" onClick={() => onView("overview")} className={`nav-btn ${view === "overview" ? "nav-btn-active" : ""}`}><Gauge size={18} />الرئيسية</button><button type="button" onClick={() => onWork("project")} className="nav-btn"><BriefcaseBusiness size={18} />المشاريع</button><button type="button" onClick={() => onWork("task")} className="nav-btn"><ListTodo size={18} />المهام</button><button type="button" onClick={() => onView("reports")} className={`nav-btn ${view === "reports" ? "nav-btn-active" : ""}`}><FileSpreadsheet size={18} />التقارير</button></nav>{user.role === "boss" && <div className="mt-6 grid grid-cols-2 gap-2"><button type="button" onClick={() => onCreate("project")} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-[10px] font-bold text-slate-300 hover:bg-white/5">+ مشروع</button><button type="button" onClick={() => onCreate("task")} className="rounded-xl bg-cyan-300 px-3 py-2.5 text-[10px] font-black text-slate-950">+ مهمة</button></div>}</div>;
}

function Overview({ items, user, onOpen, onWork, onCreate }: { items: Assignment[]; user: DemoUser; onOpen: (item: Assignment) => void; onWork: (kind: WorkType) => void; onCreate: (kind: WorkType) => void }) {
  const projects = items.filter((i) => kindOf(i) === "project");
  const tasks = items.filter((i) => kindOf(i) === "task");
  const active = items.filter((i) => i.status === "active").length;
  const review = items.filter((i) => i.status === "review").length;
  const recent = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
  return <div className="space-y-6"><section className="tech-panel p-6 md:p-8"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-[10px] font-black text-cyan-300"><Activity size={12} />OPERATIONS CENTER</div><h1 className="text-2xl font-black md:text-4xl">المشاريع والمهام</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">مكان واحد لإدارة العمل اليومي: المشاريع الأكبر والمهام المباشرة، بنفس أسلوب المتابعة والاعتماد.</p></div>{user.role === "boss" && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onCreate("project")} className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-bold"><BriefcaseBusiness size={15} />مشروع جديد</button><button type="button" onClick={() => onCreate("task")} className="flex h-11 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-black text-slate-950"><Zap size={15} />مهمة جديدة</button></div>}</div></section><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="المشاريع" value={projects.length} onClick={() => onWork("project")} /><Metric label="المهام" value={tasks.length} onClick={() => onWork("task")} /><Metric label="قيد التنفيذ" value={active} /><Metric label="بانتظار الاعتماد" value={review} /></div><section className="tech-panel overflow-hidden"><div className="border-b border-white/7 px-5 py-4"><h2 className="text-sm font-black">آخر الأعمال</h2></div><div className="divide-y divide-white/7">{recent.map((item) => <button key={item.id} type="button" onClick={() => onOpen(item)} className="flex w-full items-center gap-3 px-5 py-4 text-right hover:bg-white/[0.03]"><span className="min-w-0 flex-1 truncate text-sm font-bold">{item.title}</span><span className="text-[9px] font-bold text-slate-600">{kindOf(item) === "project" ? "مشروع" : "مهمة"}</span></button>)}</div></section></div>;
}

function Metric({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return <Tag {...(onClick ? { type: "button", onClick } : {})} className="tech-panel w-full p-5 text-right"><div className="font-mono text-3xl font-black">{String(value).padStart(2, "0")}</div><div className="mt-1 text-[11px] font-bold text-slate-500">{label}</div><div className="mt-5 h-px bg-gradient-to-l from-cyan-300/20 to-transparent" /></Tag>;
}

function WorkList({ items, kind, search, statusFilter, onSearch, onStatusFilter, onKind, onOpen, onCreate, canCreate }: { items: Assignment[]; kind: WorkType; search: string; statusFilter: TaskStatus | "all" | "attention"; onSearch: (v: string) => void; onStatusFilter: (v: TaskStatus | "all" | "attention") => void; onKind: (kind: WorkType) => void; onOpen: (id: string) => void; onCreate: (kind: WorkType) => void; canCreate: boolean }) {
  const list = useMemo(() => items.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchesText = !q || `${item.title} ${item.details} ${item.number}`.toLowerCase().includes(q);
    const matchesKind = kindOf(item) === kind;
    const matchesStatus = statusFilter === "all" || (statusFilter === "attention" ? ["waiting", "returned"].includes(item.status) : item.status === statusFilter);
    return matchesText && matchesKind && matchesStatus;
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [items, kind, search, statusFilter]);

  const filters: Array<[TaskStatus | "all" | "attention", string]> = [["all", "الكل"], ["new", "جديد"], ["active", "قيد التنفيذ"], ["review", "للاعتماد"], ["attention", "تحتاج متابعة"], ["done", "مكتمل"]];
  const title = kind === "project" ? "المشاريع" : "المهام";
  const singular = kind === "project" ? "مشروع" : "مهمة";

  return <div className="mx-auto max-w-4xl space-y-5"><div className="flex items-center justify-between gap-4"><div><h1 className="text-2xl font-black">{title}</h1><p className="mt-1 text-[11px] text-slate-500">اختر {singular === "مشروع" ? "المشروع" : "المهمة"} لعرض التفاصيل والمتابعة.</p></div>{canCreate && <button type="button" onClick={() => onCreate(kind)} className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-[11px] font-black text-slate-950"><Plus size={15} />{singular} جديد</button>}</div><div className="inline-flex rounded-xl border border-white/8 bg-white/[0.025] p-1"><button type="button" onClick={() => onKind("project")} className={`rounded-lg px-5 py-2 text-[11px] font-bold ${kind === "project" ? "bg-white text-slate-950" : "text-slate-500"}`}>المشاريع</button><button type="button" onClick={() => onKind("task")} className={`rounded-lg px-5 py-2 text-[11px] font-bold ${kind === "task" ? "bg-white text-slate-950" : "text-slate-500"}`}>المهام</button></div><div className="space-y-3"><div className="relative"><Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" /><input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={`ابحث في ${title}...`} className="h-12 w-full rounded-2xl border border-white/8 bg-white/[0.025] pr-11 pl-4 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300/20" /></div><div className="flex gap-2 overflow-x-auto pb-1">{filters.map(([key, label]) => <button key={key} type="button" onClick={() => onStatusFilter(key)} className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-bold ${statusFilter === key ? "bg-cyan-300 text-slate-950" : "text-slate-500 hover:bg-white/5"}`}>{label}</button>)}</div></div><div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]"><div className="divide-y divide-white/7">{list.length ? list.map((item) => <button key={item.id} type="button" onClick={() => onOpen(item.id)} className="block w-full px-5 py-4 text-right transition hover:bg-white/[0.035]"><div className="truncate text-[15px] font-bold leading-7 text-slate-100">{item.title}</div></button>) : <div className="p-10 text-center text-xs text-slate-600">لا توجد نتائج.</div>}</div></div></div>;
}

function CreateDialog({ defaultKind, onClose, onCreate }: { defaultKind: WorkType; onClose: () => void; onCreate: (v: { title: string; details: string; departmentId: string; priority: Priority; kind: WorkType }) => void }) {
  const [kind, setKind] = useState<WorkType>(defaultKind);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [departmentId, setDepartmentId] = useState(departments[0].id);
  const [priority, setPriority] = useState<Priority>("normal");
  const label = kind === "project" ? "مشروع" : "مهمة";
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-[#020611]/80 p-4 backdrop-blur-md"><div className="tech-panel w-full max-w-xl p-6"><div className="flex justify-between"><div><h2 className="text-xl font-black">إنشاء {label} جديد</h2><p className="mt-1 text-[10px] text-slate-500">نفس المتابعة والحالات والاعتماد لكلا النوعين.</p></div><button type="button" onClick={onClose}><X size={17} /></button></div><div className="mt-6 space-y-4"><div className="grid grid-cols-2 gap-2 rounded-xl border border-white/8 bg-black/10 p-1"><button type="button" onClick={() => setKind("project")} className={`rounded-lg py-2.5 text-xs font-bold ${kind === "project" ? "bg-white text-slate-950" : "text-slate-500"}`}>مشروع</button><button type="button" onClick={() => setKind("task")} className={`rounded-lg py-2.5 text-xs font-bold ${kind === "task" ? "bg-white text-slate-950" : "text-slate-500"}`}>مهمة</button></div><label><span className="mb-2 block text-[9px] text-slate-500">اسم {label}</span><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="tech-field" /></label><div className="grid gap-3 sm:grid-cols-2"><select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="tech-field">{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="tech-field"><option value="normal">عادي</option><option value="important">مهم</option><option value="urgent">عاجل</option></select></div><textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} className="tech-field resize-none" placeholder="التفاصيل..." /></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 text-xs text-slate-500">إلغاء</button><button type="button" disabled={title.trim().length < 3} onClick={() => title.trim().length >= 3 && onCreate({ title, details, departmentId, priority, kind })} className="flex h-11 items-center gap-2 rounded-xl bg-cyan-300 px-5 text-xs font-black text-slate-950 disabled:opacity-30"><Send size={14} />إنشاء {label}</button></div></div></div>;
}

function MobileNav({ view, workType, canCreate, onView, onWork, onCreate }: { view: View; workType: WorkType; canCreate: boolean; onView: (v: View) => void; onWork: (kind: WorkType) => void; onCreate: () => void }) {
  return <div className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-[22px] border border-white/10 bg-[#0b1524]/95 p-2 shadow-2xl backdrop-blur md:hidden"><button type="button" onClick={() => onView("overview")} className={view === "overview" ? "text-cyan-300" : "text-slate-600"}><LayoutDashboard size={19} /></button><button type="button" onClick={() => onWork("project")} className={view === "tasks" && workType === "project" ? "text-cyan-300" : "text-slate-600"}><BriefcaseBusiness size={19} /></button>{canCreate && <button type="button" onClick={onCreate} className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300 text-slate-950"><Plus size={21} /></button>}<button type="button" onClick={() => onWork("task")} className={view === "tasks" && workType === "task" ? "text-cyan-300" : "text-slate-600"}><ListTodo size={19} /></button><button type="button" onClick={() => onView("reports")} className={view === "reports" ? "text-cyan-300" : "text-slate-600"}><FileSpreadsheet size={19} /></button></div>;
}

function MobileDrawer({ view, user, onClose, onView, onWork, onCreate }: { view: View; user: DemoUser; onClose: () => void; onView: (v: View) => void; onWork: (kind: WorkType) => void; onCreate: (kind: WorkType) => void }) {
  return <div className="fixed inset-0 z-[70] bg-[#020611]/80 md:hidden"><div className="h-full w-[84%] max-w-sm border-l border-white/10 bg-[#08111f] p-5"><div className="flex justify-between"><Brand /><button type="button" onClick={onClose}><X size={18} /></button></div><div className="mt-8 h-[calc(100%-80px)]"><Sidebar view={view} user={user} onView={onView} onWork={onWork} onCreate={onCreate} /></div></div></div>;
}
