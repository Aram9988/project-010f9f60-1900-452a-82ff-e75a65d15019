import { BriefcaseBusiness, CircleDot, ListTodo, Network, UserRound } from "lucide-react";
import type { Assignment } from "../v2/model";
import { descendants, roleOf, type OrgState, type OrgUser } from "./orgModel";

export default function TeamTree({ state, items, currentUserId, onOpenItem }: { state: OrgState; items: Assignment[]; currentUserId: string; onOpenItem: (id: string) => void }) {
  const current = state.users.find((u) => u.id === currentUserId);
  if (!current) return null;
  const currentRole = roleOf(state, current);
  const branchHead = state.users.find((u) => roleOf(state, u)?.key === "branch_head");
  const root = currentRole?.key === "branch_head" ? branchHead ?? current : current;
  const visibleIds = new Set([root.id, ...descendants(state, root.id).map((u) => u.id)]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <div className="flex items-center gap-2 text-[10px] tracking-[.2em] text-cyan-300/50"><Network size={14} /> LIVE ORGANIZATION</div>
        <h1 className="mt-2 text-2xl font-black">شجرة الفريق المباشرة</h1>
        <p className="mt-1 text-xs leading-6 text-slate-500">{currentRole?.key === "branch_head" ? "عرض كامل لفرع اتصالات ريف دمشق وما يعمل عليه كل فرد حالياً." : "عرض فريقك المباشر وما يعمل عليه كل فرد ضمن نطاقك."}</p>
      </div>

      <section className="tech-panel overflow-x-auto p-5 md:p-7">
        <div className="min-w-[760px]">
          {currentRole?.key === "branch_head" && <div className="mx-auto mb-4 w-fit rounded-2xl border border-cyan-300/18 bg-cyan-300/[0.045] px-5 py-3 text-center"><div className="text-[9px] font-bold text-cyan-300/60">الجهة</div><div className="mt-1 text-sm font-black">{state.branchName}</div></div>}
          <TreeNode user={root} state={state} items={items} visibleIds={visibleIds} onOpenItem={onOpenItem} level={0} />
        </div>
      </section>
    </div>
  );
}

function TreeNode({ user, state, items, visibleIds, onOpenItem, level }: { user: OrgUser; state: OrgState; items: Assignment[]; visibleIds: Set<string>; onOpenItem: (id: string) => void; level: number }) {
  const role = roleOf(state, user);
  const children = state.users.filter((u) => u.managerId === user.id && u.active && visibleIds.has(u.id));
  const active = items.filter((i) => (i.assigneeId ?? i.ownerId) === user.id && i.status !== "done");
  const dept = state.departments.find((d) => d.id === user.departmentId);
  const office = state.offices.find((o) => o.id === user.officeId);

  return (
    <div className={level ? "mt-4 border-r border-white/10 pr-6" : ""}>
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/8 bg-black/15 text-cyan-300"><UserRound size={17} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><div className="text-sm font-black text-slate-100">{user.name}</div><span className="rounded-lg border border-white/7 px-2 py-1 text-[9px] font-bold text-slate-500">{role?.name ?? "بدون دور"}</span></div>
            <div className="mt-1 text-[10px] text-slate-600">{office?.name ?? dept?.name ?? user.title ?? "إدارة الفرع"}</div>
          </div>
          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${active.length ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.65)]" : "bg-slate-700"}`} title={active.length ? "على عمل" : "بدون مهمة حالية"} />
        </div>

        <div className="mt-4 border-t border-white/7 pt-3">
          {active.length ? <div className="space-y-2">{active.slice(0, 3).map((item) => <button key={item.id} onClick={() => onOpenItem(item.id)} className="flex w-full items-center gap-2 rounded-xl border border-white/6 bg-black/10 px-3 py-2.5 text-right hover:border-cyan-300/15"><span className="text-cyan-300/70">{item.kind === "project" ? <BriefcaseBusiness size={13} /> : <ListTodo size={13} />}</span><span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-300">{item.title}</span><CircleDot size={9} className="text-emerald-400" /></button>)}{active.length > 3 && <div className="text-[9px] text-slate-600">+ {active.length - 3} أعمال أخرى</div>}</div> : <div className="text-[10px] text-slate-600">لا يوجد عمل مسند حالياً</div>}
        </div>
      </div>

      {children.length > 0 && <div className={`grid gap-4 ${level === 0 ? "mt-5 md:grid-cols-2 xl:grid-cols-3" : "mt-4"}`}>{children.map((child) => <TreeNode key={child.id} user={child} state={state} items={items} visibleIds={visibleIds} onOpenItem={onOpenItem} level={level + 1} />)}</div>}
    </div>
  );
}
