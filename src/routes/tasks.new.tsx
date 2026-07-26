import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { taskService } from "@/services/taskService";
import { useAppStore, useSession } from "@/lib/store";
import { PRIORITY_LABELS, type TaskPriority } from "@/lib/types";
import { Mic, Save } from "lucide-react";
import { toast } from "sonner";
import { getUser } from "@/services/userService";
import { hasPermission, scopedDepartments } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";
import { AttachmentPicker } from "@/components/task/AttachmentPicker";
import type { Attachment } from "@/lib/types";

export const Route = createFileRoute("/tasks/new")({
  head: () => ({ meta: [{ title: "إنشاء تكليف — منظومة التكليفات" }] }),
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

  if (!user || !hasPermission(user, "create_task")) return <AccessDenied />;
  const scopeIds = scopedDepartments(user);
  const depts = scopeIds ? allDepts.filter((d) => scopeIds.includes(d.id) && !d.archived) : allDepts.filter((d) => !d.archived);

  async function create(status: "draft" | "new") {
    if (!title.trim() || !departmentId) return toast.error("العنوان والقسم مطلوبان");
    const dept = depts.find(d => d.id === departmentId);
    const t = await taskService.create({
      title: title.trim(), description, departmentId, deptHeadId: dept?.headId,
      issuedById: uid, priority, status,
    });
    for (const a of attachments) addAttachment(t.id, uid, a);
    pushRecent(departmentId);
    toast.success(status === "draft" ? "تم الحفظ كمسودة" : "تم إصدار التكليف وإشعار الجهات المعنية");
    nav({ to: "/tasks/$taskId", params: { taskId: t.id } });
  }

  return (
    <AppShell>
      <PageHeader
        title="إنشاء تكليف"
        subtitle="إصدار تكليف رسمي وإسناده لجهة التنفيذ"
        breadcrumbs={[{ to: "/dashboard", label: "الرئيسية" }, { to: "/tasks", label: "التكليفات" }, { label: "إنشاء" }]}
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-gold/50 text-gold-foreground bg-gold/10">
                <Mic className="h-4 w-4 me-1" /> تسجيل تكليف شفهي
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>تسجيل تكليف شفهي عاجل</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  وثّق تكليفاً صدر شفهياً — احفظه كمسودة الآن وأكمل تفاصيله لاحقاً.
                </div>
                <div className="space-y-2">
                  <Label>ملخص التكليف الشفهي</Label>
                  <Textarea rows={4} placeholder="اكتب ملخصاً سريعاً…" onChange={(e) => setTitle(e.target.value.slice(0, 120))} />
                </div>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger><SelectValue placeholder="الجهة المسؤولة" /></SelectTrigger>
                  <SelectContent>{depts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => create("draft")}><Save className="h-4 w-4 me-1" /> حفظ كمسودة</Button>
                <Button onClick={() => create("new")}>إصدار الآن</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardHeader><CardTitle>البيانات الأساسية</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>عنوان التكليف *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: صيانة عاجلة للمقسم الرئيسي" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>القسم / الجهة المسؤولة *</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                <SelectContent>
                  {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الأولوية</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>تفاصيل التكليف (اختياري)</Label>
            <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="السياق والمتطلبات والمخرجات المتوقعة…" />
          </div>
          <div className="space-y-2">
            <Label>المرفقات (اختياري)</Label>
            <AttachmentPicker onChange={setAttachments} />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => create("draft")}><Save className="h-4 w-4 me-1" /> حفظ كمسودة</Button>
            <Button onClick={() => create("new")}>إصدار التكليف</Button>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
