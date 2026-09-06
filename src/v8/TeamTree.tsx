import { useMemo, useState } from "react";
import { BriefcaseBusiness, ChevronDown, ChevronUp, CircleDot, ListTodo, Network, Radio, UserRound, UsersRound } from "lucide-react";
import type { Assignment } from "../v2/model";
import { descendants, roleOf, type OrgState, type OrgUser } from "./orgModel";

export default function TeamTree({ state, items, currentUserId, onOpenItem }: { state: OrgState; items: Assignment[]; currentUserId: string; onOpenItem: (id: string) => void }) {
  const current = state.users.find((u) => u.id === currentUserId);
  if (!current) return null;

  const currentRole = roleOf(state, current);
  const branchHead = state.users.find((u) => roleOf(state, u)?.key === "branch_head");
  const root = currentRole?.key === "branch_head" ? branchHead ?? current : current;
  const visibleUsers = useMemo(() => [root, ...descendants(state, root.id)].filter((u) => u.active), [state, root]);
  const visibleIds = new Set(visibleUsers.map((u) => u.id));
  const workingCount = visibleUsers.filter((u) => items.some((i) => (i.assigneeId ?? i.ownerId) === u.id && i.status !== "done")).length;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] tracking-[.2em] text-cyan-300/50"><Network size={14} /> LIVE ORGANIZATION TOPOLOGY</div>
          <h1 className="mt-2 text-2xl font-black">المراقبة الحية للفريق</h1>
          <p className="mt-1 text-xs leading-6 text-slate-500">{currentRole?.key === "branch_head" ? "الهيكل الكامل للفرع مع حالة كل مستخدم والعمل المسند إليه حالياً." : "هيكل فريقك فقط مع حالة العمل الحالية لكل فرد."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LiveStat label="الأفراد" value={visibleUsers.length} icon={<UsersRound size={14} />} />
          <LiveStat label="على مهمة" value={workingCount} icon={<Radio size={14} />} active />
        </div>
      </div>

      <section className="tech-panel overflow-hidden">
        <div className="border-b border-white/7 px-4 py-3 text-[10px] text-slate-600 md:px-6">يمكنك تمرير المخطط أفقياً على الشاشات الصغيرة. اضغط على أي مهمة لفتحها، وعلى السهم لطي أو فتح الفرع.</div>
        <div className="topology-scroll overflow-auto p-5 md:p-8">
          <div className="mx-auto min-w-max px-6 pb-8 pt-2">
            {currentRole?.key === "branch_head" ? (
              <div className="flex flex-col items-center">
                <BranchRoot name={state.branchName} />
                <ConnectorVertical />
                <OrgNode user={root} state={state} items={items} visibleIds={visibleIds} onOpenItem={onOpenItem} isRoot />
              </div>
            ) : (
              <div className="flex justify-center">
                <OrgNode user={root} state={state} items={items} visibleIds={visibleIds} onOpenItem={onOpenItem} isRoot />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function BranchRoot({ name }: { name: string }) {
  return <div className="relative z-10 min-w-[260px] rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.07] px-6 py-4 text-center shadow-[0_0_35px_rgba(34,211,238,.06)]"><div className="text-[9px] font-black tracking-[.18em] text-cyan-300/55">BRANCH ROOT</div><div className="mt-1 text-sm font-black text-white">{name}</div></div>;
}

function OrgNode({ user, state, items, visibleIds, onOpenItem, isRoot = false }: { user: OrgUser; state: OrgState; items: Assignment[]; visibleIds: Set<string>; onOpenItem: (id: string) => void; isRoot?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const role = roleOf(state, user);
  const children = state.users.filter((u) => u.managerId === user.id && u.active && visibleIds.has(u.id));
  const activeItems = items.filter((i) => (i.assigneeId ?? i.ownerId) === user.id && i.status !== "done");
  const dept = state.departments.find((d) => d.id === user.departmentId);
  const office = state.offices.find((o) => o.id === user.officeId);
  const busy = activeItems.length > 0;

  return (
    <div className="flex flex-col items-center">
      <PersonNode user={user} roleName={role?.name ?? "بدون دور"} subtitle={office?.name ?? dept?.name ?? user.title ?? "إدارة الفرع"} activeItems={activeItems} onOpenItem={onOpenItem} isRoot={isRoot} childCount={children.length} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />

      {children.length > 0 && expanded && (
        <>
          <ConnectorVertical />
          <div className="relative flex items-start justify-center gap-7 px-4 pt-6">
            {children.length > 1 && <div className="absolute left-[calc(50%/var(--child-count,1))] right-[calc(50%/var(--child-count,1))] top-0 h-px bg-cyan-300/18" style={{ left: `${100 / (children.length * 2)}%`, right: `${100 / (children.length * 2)}%` }} />}
            {children.map((child) => (
              <div key={child.id} className="relative flex min-w-[250px] justify-center">
                <div className="absolute -top-6 left-1/2 h-6 w-px -translate-x-1/2 bg-cyan-300/18" />
                <OrgNode user={child} state={state} items={items} visibleIds={visibleIds} onOpenItem={onOpenItem} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PersonNode({ user, roleName, subtitle, activeItems, onOpenItem, isRoot, childCount, expanded, onToggle }: { user: OrgUser; roleName: string; subtitle: string; activeItems: Assignment[]; onOpenItem: (id: string) => void; isRoot: boolean; childCount: number; expanded: boolean; onToggle: () => void }) {
  const busy = activeItems.length > 0;
  return (
    <div className={`relative z-10 w-[250px] rounded-2xl border p-4 shadow-xl backdrop-blur ${isRoot ? "border-cyan-300/22 bg-cyan-300/[0.055]" : busy ? "border-emerald-300/18 bg-emerald-300/[0.035]" : "border-white/8 bg-[#0a1523]/95"}`}>
      <div className="flex items-start gap-3">
        <div className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${busy ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-300" : "border-white/8 bg-black/15 text-cyan-300"}`}>
          <UserRound size={17} />
          <span className={`absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#0a1523] ${busy ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.85)]" : "bg-slate-700"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black text-slate-100">{user.name}</div>
          <div className="mt-1 truncate text-[10px] text-slate-600">{subtitle}</div>
          <div className="mt-2 inline-flex rounded-lg border border-white/7 px-2 py-1 text-[9px] font-bold text-slate-500">{roleName}</div>
        </div>
        {childCount > 0 && <button type="button" onClick={onToggle} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/7 bg-white/[0.025] text-slate-500 hover:text-cyan-300" title={expanded ? "طي الفرع" : "فتح الفرع"}>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>}
      </div>

      <div className="mt-4 border-t border-white/7 pt-3">
        {busy ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[9px] font-black text-emerald-300"><CircleDot size={9} className="animate-pulse" />يعمل حالياً على</div>
            {activeItems.slice(0, 2).map((item) => <button key={item.id} type="button" onClick={() => onOpenItem(item.id)} className="flex w-full items-center gap-2 rounded-xl border border-emerald-300/10 bg-black/12 px-3 py-2.5 text-right transition hover:border-emerald-300/25 hover:bg-emerald-300/[0.035]"><span className="text-emerald-300/75">{item.kind === "project" ? <BriefcaseBusiness size={13} /> : <ListTodo size={13} />}</span><span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-300">{item.title}</span></button>)}
            {activeItems.length > 2 && <div className="text-[9px] text-slate-600">+{activeItems.length - 2} أعمال أخرى</div>}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[10px] text-slate-600"><span className="h-2 w-2 rounded-full bg-slate-700" />لا يوجد عمل مسند حالياً</div>
        )}
      </div>
    </div>
  );
}

function ConnectorVertical() {
  return <div className="h-7 w-px bg-gradient-to-b from-cyan-300/35 to-cyan-300/12" />;
}

function LiveStat({ label, value, icon, active = false }: { label: string; value: number; icon: React.ReactNode; active?: boolean }) {
  return <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${active ? "border-emerald-300/15 bg-emerald-300/[0.035]" : "border-white/8 bg-white/[0.025]"}`}><span className={active ? "text-emerald-300" : "text-cyan-300"}>{icon}</span><div><div className="font-mono text-sm font-black text-white">{value}</div><div className="text-[9px] text-slate-600">{label}</div></div></div>;
}
