import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { taskService } from "@/services/taskService";
import { discussionService } from "@/services/discussionService";
import { getUser } from "@/services/userService";
import { getDepartment } from "@/services/departmentService";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { DiscussionThread } from "@/components/task/DiscussionThread";
import { ActivityTimeline } from "@/components/task/ActivityTimeline";
import { ApprovalPanel } from "@/components/task/ApprovalPanel";
import { UserAvatar } from "@/components/user-avatar";
import { fmtDateTime, fmtDate, isOverdue } from "@/lib/format";
import { useSession } from "@/lib/store";
import { AlarmClock, CheckCheck, FileText, Lock, Paperclip, Send, Upload, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks/$taskId")({
  head: () => ({ meta: [{ title: "تفاصيل التكليف — منظومة التكليفات" }] }),
  component: TaskDetail,
});

function TaskDetail() {
  const { taskId } = Route.useParams();
  const qc = useQueryClient();
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid)!;
  const { data: task, isLoading } = useQuery({ queryKey: ["task", taskId], queryFn: () => taskService.byId(taskId) });
  const { data: comments = [] } = useQuery({ queryKey: ["comments", taskId], queryFn: () => discussionService.listForTask(taskId) });

  if (isLoading) return <AppShell><div className="p-6 text-sm text-muted-foreground">جارٍ التحميل…</div></AppShell>;
  if (!task) return <AppShell><div className="p-6">تكليف غير موجود.</div></AppShell>;

  const dept = getDepartment(task.departmentId);
  const issuer = getUser(task.issuedById);
  const head = task.deptHeadId ? getUser(task.deptHeadId) : undefined;
  const assignee = task.assigneeId ? getUser(task.assigneeId) : undefined;
  const overdue = isOverdue(task.dueAt, task.status);
  const pendingInstructions = comments.filter((c) => c.isFormalInstruction && !c.acknowledgedByUserId).length;

  const canAck = task.status === "new" && (user.role === "dept_head" || user.role === "employee");
  const canSubmit = ["dept_head", "employee"].includes(user.role) && ["received", "in_progress"].includes(task.status);

  async function ack() { if (!task) return; await taskService.acknowledge(task.id, uid); qc.invalidateQueries({ queryKey: ["task", task.id] }); toast.success("تم تأكيد استلام التكليف"); }
  async function submit() { if (!task) return; await taskService.updateStatus(task.id, "submitted", uid); qc.invalidateQueries({ queryKey: ["task", task.id] }); toast.success("تم تقديم التكليف للمراجعة"); }

  return (
    <AppShell>
      <PageHeader
        title={task.title}
        subtitle={`${task.number} · صدر عن ${issuer?.name}`}
        breadcrumbs={[{ to: "/dashboard", label: "الرئيسية" }, { to: "/tasks", label: "التكليفات" }, { label: task.number }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canAck && <Button onClick={ack}><CheckCheck className="h-4 w-4 me-1" /> تأكيد الاستلام</Button>}
            {canSubmit && <Button onClick={submit} variant="outline"><Send className="h-4 w-4 me-1" /> تقديم للمراجعة</Button>}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        {task.confidential && <Badge variant="outline" className="gap-1 border-gold/50 text-gold-foreground bg-gold/10"><Lock className="h-3 w-3" /> سري</Badge>}
        {overdue && <Badge variant="destructive">متأخر</Badge>}
        {pendingInstructions > 0 && <Badge className="bg-gold text-gold-foreground">{pendingInstructions} توجيه بانتظار الاستلام</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <ApprovalPanel task={task} />

          <Card>
            <CardContent className="p-4">
              <p className="text-sm leading-7 whitespace-pre-wrap">{task.description}</p>
              {task.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {task.tags.map((t) => <Badge key={t} variant="secondary">#{t}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="all">
            <TabsList className="w-full flex-wrap h-auto">
              <TabsTrigger value="all">الكل</TabsTrigger>
              <TabsTrigger value="discussion">المناقشات</TabsTrigger>
              <TabsTrigger value="instructions">التوجيهات الرسمية</TabsTrigger>
              <TabsTrigger value="activity">سجل التنفيذ</TabsTrigger>
              <TabsTrigger value="attachments">المرفقات</TabsTrigger>
              <TabsTrigger value="subtasks">المهام الفرعية</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4 space-y-6">
              <section>
                <h3 className="mb-3 text-sm font-bold text-muted-foreground">المناقشات والتوجيهات</h3>
                <DiscussionThread taskId={task.id} />
              </section>
              <section>
                <h3 className="mb-3 text-sm font-bold text-muted-foreground">سجل التنفيذ</h3>
                <ActivityTimeline taskId={task.id} />
              </section>
            </TabsContent>
            <TabsContent value="discussion" className="mt-4"><DiscussionThread taskId={task.id} /></TabsContent>
            <TabsContent value="instructions" className="mt-4"><DiscussionThread taskId={task.id} filter="instructions" /></TabsContent>
            <TabsContent value="activity" className="mt-4"><ActivityTimeline taskId={task.id} /></TabsContent>
            <TabsContent value="attachments" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {task.attachments.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      <Paperclip className="mx-auto h-6 w-6 mb-2" />
                      لا توجد مرفقات
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {task.attachments.map((a) => (
                        <li key={a.id} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><span className="text-sm">{a.name}</span></div>
                          <span className="text-xs text-muted-foreground">{a.size}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button variant="outline" size="sm" className="mt-3"><Upload className="h-4 w-4 me-1" /> رفع مرفق</Button>
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
              <Row label="تاريخ الإصدار" value={fmtDateTime(task.issuedAt)} />
              <Row label="المهلة" value={fmtDate(task.dueAt)} icon={<AlarmClock className="h-3 w-3" />} danger={overdue} />
              {task.delayReason && (
                <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                  <div className="font-semibold mb-1">سبب التأخير / الإعادة:</div>{task.delayReason}
                </div>
              )}
              {task.completionSummary && (
                <div className="rounded-md bg-success/10 p-2 text-xs">
                  <div className="font-semibold mb-1">ملخص الإنجاز:</div>{task.completionSummary}
                </div>
              )}
              {task.approvedById && (
                <div className="rounded-md bg-success/15 p-2 text-xs text-success-foreground">
                  اعتُمد بواسطة {getUser(task.approvedById)?.name} — {fmtDate(task.approvedAt!)}
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

function Row({ label, value, icon, danger }: { label: string; value?: string; icon?: React.ReactNode; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium flex items-center gap-1 ${danger ? "text-destructive" : ""}`}>{icon}{value || "—"}</span>
    </div>
  );
}