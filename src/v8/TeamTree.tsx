import { useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, CheckCircle2, ChevronDown, ChevronUp, CircleDot, Clock3, Focus, ListTodo, Maximize2, Minimize2, Minus, Network, PhoneCall, Plus, Radio, UserRound, UsersRound } from "lucide-react";
import { statusMeta, type Assignment, type CallRequest, type TaskStatus } from "../v2/model";
import { descendants, roleOf, type OrgState, type OrgUser } from "./orgModel";
import { useLiveAppState } from "./liveState";

type Point = { x: number; y: number };
type Tone = "active" | "pending" | "done";

function itemTone(status: TaskStatus): Tone {
  if (status === "active") return "active";
  if (status === "done") return "done";
  return "pending";
}

function directActive(userId: string, items: Assignment[]) {
  return items.some((item) => (item.assigneeId ?? item.ownerId) === userId && item.status === "active");
}

function hasActiveWork(userId: string, state: OrgState, items: Assignment[], visibleIds: Set<string>): boolean {
  if (directActive(userId, items)) return true;
  return state.users
    .filter((user) => user.managerId === userId && user.active && visibleIds.has(user.id))
    .some((child) => hasActiveWork(child.id, state, items, visibleIds));
}

function callTargetFor(state: OrgState, user: OrgUser) {
  const role = roleOf(state, user);
  if (role?.key === "department_head") {
    return state.users.find((u) => u.active && roleOf(state, u)?.key === "branch_head")?.id;
  }
  if (role?.key !== "office_responsible") return undefined;

  const directManager = user.managerId ? state.users.find((u) => u.id === user.managerId && u.active) : undefined;
  if (directManager && roleOf(state, directManager)?.key === "department_head") return directManager.id;

  const department = user.departmentId ? state.departments.find((d) => d.id === user.departmentId) : undefined;
  const configuredHead = department?.headUserId ? state.users.find((u) => u.id === department.headUserId && u.active) : undefined;
  if (configuredHead && roleOf(state, configuredHead)?.key === "department_head") return configuredHead.id;

  return state.users.find((u) => u.active && u.departmentId === user.departmentId && roleOf(state, u)?.key === "department_head")?.id;
}

export default function TeamTree({ state, items, currentUserId, onOpenItem }: { state: OrgState; items: Assignment[]; currentUserId: string; onOpenItem: (id: string) => void }) {
  const current = state.users.find((u) => u.id === currentUserId);
  const [liveApp, setLiveApp] = useLiveAppState();
  const panelRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const handleFullscreen = () => {
      const active = document.fullscreenElement === panelRef.current;
      setIsFullscreen(active);
      if (!active) { setZoom(1); setPan({ x: 0, y: 0 }); }
    };
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  function fitTopology() {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const widthRatio = Math.max(0.2, (viewport.clientWidth - 80) / Math.max(1, content.scrollWidth));
    const heightRatio = Math.max(0.2, (viewport.clientHeight - 80) / Math.max(1, content.scrollHeight));
    setZoom(Math.min(1, Math.max(0.22, Math.min(widthRatio, heightRatio))));
    setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    if (!isFullscreen) return;
    const timer = window.setTimeout(fitTopology, 100);
    return () => window.clearTimeout(timer);
  }, [isFullscreen]);

  if (!current) return null;

  const currentUser = current;
  const currentRole = roleOf(state, currentUser);
  const branchHead = state.users.find((u) => roleOf(state, u)?.key === "branch_head");
  const root = currentRole?.key === "branch_head" ? branchHead ?? currentUser : currentUser;
  const visibleUsers = [root, ...descendants(state, root.id)].filter((u) => u.active);
  const visibleIds = new Set(visibleUsers.map((u) => u.id));
  const workingCount = visibleUsers.filter((u) => directActive(u.id, items)).length;
  const activeCalls = (liveApp.callRequests ?? []).filter((r) => r.active);
  const allowedCallTarget = callTargetFor(state, currentUser);
  const myActiveCall = allowedCallTarget ? activeCalls.find((r) => r.fromUserId === currentUser.id && r.toUserId === allowedCallTarget) : undefined;

  function requestCall() {
    if (!allowedCallTarget || myActiveCall) return;
    const at = new Date().toISOString();
    const target = state.users.find((u) => u.id === allowedCallTarget);
    const request: CallRequest = { id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, fromUserId: currentUser.id, toUserId: allowedCallTarget, createdAt: at, active: true };
    setLiveApp((s) => {
      const calls = s.callRequests ?? [];
      if (calls.some((r) => r.active && r.fromUserId === currentUser.id && r.toUserId === allowedCallTarget)) return s;
      return {
        ...s,
        callRequests: [request, ...calls],
        notices: [{ id: `notice-${request.id}`, userId: allowedCallTarget, text: `طلب اتصال من ${currentUser.name}${target ? ` إلى ${target.name}` : ""}.`, at, read: false }, ...s.notices],
      };
    });
  }

  function resolveCall(id: string) {
    const at = new Date().toISOString();
    setLiveApp((s) => {
      const call = (s.callRequests ?? []).find((r) => r.id === id);
      if (!call || !call.active || call.toUserId !== currentUser.id) return s;
      return {
        ...s,
        callRequests: (s.callRequests ?? []).map((r) => r.id === id ? { ...r, active: false, resolvedAt: at } : r),
        notices: [{ id: `notice-resolved-${id}-${Date.now()}`, userId: call.fromUserId, text: `تم استلام طلب الاتصال من قبل ${currentUser.name}.`, at, read: false }, ...s.notices],
      };
    });
  }

  function setZoomSafe(next: number) { setZoom(Math.min(1.8, Math.max(0.22, Number(next.toFixed(2))))); }
  function onTopologyWheel(e: React.WheelEvent<HTMLDivElement>) { if (!isFullscreen) return; e.preventDefault(); const step = e.deltaY < 0 ? 0.1 : -0.1; setZoom((value) => Math.min(1.8, Math.max(0.22, Number((value + step).toFixed(2))))); }
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) { if (!isFullscreen || e.button !== 0 || (e.target as HTMLElement).closest("button")) return; dragRef.current = { pointerId: e.pointerId, start: { x: e.clientX, y: e.clientY }, origin: pan }; e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) { const drag = dragRef.current; if (!drag || drag.pointerId !== e.pointerId) return; setPan({ x: drag.origin.x + (e.clientX - drag.start.x), y: drag.origin.y + (e.clientY - drag.start.y) }); }
  function endDrag(e: React.PointerEvent<HTMLDivElement>) { if (dragRef.current?.pointerId !== e.pointerId) return; dragRef.current = null; setDragging(false); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }
  async function toggleFullscreen() { const el = panelRef.current; if (!el) return; if (document.fullscreenElement) { await document.exitFullscreen(); return; } try { await el.requestFullscreen(); window.setTimeout(fitTopology, 120); } catch { setIsFullscreen((v) => !v); window.setTimeout(fitTopology, 120); } }

  return <div className="mx-auto max-w-[1600px] space-y-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-[10px] tracking-[.2em] text-cyan-300/50"><Network size={14} /> LIVE ORGANIZATION TOPOLOGY</div>
        <h1 className="mt-2 text-2xl font-black">المراقبة الحية للفريق</h1>
        <p className="mt-1 text-xs leading-6 text-slate-500">الموجة تبدأ من رئيس القسم وتتبع المسار الحقيقي حتى بطاقة الشخص صاحب العمل النشط. الأعمال غير المستلمة والمنتهية لا تولد موجة.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {allowedCallTarget && <button type="button" onClick={requestCall} disabled={!!myActiveCall} className="flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-[10px] font-black text-amber-200 disabled:opacity-45"><PhoneCall size={14} />{myActiveCall ? "تم إرسال طلب الاتصال" : currentRole?.key === "office_responsible" ? "طلب اتصال من رئيس القسم" : "طلب اتصال من رئيس الفرع"}</button>}
        <LiveStat label="الأفراد" value={visibleUsers.length} icon={<UsersRound size={14} />} />
        <LiveStat label="نشط الآن" value={workingCount} icon={<Radio size={14} />} active />
        {activeCalls.length > 0 && <LiveStat label="طلبات اتصال" value={activeCalls.length} icon={<PhoneCall size={14} />} warning />}
      </div>
    </div>

    <section ref={panelRef} className={`tech-panel overflow-hidden ${isFullscreen ? "topology-fullscreen" : ""}`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/7 px-4 py-3 md:px-6">
        <div className="text-[10px] text-slate-600">الخطوط منحنية كمسارات شبكة حقيقية، والموجة تظهر فقط على الطريق المؤدي إلى عمل نشط. في ملء الشاشة استخدم عجلة الماوس للتكبير والتصغير واسحب لتحريك المخطط.</div>
        <div className="flex shrink-0 items-center gap-2">
          {isFullscreen && <div className="flex items-center gap-1 rounded-xl border border-white/8 bg-black/15 p-1"><button type="button" onClick={() => setZoomSafe(zoom - 0.1)} className="topology-control"><Minus size={14} /></button><span className="min-w-12 text-center font-mono text-[9px] font-bold text-slate-400">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoomSafe(zoom + 0.1)} className="topology-control"><Plus size={14} /></button><button type="button" onClick={fitTopology} className="topology-control"><Focus size={14} /></button></div>}
          <button type="button" onClick={toggleFullscreen} className="flex h-9 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 text-[10px] font-bold text-slate-300 hover:border-cyan-300/20 hover:text-cyan-200">{isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{isFullscreen ? "خروج" : "ملء الشاشة"}</button>
        </div>
      </div>
      <div ref={viewportRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onWheel={onTopologyWheel} className={`topology-scroll relative p-5 md:p-8 ${isFullscreen ? `h-[calc(100vh-58px)] overflow-hidden select-none touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"}` : "overflow-auto"}`}>
        <div ref={contentRef} className="mx-auto w-max min-w-max px-8 pb-10 pt-2 will-change-transform" style={isFullscreen ? { transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`, transformOrigin: "top center" } : undefined}>
          {currentRole?.key === "branch_head" ? <div className="flex flex-col items-center"><BranchRoot name={state.branchName} active={workingCount > 0} /><CurvedStem /><OrgNode user={root} state={state} items={items} visibleIds={visibleIds} onOpenItem={onOpenItem} isRoot callRequests={activeCalls} currentUserId={currentUser.id} onResolveCall={resolveCall} branchHeadId={branchHead?.id} depth={0} /></div> : <div className="flex justify-center"><OrgNode user={root} state={state} items={items} visibleIds={visibleIds} onOpenItem={onOpenItem} isRoot callRequests={activeCalls} currentUserId={currentUser.id} onResolveCall={resolveCall} branchHeadId={branchHead?.id} depth={0} /></div>}
        </div>
      </div>
    </section>
  </div>;
}

function BranchRoot({ name, active }: { name: string; active: boolean }) {
  return <div className={`relative z-10 min-w-[270px] rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.07] px-6 py-4 text-center shadow-[0_0_35px_rgba(34,211,238,.06)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/45 hover:bg-cyan-300/[0.1] ${active ? "topology-root-pulse" : ""}`}><div className="text-[9px] font-black tracking-[.18em] text-cyan-300/55">BRANCH ROOT</div><div className="mt-1 text-sm font-black text-white">{name}</div></div>;
}

function CurvedStem() {
  return <svg aria-hidden="true" className="h-14 w-28 overflow-visible" viewBox="0 0 100 56"><path d="M50 0 C35 16 65 36 50 56" fill="none" stroke="rgba(103,232,249,.24)" strokeWidth="1.4" strokeLinecap="round" /></svg>;
}

function OrgNode({ user, state, items, visibleIds, onOpenItem, callRequests, currentUserId, onResolveCall, branchHeadId, isRoot = false, depth }: { user: OrgUser; state: OrgState; items: Assignment[]; visibleIds: Set<string>; onOpenItem: (id: string) => void; callRequests: CallRequest[]; currentUserId: string; onResolveCall: (id: string) => void; branchHeadId?: string; isRoot?: boolean; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const role = roleOf(state, user);
  const children = state.users.filter((u) => u.managerId === user.id && u.active && visibleIds.has(u.id));
  const assignedItems = items.filter((i) => (i.assigneeId ?? i.ownerId) === user.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const activeItems = assignedItems.filter((i) => i.status === "active");
  const pendingItems = assignedItems.filter((i) => i.status !== "active" && i.status !== "done");
  const completedItems = assignedItems.filter((i) => i.status === "done");
  const commandItems = role?.key === "department_head" && branchHeadId ? assignedItems.filter((i) => i.issuedById === branchHeadId) : [];
  const otherOwnItems = role?.key === "department_head" ? assignedItems.filter((i) => !commandItems.some((x) => x.id === i.id)) : [];
  const teamIds = role?.key === "department_head" ? new Set(descendants(state, user.id).map((u) => u.id)) : new Set<string>();
  const delegatedTeamItems = role?.key === "department_head" ? items.filter((i) => i.ownerId === user.id && !!i.assigneeId && i.assigneeId !== user.id && teamIds.has(i.assigneeId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
  const dept = state.departments.find((d) => d.id === user.departmentId);
  const office = state.offices.find((o) => o.id === user.officeId);
  const incomingCalls = callRequests.filter((r) => r.toUserId === user.id);
  const parentIsBranchHead = roleOf(state, user.managerId ? state.users.find((u) => u.id === user.managerId) : undefined)?.key === "branch_head";
  const childActiveFlags = children.map((child) => parentIsBranchHead ? directActive(child.id, items) : hasActiveWork(child.id, state, items, visibleIds));

  return <div className="flex flex-col items-center">
    <PersonNode user={user} roleName={role?.name ?? "بدون دور"} subtitle={office?.name ?? dept?.name ?? user.title ?? "إدارة الفرع"} activeItems={activeItems} pendingItems={pendingItems} completedItems={completedItems} commandItems={commandItems} otherOwnItems={otherOwnItems} delegatedTeamItems={delegatedTeamItems} onOpenItem={onOpenItem} isRoot={isRoot} childCount={children.length} expanded={expanded} onToggle={() => setExpanded((v) => !v)} incomingCalls={incomingCalls} state={state} currentUserId={currentUserId} onResolveCall={onResolveCall} />
    {children.length > 0 && expanded && <div className="relative flex w-max min-w-full flex-col items-center">
      <TopologyConnectorFan childCount={children.length} activeFlags={childActiveFlags} depth={depth} />
      <div className="flex items-start justify-center gap-10 px-5">{children.map((child) => <div key={child.id} className="flex min-w-[300px] justify-center"><OrgNode user={child} state={state} items={items} visibleIds={visibleIds} onOpenItem={onOpenItem} callRequests={callRequests} currentUserId={currentUserId} onResolveCall={onResolveCall} branchHeadId={branchHeadId} depth={depth + 1} /></div>)}</div>
    </div>}
  </div>;
}

function TopologyConnectorFan({ childCount, activeFlags, depth }: { childCount: number; activeFlags: boolean[]; depth: number }) {
  return <div className="relative h-20 w-full min-w-full">
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 80" preserveAspectRatio="none">
      <defs><filter id={`topology-glow-${depth}-${childCount}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      {Array.from({ length: childCount }).map((_, index) => {
        const x = ((childCount - index - 0.5) / childCount) * 100;
        const d = childCount === 1 ? "M50 0 C38 20 62 52 50 80" : `M50 0 C50 28 ${x} 26 ${x} 80`;
        const active = !!activeFlags[index];
        return <g key={index}>
          <path d={d} fill="none" stroke={active ? "rgba(103,232,249,.34)" : "rgba(103,232,249,.16)"} strokeWidth={active ? 1.55 : 1.1} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          {active && <>
            <path d={d} fill="none" stroke="rgba(103,232,249,.98)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeDasharray="2 30" filter={`url(#topology-glow-${depth}-${childCount})`}>
              <animate attributeName="stroke-dashoffset" from="0" to="-128" dur="4.8s" begin={`${index * 0.22}s`} repeatCount="indefinite" />
            </path>
            <path d={d} fill="none" stroke="rgba(52,211,153,.7)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeDasharray="1 44">
              <animate attributeName="stroke-dashoffset" from="-18" to="-146" dur="4.8s" begin={`${index * 0.22}s`} repeatCount="indefinite" />
            </path>
          </>}
        </g>;
      })}
    </svg>
  </div>;
}

function PersonNode({ user, roleName, subtitle, activeItems, pendingItems, completedItems, commandItems, otherOwnItems, delegatedTeamItems, onOpenItem, isRoot, childCount, expanded, onToggle, incomingCalls, state, currentUserId, onResolveCall }: { user: OrgUser; roleName: string; subtitle: string; activeItems: Assignment[]; pendingItems: Assignment[]; completedItems: Assignment[]; commandItems: Assignment[]; otherOwnItems: Assignment[]; delegatedTeamItems: Assignment[]; onOpenItem: (id: string) => void; isRoot: boolean; childCount: number; expanded: boolean; onToggle: () => void; incomingCalls: CallRequest[]; state: OrgState; currentUserId: string; onResolveCall: (id: string) => void }) {
  const busy = activeItems.length > 0;
  const hasCall = incomingCalls.length > 0;
  const isDepartmentHead = roleOf(state, user)?.key === "department_head";

  return <div className={`topology-person-node relative z-10 w-[300px] rounded-2xl border p-4 shadow-xl backdrop-blur ${busy ? "topology-worker-active" : ""} ${hasCall ? "topology-call-alert border-amber-300/50 bg-amber-300/[0.075]" : isRoot ? "border-cyan-300/22 bg-cyan-300/[0.055]" : busy ? "border-emerald-300/18 bg-emerald-300/[0.035]" : "border-white/8 bg-[#0a1523]/95"}`}>
    <div className="flex items-start gap-3">
      <div className={`relative grid h-12 w-12 shrink-0 place-items-center overflow-visible rounded-2xl border ${hasCall ? "border-amber-300/30 bg-amber-300/[0.08] text-amber-200" : busy ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-300" : "border-white/8 bg-black/15 text-cyan-300"}`}>{user.avatarDataUrl ? <img src={user.avatarDataUrl} alt={user.name} className="h-full w-full rounded-[15px] object-cover" /> : <UserRound size={19} />}<span className={`absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#0a1523] ${busy ? "topology-worker-dot bg-emerald-400" : "bg-slate-700"}`} /></div>
      <div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-slate-100">{user.name}</div><div className="mt-1 truncate text-[10px] text-slate-500">{subtitle}</div><div className="mt-2 inline-flex rounded-lg border border-white/7 px-2 py-1 text-[9px] font-bold text-slate-500">{roleName}</div></div>
      {childCount > 0 && <button type="button" onClick={onToggle} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/7 bg-white/[0.025] text-slate-500 hover:border-cyan-300/20 hover:text-cyan-300">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>}
    </div>

    {hasCall && <div className="mt-4 space-y-2 rounded-2xl border border-amber-300/25 bg-amber-300/[0.08] p-3 shadow-[0_0_26px_rgba(251,191,36,.1)]">{incomingCalls.map((request) => { const from = state.users.find((u) => u.id === request.fromUserId); return <div key={request.id} className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-200">{from?.avatarDataUrl ? <img src={from.avatarDataUrl} alt={from.name} className="h-full w-full object-cover" /> : <PhoneCall size={16} />}</div><div className="min-w-0 flex-1"><div className="text-[9px] font-black text-amber-300">طلب اتصال</div><div className="mt-0.5 text-[13px] font-black leading-5 text-amber-50">{from?.name ?? "مستخدم"}</div><div className="text-[10px] text-amber-200/70">يطلب من {user.name} الاتصال به</div></div>{currentUserId === user.id && <button type="button" onClick={() => onResolveCall(request.id)} className="shrink-0 rounded-xl bg-amber-300 px-2.5 py-2 text-[9px] font-black text-slate-950">تم الاتصال</button>}</div>; })}</div>}

    {isDepartmentHead ? <>
      <AssignmentGroup title="تكليفات رئيس الفرع ← رئيس القسم" subtitle="أعمال وصلت مباشرة من رئيس الفرع إلى رئيس القسم" items={commandItems} state={state} onOpenItem={onOpenItem} accent="command" />
      <AssignmentGroup title="تكليفات موزعة على فريق القسم" subtitle="أعمال القسم المسندة حالياً إلى مسؤولي المكاتب والعناصر" items={delegatedTeamItems} state={state} onOpenItem={onOpenItem} accent="team" showAssignee />
      {otherOwnItems.length > 0 && <AssignmentGroup title="أعمال أخرى لرئيس القسم" items={otherOwnItems} state={state} onOpenItem={onOpenItem} accent="other" />}
    </> : <>
      <WorkSection title="الأعمال النشطة" count={activeItems.length} tone="active" items={activeItems} onOpenItem={onOpenItem} />
      {pendingItems.length > 0 && <WorkSection title="بانتظار / غير نشط" count={pendingItems.length} tone="pending" items={pendingItems} onOpenItem={onOpenItem} />}
      {completedItems.length > 0 && <WorkSection title="الأعمال المنتهية" count={completedItems.length} tone="done" items={completedItems} onOpenItem={onOpenItem} />
    </>}
  </div>;
}

function AssignmentGroup({ title, subtitle, items, state, onOpenItem, accent, showAssignee = false }: { title: string; subtitle?: string; items: Assignment[]; state: OrgState; onOpenItem: (id: string) => void; accent: "command" | "team" | "other"; showAssignee?: boolean }) {
  const headerClass = accent === "command" ? "text-cyan-300" : accent === "team" ? "text-indigo-300" : "text-slate-400";
  return <div className="mt-4 border-t border-white/7 pt-3">
    <div className={`text-[9px] font-black ${headerClass}`}>{title} <span className="font-mono opacity-70">{items.length}</span></div>
    {subtitle && <div className="mt-1 text-[8px] leading-4 text-slate-600">{subtitle}</div>}
    {items.length ? <div className="mt-2 space-y-2">{items.map((item) => <MissionButton key={item.id} item={item} onOpenItem={onOpenItem} tone={itemTone(item.status)} assigneeName={showAssignee ? state.users.find((u) => u.id === (item.assigneeId ?? item.ownerId))?.name : undefined} />)}</div> : <div className="mt-2 text-[9px] text-slate-700">لا توجد أعمال ضمن هذه المجموعة.</div>}
  </div>;
}

function WorkSection({ title, count, tone, items, onOpenItem }: { title: string; count: number; tone: Tone; items: Assignment[]; onOpenItem: (id: string) => void }) {
  const icon = tone === "active" ? <CircleDot size={9} className="animate-pulse" /> : tone === "done" ? <CheckCircle2 size={10} /> : <Clock3 size={10} />;
  return <div className="mt-4 border-t border-white/7 pt-3"><div className={`flex items-center gap-2 text-[9px] font-black ${tone === "active" ? "text-emerald-300" : tone === "pending" ? "text-amber-300/80" : "text-slate-500"}`}>{icon}{title}<span className="font-mono opacity-70">{count}</span></div>{items.length ? <div className="mt-2 space-y-2">{items.map((item) => <MissionButton key={item.id} item={item} onOpenItem={onOpenItem} tone={tone} />)}</div> : tone === "active" ? <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-600"><span className="h-2 w-2 rounded-full bg-slate-700" />لا يوجد عمل نشط حالياً</div> : null}</div>;
}

function MissionButton({ item, onOpenItem, tone, assigneeName }: { item: Assignment; onOpenItem: (id: string) => void; tone: Tone; assigneeName?: string }) {
  return <button type="button" onClick={() => onOpenItem(item.id)} className={`w-full rounded-xl border px-3 py-2.5 text-right transition hover:-translate-y-0.5 ${tone === "active" ? "border-emerald-300/12 bg-emerald-300/[0.035] hover:border-emerald-300/30" : tone === "pending" ? "border-amber-300/10 bg-amber-300/[0.025] hover:border-amber-300/20" : "border-white/7 bg-white/[0.018] hover:border-cyan-300/15"}`}>
    <div className="flex items-center gap-2"><span className={tone === "active" ? "text-emerald-300/80" : tone === "pending" ? "text-amber-300/65" : "text-slate-600"}>{item.kind === "project" ? <BriefcaseBusiness size={13} /> : <ListTodo size={13} />}</span><span className={`min-w-0 flex-1 text-[10px] font-bold leading-5 ${tone === "active" ? "text-slate-200" : tone === "pending" ? "text-slate-400" : "text-slate-500"}`}>{item.title}</span><span className="shrink-0 text-[8px] text-slate-600">{statusMeta[item.status].label}</span></div>
    {assigneeName && <div className="mt-1 pr-5 text-[8px] font-bold text-indigo-300/65">← {assigneeName}</div>}
  </button>;
}

function LiveStat({ label, value, icon, active = false, warning = false }: { label: string; value: number; icon: React.ReactNode; active?: boolean; warning?: boolean }) {
  return <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${warning ? "border-amber-300/15 bg-amber-300/[0.035]" : active ? "border-emerald-300/15 bg-emerald-300/[0.035]" : "border-white/8 bg-white/[0.025]"}`}><span className={warning ? "text-amber-300" : active ? "text-emerald-300" : "text-cyan-300"}>{icon}</span><div><div className="font-mono text-sm font-black text-white">{value}</div><div className="text-[9px] text-slate-600">{label}</div></div></div>;
}
