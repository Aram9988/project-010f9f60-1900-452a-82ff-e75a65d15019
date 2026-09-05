import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { taskService } from "@/services/taskService";
import { useAppStore, useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { getDepartment } from "@/services/departmentService";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { DiscussionThread } from "@/components/task/DiscussionThread";
import { ActivityTimeline } from "@/components/task/ActivityTimeline";
import { ApprovalPanel } from "@/components/task/ApprovalPanel";
import { TaskActionsMenu } from "@/components/task/TaskActionsMenu";
import { fmtDateTime } from "@/lib/format";
import { Archive, CheckCheck, FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { hasPermission, canAccessTask } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";
import { downloadAttachment } from "@/lib/attachment-repo";
import { useMemo } from "react";

export const Route = createFileRoute("/tasks/$taskId")({
  validateSearch: z.object({ commentId: z.string().optional() }).partial(),
  head: () => ({ meta: [{ title: "تفاصيل التكليف — منظومة التكليفات" }] }),
  component: TaskDetail,
});

function TaskDetail() {
  const { taskId } = Route.useParams();
  const { commentId: highlightCommentId } = Route.useSearch();
  const qc = useQueryClient();
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const task = useAppStore((s) => s.tasks.find((t) => t.id === taskId));
  const allComments = useAppStore((s) => s.comments);

  const comments = useMemo(
    () => (Array.isArray(allComments) ? allComments : []).filter((c) => c?.taskId === taskId),
    [allComments, taskId],
  );

  if (!task) return <AppShell><div className="p-6">التكليف غير موجود.</div></AppShell>;
  if (!user || !canAccessTask(user, task)) return <AccessDenied />;

  const dept = getDepartment(task.departmentId);
  const issuer = getUser(task.issuedById);
  const head = task.deptHeadId ? getUser(task.deptHeadId) : undefined;
  const assignee = task.assigneeId ? getUser(task.assigneeId) : undefined;
  const pendingInstructions = comments.filter((c) => c.isFormalInstruction && !c.acknowledgedByUserId).length;

  const canAck = hasPermission(user, "acknowledge_task") && task.status === "new" &&
    (task.deptHeadId === uid || task.assigneeId === uid || task.participantIds.includes(uid));

  async function ack() {
    await taskService.acknowledge(task.id, uid);
    qc.invalidateQueries();
    toast.success("تم تأكيد استلام التكليف");
  }

  return (
    <AppShell>
      <PageHeader
        title={task.title}
        subtitle={`${task.number} · صدر عن ${issuer?.name ?? "—"}`}
        breadcrumbs={[{ to: "/tasks", label: "التكليفات" }, { label: task.number }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canAck && <Button onClick={ack}><CheckCheck className="h-4 w-4 me-1" /> تأكيد الاستلام</Button>}
            <TaskActionsMenu task={task} />
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        <span className="text-sm text-muted-foreground">{dept?.name ?? "—"}</span>
        {task.archived && <Badge variant="outline"><Archive className="h-3 w-3 me-1" /> مؤرشف</Badge>}
        {pendingInstructions > 0 && <Badge className="bg-gold text-gold-foreground">{pendingInstructions} توجيه بانتظار الاستلام</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <ApprovalPanel task={task} />

          {task.description && (
            <Card>
              <CardContent className="p-4">
                <p className="whitespace-pre-wrap text-sm leading-7">{task.description}</p>
              </CardContent>
            </Card>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">المتابعة والتحديثات</h2>
            </div>
            <DiscussionThread taskId={task.id} highlightCommentId={highlightCommentId} />
          </section>

          <Accordion type="single" collapsible className="rounded-xl border bg-card px-4">
            <AccordionItem value="execution" className="border-none">
              <AccordionTrigger className="text-base font-bold">سجل التنفيذ والمرفقات</AccordionTrigger>
              <AccordionContent className="space-y-6 pt-2">
                <div>
                  <h3 className="mb-3 text-sm font-semibold">سجل التنفيذ</h3>
                  <ActivityTimeline taskId={task.id} />
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold">المرفقات</h3>
                  {task.attachments.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">لا توجد مرفقات مباشرة على التكليف.</div>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {task.attachments.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-3 p-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-primary" />
                            <span className="truncate text-sm">{a.name}</span>
                            <span className="text-xs text-muted-foreground">{a.size}</span>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => downloadAttachment(a.id, a.name, a.dataUrl)}>
                            <Paperclip className="h-3.5 w-3.5 me-1" /> تنزيل
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <aside>
          <Card className="sticky top-24">
            <CardHeader className="pb-2"><CardTitle className="text-base">ملخص التكليف</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="الحالة" value={<StatusBadge status={task.status} />} />
              <Row label="القسم" value={dept?.name ?? "—"} />
              <Row label="رئيس القسم" value={head?.name ?? "—"} />
              <Row label="المسؤول" value={assignee?.name ?? head?.name ?? "—"} />
              <Row label="الأولوية" value={<PriorityBadge priority={task.priority} />} />
              <Row label="تاريخ الإصدار" value={fmtDateTime(task.issuedAt)} />

              {task.delayReason && (
                <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                  <div className="mb-1 font-semibold">سبب الإعادة</div>
                  {task.delayReason}
                </div>
              )}

              {task.completionSummary && (
                <div className="rounded-lg bg-success/10 p-3 text-xs text-success">
                  <div className="mb-1 font-semibold">ملخص الإنجاز</div>
                  {task.completionSummary}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-left font-medium">{value}</div>
    </div>
  );
}
