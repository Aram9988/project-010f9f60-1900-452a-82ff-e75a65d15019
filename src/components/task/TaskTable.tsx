import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { getDepartment } from "@/services/departmentService";
import { getUser } from "@/services/userService";
import { fmtDate, isOverdue } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskTable({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">لا توجد تكليفات مطابقة.</div>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-right text-xs text-muted-foreground">
          <tr>
            <th className="p-3 font-medium">الرقم</th>
            <th className="p-3 font-medium">التكليف</th>
            <th className="p-3 font-medium">القسم</th>
            <th className="p-3 font-medium">المسؤول</th>
            <th className="p-3 font-medium">الأولوية</th>
            <th className="p-3 font-medium">الحالة</th>
            <th className="p-3 font-medium">المهلة</th>
            <th className="p-3 font-medium">الإنجاز</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const dept = getDepartment(t.departmentId);
            const assignee = t.assigneeId ? getUser(t.assigneeId) : t.deptHeadId ? getUser(t.deptHeadId) : undefined;
            const overdue = isOverdue(t.dueAt, t.status);
            return (
              <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3 font-mono text-xs whitespace-nowrap">{t.number}</td>
                <td className="p-3">
                  <Link to="/tasks/$taskId" params={{ taskId: t.id }} className="font-medium hover:text-primary flex items-center gap-2">
                    {t.confidential && <Lock className="h-3 w-3 text-gold" />}
                    <span className="line-clamp-1">{t.title}</span>
                  </Link>
                </td>
                <td className="p-3 whitespace-nowrap">{dept?.short}</td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">{assignee?.name || "—"}</td>
                <td className="p-3"><PriorityBadge priority={t.priority} /></td>
                <td className="p-3"><StatusBadge status={t.status} /></td>
                <td className={cn("p-3 whitespace-nowrap text-xs", overdue && "text-destructive font-semibold")}>{fmtDate(t.dueAt)}</td>
                <td className="p-3 w-32">
                  <div className="flex items-center gap-2">
                    <Progress value={t.progress} className="h-1.5 w-20" />
                    <span className="text-xs">{t.progress}٪</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}