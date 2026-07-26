import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { getDepartment } from "@/services/departmentService";
import { getUser } from "@/services/userService";
import { fmtDate, isOverdue } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Lock, AlarmClock } from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskCard({ task }: { task: Task }) {
  const dept = getDepartment(task.departmentId);
  const assignee = task.assigneeId ? getUser(task.assigneeId) : task.deptHeadId ? getUser(task.deptHeadId) : undefined;
  const overdue = isOverdue(task.dueAt, task.status);
  const isCritical = task.priority === "critical";
  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className={cn(
        "block rounded-xl border bg-card p-4 transition-shadow hover:shadow-md",
        isCritical && "border-r-4 border-r-destructive",
        !isCritical && overdue && "border-r-4 border-r-destructive/70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{task.number}</span>
            {task.confidential && <Lock className="h-3 w-3 text-gold" />}
          </div>
          <h3 className="mt-1 font-bold text-sm leading-6 line-clamp-2">{task.title}</h3>
        </div>
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        <span>{dept?.short}</span>
        {assignee && <><span>·</span><span>{assignee.name}</span></>}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <StatusBadge status={task.status} />
        <span className={cn("flex items-center gap-1", overdue && "text-destructive font-semibold")}>
          <AlarmClock className="h-3 w-3" /> {fmtDate(task.dueAt)}
        </span>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
          <span>الإنجاز</span>
          <span>{task.progress}٪</span>
        </div>
        <Progress value={task.progress} className="h-1.5" />
      </div>
    </Link>
  );
}