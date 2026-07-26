import { useQuery } from "@tanstack/react-query";
import { taskService } from "@/services/taskService";
import { ACTIVITY_LABELS } from "@/lib/types";
import { getUser } from "@/services/userService";
import { fmtDateTime } from "@/lib/format";

export function ActivityTimeline({ taskId }: { taskId: string }) {
  const { data: events = [] } = useQuery({
    queryKey: ["activity", taskId],
    queryFn: () => taskService.activityFor(taskId),
  });
  if (events.length === 0) {
    return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">لا توجد أحداث بعد.</div>;
  }
  return (
    <ol className="relative space-y-4 border-r-2 border-border pr-6">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -right-[29px] top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary ring-4 ring-background" />
          <div className="text-sm font-semibold">{ACTIVITY_LABELS[e.type]}</div>
          <div className="text-xs text-muted-foreground">
            {getUser(e.actorId)?.name} · {fmtDateTime(e.createdAt)}
            {e.detail && <> · {e.detail}</>}
          </div>
        </li>
      ))}
    </ol>
  );
}