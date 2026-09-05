import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { taskService } from "@/services/taskService";
import { useAppStore, useSession } from "@/lib/store";
import { PRIORITY_LABELS, type TaskPriority } from "@/lib/types";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { getUser } from "@/services/userService";
import { hasPermission, scopedDepartments } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";
import { AttachmentPicker } from "@/components/task/AttachmentPicker";
import { VerbalTaskDialog } from "@/components/task/VerbalTaskDialog";
import type { Attachment } from "@/lib/types";

export const Route = createFileRoute("/tasks/new")({
  head: () => ({
    meta: [
      { title: "إنشاء تكليف — منظومة التكليفات" },
      { name: "description", content: "إصدار تكليف رسمي وإسناده لجهة التنفيذ في خطوات قليلة." },
      { property: "og:title", content: "إنشاء تكليف — منظومة التكليفات" },
      { property: "og:description", content: "إصدار تكليف رسمي وإسناده لجهة التنفيذ." },
    ],
  }),
  component: NewTaskPage,
});

function NewTaskPage() {
  const nav = useNavigate();
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const pushRecent = useSession((s) => s.pushRecentDepartment);
  const recent = useSession((s) => s.recentDepartments);
  const allDepts = useAppStore((s) => s.departments);
  const addAttachment = useAppStore((s) => s.addAttachment);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState(recent[0] || "");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [more, setMore] = useState(false);

  if (!user || !hasPermission(user, "create_task")) return <AccessDenied />;
  const scopeIds = scopedDepartments(user);
  const depts = (scopeIds ? allDepts.filter((d) => scopeIds.includes(d.id)) : allDepts).filter((d) => !d.archived);

  async function issue() {
    if (!title.trim() || !departmentId) return toast.error("العنوان والقسم مطلوبان");
    const dept = depts.find((d) => d.id === departmentId);
    const t = await taskService.create({
      title: title.trim(), description, departmentId, deptHeadId: dept?.headId,
      issuedById: uid, priority, status: "new",
    });
    for (const a of attachments) addAttachment(t.id, uid, a);
    pushRecent(departmentId);
    toast.success("تم إصدار التكليف وإشعار الجهة المعنية");
    nav({ to: "/tasks/$taskId", params: { taskId: t.id } });
  }

  return (
    <AppShell>
      <PageHeader
        title="تكليف جديد"
        subtitle="عنوان وقسم — والباقي اختياري"
        breadcrumbs={[{ to: "/tasks", label: "التكليفات" }, { label: "جديد" }]}
        actions={<VerbalTaskDialog />}
      />

      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label>عنوان التكليف *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: صيانة عاجلة للمقسم الرئيسي" className="h-11" />
          </div>

          <div className="space-y-2">
            <Label>القسم المسؤول *</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="h-11"><SelectValue placeholder="اختر القسم" /></SelectTrigger>
              <SelectContent>
                {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>التفاصيل (اختياري)</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="السياق والمطلوب…" />
          </div>

          <Collapsible open={more} onOpenChange={setMore}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="px-0 text-sm text-muted-foreground">
                <ChevronDown className={`h-4 w-4 me-1 transition-transform ${more ? "rotate-180" : ""}`} />
                خيارات إضافية
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label>الأولوية</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المرفقات</Label>
                <AttachmentPicker onChange={setAttachments} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Button size="lg" className="w-full" onClick={issue}>إصدار التكليف</Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
