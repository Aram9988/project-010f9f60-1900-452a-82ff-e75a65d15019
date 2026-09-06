import { useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, ChevronDown, ChevronUp, CircleDot, ListTodo, Maximize2, Minimize2, Network, PhoneCall, Radio, UserRound, UsersRound } from "lucide-react";
import type { Assignment } from "../v2/model";
import { descendants, roleOf, type OrgState, type OrgUser } from "./orgModel";

const CALL_STORAGE_KEY = "rif-dimashq-call-requests-v1";

type CallRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  createdAt: string;
  active: boolean;
};

function loadCallRequests(): CallRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CALL_STORAGE_KEY);
    return raw ? JSON.parse(raw) as CallRequest[] : [];
  } catch {
    return [];
  }
}

export default function TeamTree({ state, items, currentUserId, onOpenItem }: { state: OrgState; items: Assignment[]; currentUserId: string; onOpenItem: (id: string) => void }) {
  const current = state.users.find((u) => u.id === currentUserId);
  const panelRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const [callRequests, setCallRequests] = useState<CallRequest[]>(() => loadCallRequests());

  useEffect(() => {
    localStorage.setItem(CALL_STORAGE_KEY, JSON.stringify(callRequests));
  }, [callRequests]);

  useEffect(() => {
    const handleFullscreen = () => setIsFullscreen(document.fullscreenElement === panelRef.current);
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  useEffect(() => {
    if (!isFullscreen) { setFitScale(1); return; }
    const fit = () => {
      const viewport = viewportRef.current;
      const content = contentRef.current;
      if (!viewport || !content) return;
      const available = Math.max(320, viewport.clientWidth - 48);
      const natural = Math.max(content.scrollWidth, content.getBoundingClientRect().width);
      setFitScale(natural > available ? Math.max(0.38, available / natural) : 1);
    };
    const timer = window.setTimeout(fit, 80);
    window.addEventListener("resize", fit);
    return () => { window.clearTimeout(timer); window.removeEventListener("resize", fit); };
  }, [isFullscreen, state, items]);

  if (!current) return null;
  const currentUser = current;

  const currentRole = roleOf(state, currentUser);
  const branchHead = state.users.find((u) => roleOf(state, u)?.key === "branch_head");
  const root = currentRole?.key === "branch_head" ? branchHead ?? currentUser : currentUser;
  const visibleUsers = [root, ...descendants(state, root.id)].filter((u) => u.active);
  const visibleIds = new Set(visibleUsers.map((u) => u.id));
  const workingCount = visibleUsers.filter((u) => items.some((i) => (i.assigneeId ?? i.ownerId) === u.id && i.status !== "done")).length;
  const activeCalls = callRequests.filter((r) => r.active);

  const allowedCallTarget = (() => {
    if (currentRole?.key === "department_head") return branchHead?.id;
    if (currentRole?.key === "office_responsible") {
      const manager = state.users.find((u) => u.id === currentUser.managerId);
      return roleOf(state, manager)?.key === "department_head" ? manager?.id : undefined;
    }
    return undefined;
  })();

  function requestCall() {
    if (!allowedCallTarget) return;
    const already = activeCalls.some((r) => r.fromUserId === currentUser.id && r.toUserId === allowedCallTarget);
    if (already) return;
    setCallRequests((prev) => [{ id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, fromUserId: currentUser.id, toUserId: allowedCallTarget, createdAt: new Date().toISOString(), active: true }, ...prev]);
  }

  function resolveCall(id: string) {
    setCallRequests((prev) => prev.map((r) => r.id === id ? { ...r, active: false } : r));
  }

  async function toggleFullscreen() {
    const el = panelRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    try {
      await el.requestFullscreen();
    } catch {
      setIsFullscreen((v) => !v);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] tracking-[.2em] text-cyan-300/50"><Network size={14} /> LIVE ORGANIZATION TOPOLOGY</div>
          <h1 className="mt-2 text-2xl font-black">المراقبة الحية للفريق</h1>
          <p className="mt-1 text-xs leading-6 text-slate-500">{currentRole?.key === "branch_head" ? "الهيكل الكامل للفرع مع حالة كل مستخدم والعمل المسند إليه وطلبات الاتصال مباشرة." : "هيكل فريقك فقط مع حالة العمل الحالية لكل فرد."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {allowedCallTarget && <button type="button" onClick={requestCall} disabled={activeCalls.some((r) => r.fromUserId === currentUser.id && r.toUserId === allowedCallTarget)} className="flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-[10px] font-black text-amber-200 disabled:opacity-45"><PhoneCall size={14} />{activeCalls.some((r) => r.fromUserId === currentUser.id && r.toUserId === allowedCallTarget) ? "تم إرسال طلب الاتصال" : "طلب اتصال من المسؤول"}</button>}
          <LiveStat label="الأفراد" value={visibleUsers.length} icon={<UsersRound size={14} />} />
          <LiveStat label="على مهمة" value={workingCount} icon={<Radio size={14} />} active />
          {activeCalls.length > 0 && <LiveStat label="طلبات اتصال" value={activeCalls.length} icon={<PhoneCall size={14} />} warning />}
        </div>
      </div>

      <section ref={panelRef} className={`tech-panel overflow-hidden ${isFullscreen ? "topology-fullscreen" : ""}`}>
        <div className="flex items-center justify-between gap-3 border-b border-white/7 px-4 py-3 md:px-6">
          <div className="text-[10px] text-slate-600">المسارات المتحركة تصل من أعلى الهيكل إلى كل شخص يعمل حالياً. اضغط على المهمة لفتحها.</div>
          <button type="button" onClick={toggleFullscreen} className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 text-[10px] font-bold text-slate-300 hover:border-cyan-300/20 hover:text-cyan-200">{isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{isFullscreen ? "خروج" : "ملء الشاشة"}</button>
        </div>
        <div ref={viewportRef} className={`topology-scroll overflow-auto p-5 md:p-8 ${isFullscreen ? "h-[calc(100vh-58px)]" : ""}`}>
          <div ref={contentRef} className="mx-auto min-w-max px-6 pb-8 pt-2 transition-transform duration-300" style={{ transform: `scale(${fitScale})`, transformOrigin: "top center", width: fitScale < 1 ? `${100 / fitScale}%` : "100%" }}>
            {currentRole?.key === "branch_head" ? (
              <div className="flex flex-col items-center">
                <BranchRoot name={state.branchName} active={workingCount > 0} />
                <ConnectorVertical active={workingCount > 0} />
                <OrgNode user={root} state={state} items={items} visibleIds={visibleIds} onOpenItem={onOpenItem} isRoot callRequests={activeCalls} currentUserId={currentUser.id} onResolveCall={resolveCall} />
              </div>
            ) : (
              <div className="flex justify-center">
                <OrgNode user={root} state={state} items={items} visibleIds={visibleIds} onOpenItem={onOpenItem} isRoot callRequests={activeCalls} currentUserId={currentUser.id} onResolveCall={resolveCall} />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function BranchRoot({ name, active }: { name: string; active: boolean }) {
  return <div className={`relative z-10 min-w-[260px] rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.07] px-6 py-4 text-center shadow-[0_0_35px_rgba(34,211,238,.06)] ${active ? "topology-root-pulse" : ""}`}><div className="text-[9px] font-black tracking-[.18em] text-cyan-300/55">BRANCH ROOT</div><div className="mt-1 text-sm font-black text-white">{name}</div></div>;
}

function hasActiveWork(userId: string, state: OrgState, items: Assignment[], visibleIds: Set<string>): boolean {
  if (items.some((i) => (i.assigneeId ?? i.ownerId) === userId && i.status !== "done")) return true;
  const children = state.users.filter((u) => u.managerId === userId && u.active && visibleIds.has(u.id));
  return children.some((child) => hasActiveWork(child.id, state, items, visibleIds));
}

function OrgNode({ user, state, items, visibleIds, onOpenItem, callRequests, currentUserId, onResolveCall, isRoot = false }: { user: OrgUser; state: OrgState; items: Assignment[]; visibleIds: Set<string>; onOpenItem: (id: string) => void; callRequests: CallRequest[]; currentUserId: string; onResolveCall: (id: string) => void; isRoot?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const role = roleOf(state, user);
  const children = state.users.filter((u) => u.managerId === user.id && u.active && visibleIds.has(u.id));
  const activeItems = items.filter((i) => (i.assigneeId ?? i.ownerId) === user.id && i.status !== "done");
  const dept = state.departments.find((d) => d.id === user.departmentId);
  const office = state.offices.find((o) => o.id === user.officeId);
  const incomingCalls = callRequests.filter((r) => r.toUserId === user.id);

  return (
    <div className="flex flex-col items-center">
      <PersonNode user={user} roleName={role?.name ?? "بدون دور"} subtitle={office?.name ?? dept?.name ?? user.title ?? "إدارة الفرع"} activeItems={activeItems} onOpenItem={onOpenItem} isRoot={isRoot} childCount={children.length} expanded={expanded} onToggle={() => setExpanded((v) => !v)} incomingCalls={incomingCalls} state={state} currentUserId={currentUserId} onResolveCall={onResolveCall} />
      {children.length > 0 && expanded && <><ConnectorVertical active={children.some((c) => hasActiveWork(c.id, state, items, visibleIds))} /><div className="relative flex items-start justify-center gap-7 px-4 pt-6">{children.length > 1 && <div className={`absolute top-0 h-px ${children.some((c) => hasActiveWork(c.id, state, items, visibleIds)) ? "topology-flow-line" : "bg-cyan-300/18"}`} style={{ left: `${100 / (children.length * 2)}%`, right: `${100 / (children.length * 2)}%` }} />}{children.map((child) => { const childActive = hasActiveWork(child.id, state, items, visibleIds); return <div key={child.id} className="relative flex min-w-[250px] justify-center"><div className={`absolute -top-6 left-1/2 h-6 w-px -translate-x-1/2 ${childActive ? "topology-flow-line topology-flow-vertical" : "bg-cyan-300/18"}`} /><OrgNode user={child} state={state} items={items} visibleIds={visibleIds} onOpenItem={onOpenItem} callRequests={callRequests} currentUserId={currentUserId} onResolveCall={onResolveCall} /></div>; })}</div></>}
    </div>
  );
}

function PersonNode({ user, roleName, subtitle, activeItems, onOpenItem, isRoot, childCount, expanded, onToggle, incomingCalls, state, currentUserId, onResolveCall }: { user: OrgUser; roleName: string; subtitle: string; activeItems: Assignment[]; onOpenItem: (id: string) => void; isRoot: boolean; childCount: number; expanded: boolean; onToggle: () => void; incomingCalls: CallRequest[]; state: OrgState; currentUserId: string; onResolveCall: (id: string) => void }) {
  const busy = activeItems.length > 0;
  const hasCall = incomingCalls.length > 0;
  return (
    <div className={`relative z-10 w-[250px] rounded-2xl border p-4 shadow-xl backdrop-blur ${hasCall ? "topology-call-alert border-amber-300/50 bg-amber-300/[0.07]" : isRoot ? "border-cyan-300/22 bg-cyan-300/[0.055]" : busy ? "border-emerald-300/18 bg-emerald-300/[0.035]" : "border-white/8 bg-[#0a1523]/95"}`}>
      {hasCall && <div className="absolute -top-2 left-3 flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-[#251a08] px-2.5 py-1 text-[8px] font-black text-amber-200 shadow-lg"><PhoneCall size={10} />طلب اتصال</div>}
      <div className="flex items-start gap-3"><div className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${hasCall ? "border-amber-300/30 bg-amber-300/[0.08] text-amber-200" : busy ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-300" : "border-white/8 bg-black/15 text-cyan-300"}`}><UserRound size={17} /><span className={`absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#0a1523] ${busy ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.85)]" : "bg-slate-700"}`} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-slate-100">{user.name}</div><div className="mt-1 truncate text-[10px] text-slate-600">{subtitle}</div><div className="mt-2 inline-flex rounded-lg border border-white/7 px-2 py-1 text-[9px] font-bold text-slate-500">{roleName}</div></div>{childCount > 0 && <button type="button" onClick={onToggle} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/7 bg-white/[0.025] text-slate-500 hover:text-cyan-300" title={expanded ? "طي الفرع" : "فتح الفرع"}>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>}</div>
      {hasCall && <div className="mt-3 space-y-2 rounded-xl border border-amber-300/12 bg-black/10 p-2.5">{incomingCalls.map((request) => { const from = state.users.find((u) => u.id === request.fromUserId); return <div key={request.id} className="flex items-center gap-2"><PhoneCall size={11} className="shrink-0 text-amber-300" /><span className="min-w-0 flex-1 truncate text-[9px] font-bold text-amber-100">طلب اتصال من {from?.name ?? "مستخدم"}</span>{currentUserId === user.id && <button type="button" onClick={() => onResolveCall(request.id)} className="rounded-lg bg-amber-300 px-2 py-1 text-[8px] font-black text-slate-950">تم الاتصال</button>}</div>; })}</div>}
      <div className="mt-4 border-t border-white/7 pt-3">{busy ? <div className="space-y-2"><div className="flex items-center gap-2 text-[9px] font-black text-emerald-300"><CircleDot size={9} className="animate-pulse" />يعمل حالياً على</div>{activeItems.slice(0, 2).map((item) => <button key={item.id} type="button" onClick={() => onOpenItem(item.id)} className="flex w-full items-center gap-2 rounded-xl border border-emerald-300/10 bg-black/12 px-3 py-2.5 text-right transition hover:border-emerald-300/25 hover:bg-emerald-300/[0.035]"><span className="text-emerald-300/75">{item.kind === "project" ? <BriefcaseBusiness size={13} /> : <ListTodo size={13} />}</span><span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-300">{item.title}</span></button>)}{activeItems.length > 2 && <div className="text-[9px] text-slate-600">+{activeItems.length - 2} أعمال أخرى</div>}</div> : <div className="flex items-center gap-2 text-[10px] text-slate-600"><span className="h-2 w-2 rounded-full bg-slate-700" />لا يوجد عمل مسند حالياً</div>}</div>
    </div>
  );
}

function ConnectorVertical({ active = false }: { active?: boolean }) {
  return <div className={`h-7 w-px ${active ? "topology-flow-line topology-flow-vertical" : "bg-gradient-to-b from-cyan-300/35 to-cyan-300/12"}`} />;
}

function LiveStat({ label, value, icon, active = false, warning = false }: { label: string; value: number; icon: React.ReactNode; active?: boolean; warning?: boolean }) {
  return <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${warning ? "border-amber-300/15 bg-amber-300/[0.035]" : active ? "border-emerald-300/15 bg-emerald-300/[0.035]" : "border-white/8 bg-white/[0.025]"}`}><span className={warning ? "text-amber-300" : active ? "text-emerald-300" : "text-cyan-300"}>{icon}</span><div><div className="font-mono text-sm font-black text-white">{value}</div><div className="text-[9px] text-slate-600">{label}</div></div></div>;
}
