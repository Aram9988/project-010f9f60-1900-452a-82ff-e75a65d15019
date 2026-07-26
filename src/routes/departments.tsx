import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAppStore, useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { hasPermission } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";
import { Building2, Pencil, Plus, Archive, RotateCcw, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import type { Department } from "@/lib/types";

export const Route = createFileRoute("/departments")({
  head: () => ({ meta: [{ title: "الأقسام — منظومة التكليفات" }] }),
  component: DeptsPage,
});

function DeptsPage() {
  const user = getUser(useSession((s) => s.currentUserId));
  const depts = useAppStore((s) => s.departments);
  const users = useAppStore((s) => s.users);
  const tasks = useAppStore((s) => s.tasks);
  const createDepartment = useAppStore((s) => s.createDepartment);
  const updateDepartment = useAppStore((s) => s.updateDepartment);
  const archiveDept = useAppStore((s) => s.archiveDepartment);
  const restoreDept = useAppStore((s) => s.restoreDepartment);
  const deleteDept = useAppStore((s) => s.deleteDepartment);

  const [editing, setEditing] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);

  if (!user || !hasPermission(user, "manage_departments")) return <AccessDenied />;

  return (
    <AppShell>
      <PageHeader
        title="الأقسام"
        subtitle="إدارة أقسام فرع اتصالات ريف دمشق ورؤسائها ومسؤولي المكاتب"
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 me-1" /> قسم جديد</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {depts.map((d) => {
          const head = getUser(d.headId);
          const office = d.officeResponsibleId ? getUser(d.officeResponsibleId) : undefined;
          const members = users.filter((u) => u.departmentId === d.id && !u.archived);
          const deptTasks = tasks.filter((t) => t.departmentId === d.id && !t.archived);
          const open = deptTasks.filter((t) => !["approved","cancelled","archived"].includes(t.status)).length;
          return (
            <Card key={d.id} className={d.archived ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">{d.name}</h3>
                        {d.code && <Badge variant="outline" className="text-[10px]">{d.code}</Badge>}
                        {d.archived && <Badge variant="outline">مؤرشف</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">رئيس القسم: {head?.name || "—"}</div>
                      {office && <div className="text-xs text-muted-foreground">مسؤول المكتب: {office.name}</div>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(d)}><Pencil className="h-4 w-4" /></Button>
                    {d.archived ? (
                      <Button size="icon" variant="ghost" onClick={() => restoreDept(d.id)}><RotateCcw className="h-4 w-4" /></Button>
                    ) : (
                      <Button size="icon" variant="ghost" onClick={() => archiveDept(d.id)}><Archive className="h-4 w-4" /></Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => {
                      if (!confirm("حذف القسم نهائياً؟")) return;
                      const res = deleteDept(d.id);
                      if (!res.ok) toast.error(res.reason || "لا يمكن الحذف");
                      else toast.success("تم الحذف");
                    }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-md bg-muted p-2"><div className="text-lg font-bold">{deptTasks.length}</div><div className="text-[10px] text-muted-foreground">إجمالي</div></div>
                  <div className="rounded-md bg-info/10 p-2"><div className="text-lg font-bold text-info">{open}</div><div className="text-[10px] text-muted-foreground">مفتوحة</div></div>
                  <div className="rounded-md bg-success/10 p-2"><div className="text-lg font-bold text-success">{deptTasks.length - open}</div><div className="text-[10px] text-muted-foreground">مغلقة</div></div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3 w-3" /> {members.length} موظف نشط</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DeptDialog
        open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }}
        initial={editing || undefined}
        onSave={(patch) => {
          if (editing) { updateDepartment(editing.id, patch); toast.success("تم حفظ التعديلات"); }
          else { createDepartment(patch as any); toast.success("تم إنشاء القسم"); }
        }}
      />
    </AppShell>
  );
}

function DeptDialog({ open, onClose, initial, onSave }: {
  open: boolean; onClose: () => void; initial?: Department;
  onSave: (patch: Partial<Department>) => void;
}) {
  const users = useAppStore((s) => s.users).filter((u) => !u.archived);
  const [name, setName] = useState(initial?.name || "");
  const [short, setShort] = useState(initial?.short || "");
  const [code, setCode] = useState(initial?.code || "");
  const [headId, setHeadId] = useState(initial?.headId || "");
  const [officeResponsibleId, setOfficeResponsibleId] = useState(initial?.officeResponsibleId || "");

  const heads = users.filter((u) => u.role === "dept_head" || u.role === "boss" || u.role === "associate");
  const offices = users.filter((u) => u.role === "office");

  function submit() {
    if (!name.trim() || !short.trim() || !headId) return toast.error("الاسم والمختصر ورئيس القسم مطلوبون");
    onSave({ name: name.trim(), short: short.trim(), code: code.trim() || undefined, headId, officeResponsibleId: officeResponsibleId || undefined });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "تعديل القسم" : "قسم جديد"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>الاسم الكامل</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>المختصر</Label><Input value={short} onChange={(e) => setShort(e.target.value)} /></div>
            <div><Label>الكود</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="اختياري" /></div>
          </div>
          <div><Label>رئيس القسم</Label>
            <Select value={headId} onValueChange={setHeadId}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>{heads.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>مسؤول المكتب المرتبط (اختياري)</Label>
            <Select value={officeResponsibleId || "__none"} onValueChange={(v) => setOfficeResponsibleId(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="لا يوجد" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">لا يوجد</SelectItem>
                {offices.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
