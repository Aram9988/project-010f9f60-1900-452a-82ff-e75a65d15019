import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAppStore, useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { hasPermission, scopedDepartments } from "@/lib/authz";
import { taskService } from "@/services/taskService";
import { Mic } from "lucide-react";
import { toast } from "sonner";

/** Fastest possible path for a verbally issued task: summary + department. */
export function VerbalTaskDialog() {
  const nav = useNavigate();
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const allDepts = useAppStore((s) => s.departments);
  const pushRecent = useSession((s) => s.pushRecentDepartment);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  if (!hasPermission(user, "create_task")) return null;
  const scopeIds = scopedDepartments(user);
  const depts = (scopeIds ? allDepts.filter((d) => scopeIds.includes(d.id)) : allDepts).filter((d) => !d.archived);

  async function issue() {
    if (!title.trim() || !departmentId) return toast.error("الملخص والقسم مطلوبان");
    const dept = depts.find((d) => d.id === departmentId);
    const t = await taskService.create({
      title: title.trim().slice(0, 120), description: "", departmentId,
      deptHeadId: dept?.headId, issuedById: uid, priority: "normal", status: "new",
    });
    pushRecent(departmentId);
    setOpen(false); setTitle(""); setDepartmentId("");
    toast.success("تم إصدار التكليف");
    nav({ to: "/tasks/$taskId", params: { taskId: t.id } });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="border-gold/50 bg-gold/10 text-gold">
          <Mic className="h-4 w-4 me-1" /> تكليف شفهي
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>تسجيل تكليف شفهي</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>ملخص التكليف</Label>
            <Textarea rows={3} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اكتب ملخصاً سريعاً…" />
          </div>
          <div className="space-y-2">
            <Label>القسم المسؤول</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
              <SelectContent>{depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button size="lg" onClick={issue}>إصدار الآن</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
