import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { UserAvatar } from "@/components/user-avatar";
import { fmtDateTime } from "@/lib/format";
import { AlarmClock, Archive, CheckCheck, FileText, Paperclip, User } from "lucide-react";
import { toast } from "sonner";
import { hasPermission, canAccessTask } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";
import { AttachmentPicker } from "@/components/task/AttachmentPicker";
import { useMemo, useState } from "react";
import type { Attachment } from "@/lib/types";
import { downloadAttachment, attachmentRepo } from "@/lib/attachment-repo";

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
  const user = getUser(uid)!;
  const task = useAppStore((s) => s.tasks.find((t) => t.id === taskId));
  const addAttachment = useAppStore((s) => s.addAttachment);
  const removeAttachment = useAppStore((s) => s.removeAttachment);
  const allComments = useAppStore((s) => s.comments);
  const comments = useMemo(
    () => (Array.isArray(allComments) ? allComments : []).filter((c) => c && c.taskId === taskId),
    [allComments, taskId],
  );
  const [pendingAtt, setPendingAtt] = useState<Attachment[]>([]);

  if (!task) return <AppShell><div className="p-6">تكليف غير موجود.</div></AppShell>;
  if (!canAccessTask(user, task)) return <AccessDenied />;

  const dept = getDepartment(task.departmentId);
  const issuer = getUser(task.issuedById);
  const head = task.deptHeadId ? getUser(task.deptHeadId) : undefined;
  const assignee = task.assigneeId ? getUser(task.assigneeId) : undefined;
  const pendingInstructions = comments.filter((c) => c.isFormalInstruction && !c.acknowledgedByUserId).length;

  const canAck = hasPermission(user, "acknowledge_task") && task.status === "new"
    && (task.deptHeadId === uid || task.assigneeId === uid || task.participantIds.includes(uid));
  const canRemoveAttachment = hasPermission(user, "remove_attachment");
  const isLocked = task.archived || task.status === "approved";

  const currentTask = task;
  async function ack() { await taskService.acknowledge(currentTask.id, uid); qc.invalidateQueries(); toast.success("تم تأكيد استلام التكليف"); }
  async function uploadPending() {
    for (const a of pendingAtt) addAttachment(currentTask.id, uid, a);
    setPendingAtt([]);
    toast.success("تم رفع المرفقات");
  }

  return (
    <AppShell>
      <PageHeader
        title={task.title}
        subtitle={`${task.number} · صدر عن ${issuer?.name}`}
        breadcrumbs={[{ to: "/dashboard", label: "الرئيسية" }, { to: "/tasks", label: "التكليفات" }, { label: task.number }]}
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            {canAck && <Button onClick={ack}><CheckCheck className="h-4 w-4 me-1" /> تأكيد الاستلام</Button>}
            <TaskActionsMenu task={task} />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        {task.archived && <Badge variant="outline" className="gap-1"><Archive className="h-3 w-3" /> مؤرشف</Badge>}
        {pendingInstructions > 0 && <Badge className="bg-gold text-gold-foreground">{pendingInstructions} توجيه بانتظار الاستلام</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <ApprovalPanel task={task} />

          <Card>
            <CardContent className="p-4">
              <p className="text-sm leading-7 whitespace-pre-wrap">{task.description || "— لا يوجد وصف —"}</p>
              {task.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {task.tags.map((t) => <Badge key={t} variant="secondary">#{t}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue={highlightCommentId ? "discussion" : "discussion"}>
            <TabsList className="w-full flex-wrap h-auto">
              <TabsTrigger value="discussion">المناقشات</TabsTrigger>
              <TabsTrigger value="instructions">التوجيهات الرسمية</TabsTrigger>
              <TabsTrigger value="activity">سجل التنفيذ</TabsTrigger>
              <TabsTrigger value="attachments">المرفقات ({task.attachments.length})</TabsTrigger>
              <TabsTrigger value="subtasks">المهام الفرعية</TabsTrigger>
            </TabsList>
            <TabsContent value="discussion" className="mt-4">
              <DiscussionThread taskId={task.id} highlightCommentId={highlightCommentId} />
            </TabsContent>
            <TabsContent value="instructions" className="mt-4"><DiscussionThread taskId={task.id} filter="instructions" /></TabsContent>
            <TabsContent value="activity" className="mt-4"><ActivityTimeline taskId={task.id} /></TabsContent>
            <TabsContent value="attachments" className="mt-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  {task.attachments.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      <Paperclip className="mx-auto h-6 w-6 mb-2" />
                      لا توجد مرفقات
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {task.attachments.map((a) => (
                        <li key={a.id} className="flex items-center justify-between py-2 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-sm truncate">{a.name}</span>
                            <span className="text-xs text-muted-foreground">· {a.size}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="text-xs text-primary" onClick={() => downloadAttachment(a.id, a.name, a.dataUrl)}>تنزيل</Button>
                            {canRemoveAttachment && !isLocked && (
                              <Button size="sm" variant="ghost" onClick={() => {
                                if (confirm("حذف المرفق نهائياً؟ سيُسجل الحذف في سجل التنفيذ.")) {
                                  attachmentRepo.delete(a.id);
                                  removeAttachment(task.id, uid, a.id);
                                }
                              }}>حذف</Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {hasPermission(user, "upload_attachment") && !isLocked && (
                    <>
                      <AttachmentPicker onChange={setPendingAtt} />
                      {pendingAtt.length > 0 && <Button onClick={uploadPending}>رفع {pendingAtt.length} مرفق</Button>}
                    </>
                  )}
                  {isLocked && (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      {task.archived ? "التكليف مؤرشف — لا يمكن تعديل المرفقات." : "تم اعتماد التكليف — لا يمكن تعديل المرفقات."}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="subtasks" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {task.subtasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">لا توجد مهام فرعية</div>
                  ) : (
                    <ul className="space-y-2">
                      {task.subtasks.map((s) => (
                        <li key={s.id} className={`flex items-center gap-3 rounded-md border p-2 ${s.done ? "bg-success/5" : ""}`}>
                          <input type="checkbox" defaultChecked={s.done} className="h-4 w-4 accent-primary" />
                          <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.title}</span>
                          {s.assigneeId && <span className="ms-auto text-xs text-muted-foreground">{getUser(s.assigneeId)?.name}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">ملخص التكليف</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-1">نسبة الإنجاز</div>
                <div className="flex items-center gap-2">
                  <Progress value={task.progress} className="h-2 flex-1" />
                  <span className="text-xs font-semibold w-10 text-left">{task.progress}٪</span>
                </div>
              </div>
              <Row label="القسم" value={dept?.name} />
              <Row label="رئيس القسم" value={head?.name} />
              <Row label="المسؤول" value={assignee?.name} icon={<User className="h-3 w-3" />} />
              <Row label="تاريخ الإصدار" value={fmtDateTime(task.issuedAt)} icon={<AlarmClock className="h-3 w-3" />} />
              {task.delayReason && (
                <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                  <div className="font-semibold mb-1">سبب الإعادة:</div>{task.delayReason}
                </div>
              )}
              {task.completionSummary && (
                <div className="rounded-md bg-success/10 p-2 text-xs text-success">
                  <div className="font-semibold mb-1">ملخص الإنجاز:</div>{task.completionSummary}
                </div>
              )}
              {task.approvedById && (
                <div className="rounded-md bg-success/15 p-2 text-xs text-success">
                  اعتُمد بواسطة {getUser(task.approvedById)?.name} — {fmtDateTime(task.approvedAt!)}
                </div>
              )}
              {task.archived && (
                <div className="rounded-md bg-muted p-2 text-xs">
                  <div className="font-semibold mb-1">مؤرشف بواسطة {getUser(task.archivedById)?.name}</div>
                  {task.archiveReason}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">المشاركون</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[task.issuedById, task.deptHeadId, task.assigneeId, ...task.participantIds].filter(Boolean).map((id) => {
                const u = getUser(id!); if (!u) return null;
                return (
                  <div key={id} className="flex items-center gap-2">
                    <UserAvatar user={u} size={28} />
                    <div className="text-xs"><div className="font-medium">{u.name}</div><div className="text-muted-foreground">{u.rank}</div></div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

function Row({ label, value, icon }: { label: string; value?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium flex items-center gap-1">{icon}{value || "—"}</span>
    </div>
  );
}
