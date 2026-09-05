import { useNavigate } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { getDepartment } from "@/services/departmentService";
import { fmtRelative } from "@/lib/format";

export function TaskTable({ tasks }: { tasks: Task[] }) {
  const nav = useNavigate();
  if (tasks.length === 0) {
    return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">لا توجد تكليفات مطابقة.</div>;
  }
  const open = (id: string) => nav({ to: "/tasks/$taskId", params: { taskId: id } });
  const lastUpdate = (t: Task) => t.approvedAt || t.submittedAt || t.updatedAt || t.issuedAt;

  return (
    <>
      {/* Mobile: compact cards */}
      <ul className="space-y-2 md:hidden">
        {tasks.map((t) => (
          <li key={t.id}>
            <button onClick={() => open(t.id)} className="w-full rounded-xl border bg-card p-4 text-right transition-shadow hover:shadow-md">
              <div className="text-[11px] font-mono text-muted-foreground">{t.number}</div>
              <div className="mt-1 font-bold leading-6">{t.title}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={t.status} />
                <PriorityBadge priority={t.priority} />
                <span className="text-xs text-muted-foreground">{getDepartment(t.departmentId)?.short}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* Desktop: one simple table */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-right text-xs text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">التكليف</th>
              <th className="p-3 font-medium">القسم</th>
              <th className="p-3 font-medium">الحالة</th>
              <th className="p-3 font-medium">الأولوية</th>
              <th className="p-3 font-medium">آخر تحديث</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} onClick={() => open(t.id)} className="cursor-pointer border-t border-border hover:bg-muted/40">
                <td className="p-3">
                  <div className="text-[11px] font-mono text-muted-foreground">{t.number}</div>
                  <div className="font-medium line-clamp-1">{t.title}</div>
                </td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">{getDepartment(t.departmentId)?.short}</td>
                <td className="p-3"><StatusBadge status={t.status} /></td>
                <td className="p-3"><PriorityBadge priority={t.priority} /></td>
                <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">{fmtRelative(lastUpdate(t))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
