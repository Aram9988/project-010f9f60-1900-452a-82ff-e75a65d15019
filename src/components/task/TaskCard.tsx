import { Link } from "@tanstack/react-router";
import type { Task } from "@/lib/types";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { getDepartment } from "@/services/departmentService";
import { getUser } from "@/services/userService";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function TaskCard({ task }: { task: Task }) {
  const dept = getDepartment(task.departmentId);
  const assignee = task.assigneeId ? getUser(task.assigneeId) : task.deptHeadId ? getUser(task.deptHeadId) : undefined;
  const isCritical = task.priority === "critical";
  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className={cn(
        "block rounded-xl border bg-card p-4 transition-shadow hover:shadow-md",
        isCritical && "border-r-4 border-r-destructive",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground font-mono">{task.number}</div>
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
