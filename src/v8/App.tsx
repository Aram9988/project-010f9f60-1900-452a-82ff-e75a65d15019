import { useEffect, useMemo, useState } from "react";
import { Activity, Bell, BriefcaseBusiness, ChevronDown, FileSpreadsheet, Gauge, LayoutDashboard, ListTodo, LogOut, Menu, Network, Plus, Radar, Search, Send, Settings2, UserRound, X, Zap } from "lucide-react";
import { STORAGE_KEY, makeSeedState, statusMeta, type AppState, type Assignment, type Priority, type TaskStatus, type UpdateEntry, type WorkType } from "../v2/model";
import NotificationsPanel from "../v4/NotificationsPanel";
import PrivateWorkspace from "../v7/PrivateWorkspace";
import OrganizationAdmin from "./OrganizationAdmin";
import TeamTree from "./TeamTree";
import WorkDetail from "./WorkDetail";
import Reports from "./Reports";
import LoginScreen from "./LoginScreen";
import { descendants, hasPermission, loadOrgState, roleOf, saveOrgState, teamUserIds, type OrgState, type OrgUser } from "./orgModel";

const SESSION_KEY = "command-center-demo-session";
const nowIso = () => new Date().toISOString();
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const kindOf = (item: Assignment): WorkType => item.kind ?? "task";
type Page = "overview" | "projects" | "tasks" | "tree" | "reports" | "admin";

function loadAppState(): AppState {
  const seed = makeSeedState();
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      currentUserId: parsed.currentUserId || seed.currentUserId,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map((t) => ({ ...t, kind: t.kind ?? "task", assigneeId: t.assigneeId ?? t.ownerId, updates: Array.isArray(t.updates) ? t.updates : [], updatedAt: t.updatedAt ?? t.createdAt ?? nowIso() })) : seed.tasks,
      notices: Array.isArray(parsed.notices) ? parsed.notices : seed.notices,
    };
  } catch { return seed; }
}

export default function App() {
  const [org, setOrg] = useState<OrgState>(() => loadOrgState());
  const [app, setApp] = useState<AppState>(() => loadAppState());
  const [sessionUserId, setSessionUserId] = useState<string | null>(() => typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null);

  useEffect(() => saveOrgState(org), [org]);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(app)), [app]);

  const login = (userId: string) => {
    sessionStorage.setItem(SESSION_KEY, userId);
    setSessionUserId(userId);
    setApp((s) => ({ ...s, currentUserId: userId }));
  };
  const logout = () => { sessionStorage.removeItem(SESSION_KEY); setSessionUserId(null); };

  const currentUser = sessionUserId ? org.users.find((u) => u.id === sessionUserId && u.active) : undefined;
  if (!currentUser) return <LoginScreen org={org} onLogin={login} />;

  return <Shell org={org} setOrg={setOrg} app={app} setApp={setApp} currentUser={currentUser} onLogout={logout} />;
}

function Shell({ org, setOrg, app, setApp, currentUser, onLogout }: { org: OrgState; setOrg: (s: OrgState) => void; app: AppState; setApp: React.Dispatch<React.SetStateAction<AppState>>; currentUser: OrgUser; onLogout: () => void }) {
  const [page, setPage] = useState<Page>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [createKind, setCreateKind] = useState<WorkType | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentRole = roleOf(org, currentUser);
  const items = useMemo(() => visibleItems(org, currentUser, app.tasks), [org, currentUser, app.tasks]);
  const selected = selectedId ? items.find((i) => i.id === selectedId) ?? null : null;
  const notices = app.notices.filter((n) => n.userId === currentUser.id).sort((a, b) => b.at.localeCompare(a.at));
  const unread = notices.filter((n) => !n.read).length;
  const canTree = hasPermission(org, currentUser, "view_all_tree") || hasPermission(org, currentUser, "view_team_tree");
  const canAdmin = hasPermission(org, currentUser, "manage_structure") || hasPermission(org, currentUser, "manage_users") || hasPermission(org, currentUser, "manage_roles");
  const canProjects = hasPermission(org, currentUser, "create_projects") || items.some((i) => kindOf(i) === "project");
  const canTasks = hasPermission(org, currentUser, "create_tasks") || items.some((i) => kindOf(i) === "task");
  const canReports = hasPermission(org, currentUser, "view_reports");

  function notify(userId: string, text: string, itemId?: string) {
    setApp((s) => ({ ...s, notices: [{ id: uid(), userId, taskId: itemId, text, at: nowIso(), read: false }, ...s.notices] }));
  }

  function createItem(input: NewItemInput) {
    const at = nowIso();
    const assignee = org.users.find((u) => u.id === input.assigneeId);
    const departmentId = assignee?.departmentId || input.departmentId || currentUser.departmentId || org.departments[0]?.id || "";
    const department = org.departments.find((d) => d.id === departmentId);
    const ownerId = department?.headUserId || currentUser.id;
    const item: Assignment = {
      id: uid(),
      number: `${input.kind === "project" ? "PR" : "TS"}-${String(3000 + app.tasks.length + 1)}`,
      kind: input.kind,
      title: input.title.trim(),
      details: input.details.trim(),
      departmentId,
      priority: input.priority,
      status: "new",
      location: input.location.trim(),
      referenceNumber: input.referenceNumber.trim(),
      parentProjectId: input.kind === "task" ? input.parentProjectId || undefined : undefined,
      issuedById: currentUser.id,
      ownerId,
      assigneeId: input.assigneeId || ownerId,
      createdAt: at,
      updatedAt: at,
      updates: [{ id: uid(), authorId: currentUser.id, text: `تم إنشاء ${input.kind === "project" ? "المشروع" : "المهمة"} وإسناده إلى ${org.users.find((u) => u.id === (input.assigneeId || ownerId))?.name ?? "المسؤول"}.`, at, system: true }],
    };
    setApp((s) => ({ ...s, tasks: [item, ...s.tasks] }));
    if (item.assigneeId && item.assigneeId !== currentUser.id) notify(item.assigneeId, `${input.kind === "project" ? "مشروع" : "مهمة"} جديدة: ${item.title}`, item.id);
    if (ownerId && ownerId !== item.assigneeId && ownerId !== currentUser.id) notify(ownerId, `تم إنشاء عمل جديد ضمن قسمك: ${item.title}`, item.id);
    setCreateKind(null);
    setPage(input.kind === "project" ? "projects" : "tasks");
    setSelectedId(item.id);
  }

  function updateItem(item: Assignment, text: string, status?: TaskStatus, attachment?: string) {
    const at = nowIso();
    const update: UpdateEntry = { id: uid(), authorId: currentUser.id, text, at, status, attachment };
    setApp((s) => ({ ...s, tasks: s.tasks.map((x) => x.id === item.id ? { ...x, status: status ?? x.status, updatedAt: at, updates: [...x.updates, update] } : x) }));
    const branchHead = org.users.find((u) => roleOf(org, u)?.key === "branch_head");
    if (branchHead && branchHead.id !== currentUser.id) notify(branchHead.id, `تحديث على: ${item.title}`, item.id);
  }

  function assignItem(item: Assignment, assigneeId: string) {
    const assignee = org.users.find((u) => u.id === assigneeId);
    if (!assignee) return;
    const at = nowIso();
    setApp((s) => ({ ...s, tasks: s.tasks.map((x) => x.id === item.id ? { ...x, assigneeId, departmentId: assignee.departmentId ?? x.departmentId, updatedAt: at, updates: [...x.updates, { id: uid(), authorId: currentUser.id, text: `تم إسناد المهمة إلى ${assignee.name}.`, at, system: true }] } : x) }));
    notify(assigneeId, `تم إسناد مهمة إليك: ${item.title}`, item.id);
  }

  function markNoticeRead(id: string) { setApp((s) => ({ ...s, notices: s.notices.map((n) => n.id === id ? { ...n, read: true } : n) })); }
  function openNotice(n: AppState["notices"][number]) { markNoticeRead(n.id); if (n.taskId) { setSelectedId(n.taskId); const item = app.tasks.find((i) => i.id === n.taskId); setPage(item?.kind === "project" ? "projects" : "tasks"); } setNoticeOpen(false); }
  function markAllRead() { setApp((s) => ({ ...s, notices: s.notices.map((n) => n.userId === currentUser.id ? { ...n, read: true } : n) })); }

  const privateWorkspaceAllowed = currentRole?.key === "branch_head" || currentUser.departmentId === "studies";

  return <div className="tech-shell min-h-screen text-slate-100"><div className="pointer-events-none fixed inset-0 tech-grid opacity-35" /><Header org={org} user={currentUser} unread={unread} noticeOpen={noticeOpen} userOpen={userOpen} search={search} onSearch={(v) => { setSearch(v); if (page !== "projects" && page !== "tasks") setPage("tasks"); }} onToggleNotice={() => { setNoticeOpen((v) => !v); setUserOpen(false); }} onToggleUser={() => { setUserOpen((v) => !v); setNoticeOpen(false); }} notices={notices} onOpenNotice={openNotice} onReadAll={markAllRead} onLogout={onLogout} onMobile={() => setMobileOpen(true)} /><div className="relative z-10 mx-auto flex max-w-[1600px]"><aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] w-64 shrink-0 border-l border-white/8 p-5 md:block"><Sidebar page={page} canProjects={canProjects} canTasks={canTasks} canTree={canTree} canReports={canReports} canAdmin={canAdmin} canCreateProject={hasPermission(org, currentUser, "create_projects")} canCreateTask={hasPermission(org, currentUser, "create_tasks")} onPage={(p) => { setPage(p); setSelectedId(null); }} onCreate={setCreateKind} /></aside><main className="min-w-0 flex-1 px-4 py-6 md:px-7 md:py-8">{selected ? <WorkDetail item={selected} allItems={items} org={org} currentUser={currentUser} onBack={() => setSelectedId(null)} onOpenItem={setSelectedId} onAssign={assignItem} onUpdate={updateItem} onTransition={(item, status, text) => updateItem(item, text, status)} /> : page === "overview" ? <Overview org={org} user={currentUser} items={items} onOpen={(i) => { setSelectedId(i.id); setPage(i.kind === "project" ? "projects" : "tasks"); }} onPage={setPage} /> : page === "projects" || page === "tasks" ? <WorkList org={org} currentUser={currentUser} items={items} kind={page === "projects" ? "project" : "task"} search={search} status={statusFilter} onSearch={setSearch} onStatus={setStatusFilter} onOpen={setSelectedId} onCreate={setCreateKind} /> : page === "tree" ? <TeamTree state={org} items={app.tasks} currentUserId={currentUser.id} onOpenItem={(id) => { setSelectedId(id); const item = app.tasks.find((i) => i.id === id); setPage(item?.kind === "project" ? "projects" : "tasks"); }} /> : page === "reports" ? <Reports items={items} org={org} currentUser={currentUser} /> : <OrganizationAdmin state={org} onChange={setOrg} />}</main></div><MobileNav page={page} canTree={canTree} canReports={canReports} onPage={(p) => { setPage(p); setSelectedId(null); }} />{mobileOpen && <MobileDrawer page={page} canProjects={canProjects} canTasks={canTasks} canTree={canTree} canReports={canReports} canAdmin={canAdmin} onClose={() => setMobileOpen(false)} onPage={(p) => { setPage(p); setSelectedId(null); setMobileOpen(false); }} />}{createKind && <CreateDialog kind={createKind} org={org} currentUser={currentUser} projects={items.filter((i) => i.kind === "project")} onClose={() => setCreateKind(null)} onCreate={createItem} />}{privateWorkspaceAllowed && <PrivateWorkspace currentUser={{ id: currentUser.id, label: currentUser.name }} />}</div>;
}

function visibleItems(org: OrgState, user: OrgUser, items: Assignment[]) {
  if (hasPermission(org, user, "view_all_tree")) return items;
  const role = roleOf(org, user);
  if (role?.key === "department_head" && user.departmentId) return items.filter((i) => i.departmentId === user.departmentId);
  if (hasPermission(org, user, "view_team_tree")) {
    const ids = teamUserIds(org, user);
    return items.filter((i) => ids.has(i.assigneeId ?? "") || i.ownerId === user.id || i.issuedById === user.id);
  }
  if (role?.key === "diwan") return [];
  return items.filter((i) => i.assigneeId === user.id || i.ownerId === user.id);
}

function assignableUsers(org: OrgState, currentUser: OrgUser) {
  if (hasPermission(org, currentUser, "assign_department_tasks")) return org.users.filter((u) => u.active && roleOf(org, u)?.key !== "branch_head");
  if (hasPermission(org, currentUser, "assign_team_tasks")) {
    const ids = new Set([currentUser.id, ...descendants(org, currentUser.id).map((u) => u.id)]);
    return org.users.filter((u) => u.active && ids.has(u.id));
  }
  return [currentUser];
}

type NewItemInput = { kind: WorkType; title: string; details: string; departmentId: string; assigneeId: string; priority: Priority; location: string; referenceNumber: string; parentProjectId?: string };

function CreateDialog({ kind, org, currentUser, projects, onClose, onCreate }: { kind: WorkType; org: OrgState; currentUser: OrgUser; projects: Assignment[]; onClose: () => void; onCreate: (input: NewItemInput) => void }) {
  const assignable = assignableUsers(org, currentUser);
  const initialDept = currentUser.departmentId || org.departments[0]?.id || "";
  const [title, setTitle] = useState(""); const [details, setDetails] = useState(""); const [departmentId, setDepartmentId] = useState(initialDept); const [assigneeId, setAssigneeId] = useState(""); const [priority, setPriority] = useState<Priority>("normal"); const [location, setLocation] = useState(""); const [referenceNumber, setReferenceNumber] = useState(""); const [parentProjectId, setParentProjectId] = useState("");
  const allowedDepartments = hasPermission(org, currentUser, "assign_department_tasks") ? org.departments : org.departments.filter((d) => d.id === currentUser.departmentId);
  return <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-[#020611]/80 p-4 backdrop-blur-sm"><div className="tech-panel my-6 w-full max-w-2xl p-6"><div className="flex items-start justify-between"><div><h2 className="text-xl font-black">{kind === "project" ? "مشروع جديد" : "مهمة جديدة"}</h2><p className="mt-1 text-[10px] text-slate-500">حدد القسم والشخص المسؤول مباشرة.</p></div><button onClick={onClose}><X size={17} /></button></div><div className="mt-6 space-y-4"><Field label="الاسم"><input className="tech-field" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="القسم"><select className="tech-field" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setAssigneeId(""); }}>{allowedDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Field label="إسناد إلى"><select className="tech-field" value={assigneeId} onChange={(e) => { setAssigneeId(e.target.value); const u = org.users.find((x) => x.id === e.target.value); if (u?.departmentId) setDepartmentId(u.departmentId); }}><option value="">رئيس القسم / تلقائي</option>{assignable.filter((u) => !departmentId || !u.departmentId || u.departmentId === departmentId).map((u) => <option key={u.id} value={u.id}>{u.name} — {roleOf(org, u)?.name}</option>)}</select></Field></div><div className="grid gap-3 sm:grid-cols-3"><Field label="الأولوية"><select className="tech-field" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}><option value="normal">عادي</option><option value="important">مهم</option><option value="urgent">عاجل</option></select></Field><Field label="الموقع"><input className="tech-field" value={location} onChange={(e) => setLocation(e.target.value)} /></Field><Field label="المرجع"><input className="tech-field" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} /></Field></div>{kind === "task" && <Field label="المشروع المرتبط — اختياري"><select className="tech-field" value={parentProjectId} onChange={(e) => setParentProjectId(e.target.value)}><option value="">مهمة مستقلة</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>}<Field label="التفاصيل"><textarea className="tech-field resize-none" rows={4} value={details} onChange={(e) => setDetails(e.target.value)} /></Field></div><div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="px-4 text-xs text-slate-500">إلغاء</button><button disabled={title.trim().length < 3} onClick={() => onCreate({ kind, title, details, departmentId, assigneeId, priority, location, referenceNumber, parentProjectId: parentProjectId || undefined })} className="flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-[11px] font-black text-slate-950 disabled:opacity-30"><Send size={13} />إنشاء</button></div></div></div>;
}

function Header({ org, user, unread, noticeOpen, userOpen, search, onSearch, onToggleNotice, onToggleUser, notices, onOpenNotice, onReadAll, onLogout, onMobile }: { org: OrgState; user: OrgUser; unread: number; noticeOpen: boolean; userOpen: boolean; search: string; onSearch: (v: string) => void; onToggleNotice: () => void; onToggleUser: () => void; notices: AppState["notices"]; onOpenNotice: (n: AppState["notices"][number]) => void; onReadAll: () => void; onLogout: () => void; onMobile: () => void }) { return <header className="sticky top-0 z-50 border-b border-white/10 bg-[#08111f]/90 backdrop-blur-2xl"><div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-4 px-4 md:px-7"><button onClick={onMobile} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 md:hidden"><Menu size={20} /></button><Brand org={org} /><div className="hidden flex-1 md:block"><div className="relative max-w-xl"><Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" /><input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="بحث..." className="h-10 w-full rounded-xl border border-white/8 bg-white/[0.03] pr-10 pl-3 text-sm outline-none placeholder:text-slate-600" /></div></div><div className="mr-auto flex items-center gap-2"><div className="relative"><button onClick={onToggleNotice} className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5"><Bell size={17} />{unread > 0 && <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-cyan-300 px-1 text-[9px] font-black text-slate-950">{unread}</span>}</button>{noticeOpen && <NotificationsPanel notices={notices} onOpen={onOpenNotice} onReadAll={onReadAll} />}</div><div className="relative"><button onClick={onToggleUser} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-1.5 pr-2 pl-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-300 to-indigo-400 text-slate-950"><UserRound size={15} /></span><span className="hidden text-right sm:block"><span className="block text-xs font-black">{user.name}</span><span className="block text-[9px] text-cyan-300/60">{roleOf(org, user)?.name}</span></span><ChevronDown size={13} className="text-slate-600" /></button>{userOpen && <div className="absolute left-0 top-12 z-50 w-64 rounded-2xl border border-white/10 bg-[#0c1726] p-2 shadow-2xl"><div className="px-3 py-3"><div className="text-xs font-black">{user.name}</div><div className="mt-1 text-[10px] text-slate-600">{roleOf(org, user)?.name}</div></div><div className="h-px bg-white/7" /><button onClick={onLogout} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-400/7"><LogOut size={14} />تسجيل الخروج</button></div>}</div></div></div></header>; }

function Brand({ org }: { org: OrgState }) { return <div className="flex shrink-0 items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-[14px] border border-cyan-300/30 bg-cyan-300/10 text-cyan-300"><Radar size={20} /></div><div><div className="text-sm font-black">{org.branchName}</div><div className="mt-0.5 text-[9px] font-bold tracking-[.18em] text-cyan-300/60">OPERATIONS COMMAND</div></div></div>; }

function Sidebar({ page, canProjects, canTasks, canTree, canReports, canAdmin, canCreateProject, canCreateTask, onPage, onCreate }: { page: Page; canProjects: boolean; canTasks: boolean; canTree: boolean; canReports: boolean; canAdmin: boolean; canCreateProject: boolean; canCreateTask: boolean; onPage: (p: Page) => void; onCreate: (k: WorkType) => void }) { return <div className="flex h-full flex-col"><nav className="space-y-2"><Nav active={page === "overview"} onClick={() => onPage("overview")} icon={<Gauge size={17} />} label="الرئيسية" />{canProjects && <Nav active={page === "projects"} onClick={() => onPage("projects")} icon={<BriefcaseBusiness size={17} />} label="المشاريع" />}{canTasks && <Nav active={page === "tasks"} onClick={() => onPage("tasks")} icon={<ListTodo size={17} />} label="المهام" />}{canTree && <Nav active={page === "tree"} onClick={() => onPage("tree")} icon={<Network size={17} />} label="شجرة الفريق" />}{canReports && <Nav active={page === "reports"} onClick={() => onPage("reports")} icon={<FileSpreadsheet size={17} />} label="التقارير" />}{canAdmin && <Nav active={page === "admin"} onClick={() => onPage("admin")} icon={<Settings2 size={17} />} label="الإدارة" />}</nav>{(canCreateProject || canCreateTask) && <div className="mt-6 grid grid-cols-2 gap-2">{canCreateProject && <button onClick={() => onCreate("project")} className="rounded-xl border border-white/8 px-3 py-2.5 text-[10px] font-bold">+ مشروع</button>}{canCreateTask && <button onClick={() => onCreate("task")} className="rounded-xl bg-cyan-300 px-3 py-2.5 text-[10px] font-black text-slate-950">+ مهمة</button>}</div>}</div>; }
function Nav({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) { return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${active ? "border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-200" : "border-transparent text-slate-500 hover:bg-white/5 hover:text-white"}`}>{icon}{label}</button>; }

function Overview({ org, user, items, onOpen, onPage }: { org: OrgState; user: OrgUser; items: Assignment[]; onOpen: (i: Assignment) => void; onPage: (p: Page) => void }) { const projects = items.filter((i) => i.kind === "project"); const tasks = items.filter((i) => i.kind !== "project"); const active = items.filter((i) => i.status === "active").length; const review = items.filter((i) => i.status === "review").length; const recent = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8); return <div className="space-y-6"><section className="tech-panel p-6 md:p-8"><div className="text-[10px] font-black tracking-[.18em] text-cyan-300/60">LIVE OPERATIONS</div><h1 className="mt-3 text-2xl font-black md:text-4xl">متابعة الفرع والعمل اليومي</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">مرحباً {user.name}. تابع المشاريع والمهام والفريق من مكان واحد.</p></section><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="المشاريع" value={projects.length} onClick={() => onPage("projects")} /><Metric label="المهام" value={tasks.length} onClick={() => onPage("tasks")} /><Metric label="قيد التنفيذ" value={active} /><Metric label="بانتظار الاعتماد" value={review} /></div><section className="tech-panel overflow-hidden"><div className="border-b border-white/7 px-5 py-4"><h2 className="text-sm font-black">آخر الأعمال</h2></div><div className="divide-y divide-white/7">{recent.map((i) => <button key={i.id} onClick={() => onOpen(i)} className="flex w-full items-center gap-3 px-5 py-4 text-right hover:bg-white/[0.03]"><span className="min-w-0 flex-1 truncate text-sm font-bold">{i.title}</span><span className="text-[10px] text-slate-600">{org.users.find((u) => u.id === i.assigneeId)?.name ?? "غير مسند"}</span></button>)}</div></section></div>; }
function Metric({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) { return <button disabled={!onClick} onClick={onClick} className="tech-panel w-full p-5 text-right disabled:cursor-default"><div className="font-mono text-3xl font-black">{String(value).padStart(2, "0")}</div><div className="mt-1 text-[11px] text-slate-500">{label}</div></button>; }

function WorkList({ org, currentUser, items, kind, search, status, onSearch, onStatus, onOpen, onCreate }: { org: OrgState; currentUser: OrgUser; items: Assignment[]; kind: WorkType; search: string; status: TaskStatus | "all"; onSearch: (v: string) => void; onStatus: (v: TaskStatus | "all") => void; onOpen: (id: string) => void; onCreate: (k: WorkType) => void }) { const list = items.filter((i) => kindOf(i) === kind && (status === "all" || i.status === status) && (!search.trim() || `${i.title} ${i.location ?? ""} ${i.referenceNumber ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); const canCreate = kind === "project" ? hasPermission(org, currentUser, "create_projects") : hasPermission(org, currentUser, "create_tasks"); return <div className="mx-auto max-w-5xl space-y-5"><div className="flex items-center justify-between gap-4"><div><h1 className="text-2xl font-black">{kind === "project" ? "المشاريع" : "المهام"}</h1><p className="mt-1 text-[11px] text-slate-500">الأعمال الظاهرة ضمن صلاحياتك وفريقك.</p></div>{canCreate && <button onClick={() => onCreate(kind)} className="flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-[11px] font-black text-slate-950"><Plus size={14} />جديد</button>}</div><div className="tech-panel p-4"><div className="grid gap-3 md:grid-cols-[1fr_180px]"><div className="relative"><Search size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" /><input className="tech-field pr-10" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="بحث..." /></div><select className="tech-field" value={status} onChange={(e) => onStatus(e.target.value as TaskStatus | "all")}><option value="all">جميع الحالات</option>{Object.entries(statusMeta).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div></div><div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]"><div className="divide-y divide-white/7">{list.length ? list.map((i) => <button key={i.id} onClick={() => onOpen(i.id)} className="flex w-full items-center gap-3 px-5 py-4 text-right hover:bg-white/[0.035]"><div className="min-w-0 flex-1"><div className="truncate text-[15px] font-bold">{i.title}</div><div className="mt-1 text-[10px] text-slate-600">{org.users.find((u) => u.id === i.assigneeId)?.name ?? "غير مسند"}{i.location ? ` · ${i.location}` : ""}</div></div><span className="text-[10px] text-slate-600">{statusMeta[i.status].label}</span></button>) : <div className="p-10 text-center text-xs text-slate-600">لا توجد نتائج.</div>}</div></div></div>; }

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-[9px] font-bold text-slate-500">{label}</span>{children}</label>; }
function MobileNav({ page, canTree, canReports, onPage }: { page: Page; canTree: boolean; canReports: boolean; onPage: (p: Page) => void }) { return <div className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-[22px] border border-white/10 bg-[#0b1524]/95 p-2 shadow-2xl backdrop-blur md:hidden"><button onClick={() => onPage("overview")} className={page === "overview" ? "text-cyan-300" : "text-slate-600"}><LayoutDashboard size={19} /></button><button onClick={() => onPage("projects")} className={page === "projects" ? "text-cyan-300" : "text-slate-600"}><BriefcaseBusiness size={19} /></button><button onClick={() => onPage("tasks")} className={page === "tasks" ? "text-cyan-300" : "text-slate-600"}><ListTodo size={19} /></button>{canTree && <button onClick={() => onPage("tree")} className={page === "tree" ? "text-cyan-300" : "text-slate-600"}><Network size={19} /></button>}{canReports && <button onClick={() => onPage("reports")} className={page === "reports" ? "text-cyan-300" : "text-slate-600"}><FileSpreadsheet size={19} /></button>}</div>; }
function MobileDrawer({ page, canProjects, canTasks, canTree, canReports, canAdmin, onClose, onPage }: { page: Page; canProjects: boolean; canTasks: boolean; canTree: boolean; canReports: boolean; canAdmin: boolean; onClose: () => void; onPage: (p: Page) => void }) { return <div className="fixed inset-0 z-[80] bg-[#020611]/80 md:hidden"><div className="h-full w-[84%] max-w-sm border-l border-white/10 bg-[#08111f] p-5"><div className="flex justify-end"><button onClick={onClose}><X size={18} /></button></div><div className="mt-6 space-y-2"><Nav active={page === "overview"} onClick={() => onPage("overview")} icon={<Gauge size={17} />} label="الرئيسية" />{canProjects && <Nav active={page === "projects"} onClick={() => onPage("projects")} icon={<BriefcaseBusiness size={17} />} label="المشاريع" />}{canTasks && <Nav active={page === "tasks"} onClick={() => onPage("tasks")} icon={<ListTodo size={17} />} label="المهام" />}{canTree && <Nav active={page === "tree"} onClick={() => onPage("tree")} icon={<Network size={17} />} label="شجرة الفريق" />}{canReports && <Nav active={page === "reports"} onClick={() => onPage("reports")} icon={<FileSpreadsheet size={17} />} label="التقارير" />}{canAdmin && <Nav active={page === "admin"} onClick={() => onPage("admin")} icon={<Settings2 size={17} />} label="الإدارة" />}</div></div></div>; }
