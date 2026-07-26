import { cn } from "@/lib/utils";
import { STATUS_LABELS, PRIORITY_LABELS, type TaskStatus, type TaskPriority } from "@/lib/types";

const statusStyles: Record<TaskStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  new: "bg-info/10 text-info border-info/30",
  received: "bg-primary/10 text-primary border-primary/30",
  in_progress: "bg-info/10 text-info border-info/30",
  waiting_info: "bg-warning/15 text-warning-foreground border-warning/40",
  blocked: "bg-destructive/10 text-destructive border-destructive/30",
  submitted: "bg-gold/15 text-gold-foreground border-gold/40",
  returned: "bg-destructive/10 text-destructive border-destructive/30",
  approved: "bg-success/15 text-success-foreground border-success/40",
  cancelled: "bg-muted text-muted-foreground border-border",
  archived: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", statusStyles[status], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABELS[status]}
    </span>
  );
}

const priorityStyles: Record<TaskPriority, string> = {
  normal: "bg-muted text-muted-foreground border-border",
  important: "bg-info/10 text-info border-info/30",
  urgent: "bg-gold/15 text-gold-foreground border-gold/40",
  critical: "bg-destructive/15 text-destructive border-destructive/40",
};

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold", priorityStyles[priority], className)}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}