import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { taskService } from "@/services/taskService";
import { useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import type { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle2, RotateCcw, HelpCircle } from "lucide-react";
import { toast } from "sonner";

export function ApprovalPanel({ task }: { task: Task }) {
  const qc = useQueryClient();
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const canApprove = user?.role === "boss" || user?.role === "associate";
  const [reason, setReason] = useState("");

  if (!canApprove || task.status !== "submitted") return null;

  async function approve() {
    await taskService.approve(task.id, uid);
    qc.invalidateQueries({ queryKey: ["task", task.id] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    toast.success("تم اعتماد التكليف");
  }
  async function returnRev() {
    if (!reason.trim()) return toast.error("يرجى ذكر سبب الإعادة");
    await taskService.returnForRevision(task.id, uid, reason.trim());
    qc.invalidateQueries({ queryKey: ["task", task.id] });
    setReason("");
    toast.success("تمت إعادة التكليف للتعديل");
  }

  return (
    <div className="rounded-xl border border-gold/50 bg-gold/5 p-4">
      <h3 className="font-bold mb-1">هذا التكليف مقدم للمراجعة</h3>
      <p className="text-sm text-muted-foreground mb-4">
        قدم القسم التكليف للاعتماد. اختر إجراءً مناسباً.
      </p>
      <div className="flex flex-wrap gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="bg-success text-success-foreground hover:bg-success/90"><CheckCircle2 className="h-4 w-4 me-1" /> اعتماد وإنهاء</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد الاعتماد</AlertDialogTitle>
              <AlertDialogDescription>سيتم إغلاق التكليف نهائياً واعتباره منجزاً.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={approve}>اعتماد</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="border-destructive/40 text-destructive"><RotateCcw className="h-4 w-4 me-1" /> إعادة للتعديل</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إعادة التكليف للتعديل</DialogTitle></DialogHeader>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اذكر سبب الإعادة والمطلوب تعديله…" />
            <DialogFooter>
              <Button onClick={returnRev}>إعادة</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button variant="outline"><HelpCircle className="h-4 w-4 me-1" /> طلب معلومات إضافية</Button>
      </div>
    </div>
  );
}