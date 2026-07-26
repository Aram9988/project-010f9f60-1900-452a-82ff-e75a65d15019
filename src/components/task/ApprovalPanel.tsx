import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { taskService } from "@/services/taskService";
import { useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import type { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AttachmentPicker } from "./AttachmentPicker";
import { hasPermission } from "@/lib/authz";
import { useAppStore } from "@/lib/store";
import type { Attachment } from "@/lib/types";
import { CheckCircle2, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";

export function ApprovalPanel({ task }: { task: Task }) {
  const qc = useQueryClient();
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const addAttachment = useAppStore((s) => s.addAttachment);

  const canSubmit = hasPermission(user, "submit_task") && ["received","in_progress","waiting_info","blocked","returned"].includes(task.status);
  const canApprove = hasPermission(user, "approve_task") && task.status === "submitted";
  const canReturn = hasPermission(user, "return_task") && task.status === "submitted";

  const [summary, setSummary] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [reason, setReason] = useState("");

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["task", task.id] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["activity", task.id] });
    qc.invalidateQueries({ queryKey: ["comments", task.id] });
  }

  async function submit() {
    for (const a of pending) addAttachment(task.id, uid, a);
    await taskService.submit(task.id, uid, summary.trim() || undefined);
    setSummary(""); setPending([]);
    invalidate(); toast.success("تم إرسال التكليف للاعتماد");
  }
  async function approve() { await taskService.approve(task.id, uid); invalidate(); toast.success("تم اعتماد وإنهاء التكليف"); }
  async function returnRev() {
    if (!reason.trim()) return toast.error("سبب الإعادة مطلوب");
    await taskService.returnForRevision(task.id, uid, reason.trim());
    setReason(""); invalidate(); toast.success("تمت الإعادة للتعديل");
  }

  if (task.status === "approved") {
    return (
      <div className="rounded-xl border-2 border-success/50 bg-success/10 p-4">
        <div className="flex items-center gap-2 text-success-foreground">
          <CheckCircle2 className="h-5 w-5" /> <span className="font-bold">مكتمل ومعتمد</span>
        </div>
        {task.completionSummary && <p className="mt-2 text-sm">{task.completionSummary}</p>}
      </div>
    );
  }

  if (!canSubmit && !canApprove && !canReturn) return null;

  return (
    <div className="rounded-xl border border-gold/50 bg-gold/5 p-4 space-y-3">
      <h3 className="font-bold">إجراءات الاعتماد</h3>

      {canSubmit && (
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-1"><Send className="h-4 w-4" /> إرسال للاعتماد</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إرسال التكليف للاعتماد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block">ملخص الإنجاز (اختياري)</label>
                <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="اذكر ما تم إنجازه…" rows={4} />
              </div>
              <div>
                <label className="text-xs mb-1 block">مرفقات الإنجاز</label>
                <AttachmentPicker onChange={setPending} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit}>تأكيد الإرسال</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canApprove && (
        <div className="flex flex-wrap gap-2">
          <p className="w-full text-sm text-muted-foreground">
            قدم المسؤول التكليف للاعتماد. راجع ملخص الإنجاز والمرفقات ثم قرر.
          </p>
          <Button onClick={approve} className="bg-success text-success-foreground hover:bg-success/90">
            <CheckCircle2 className="h-4 w-4 me-1" /> اعتماد وإنهاء التكليف
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-destructive/40 text-destructive"><RotateCcw className="h-4 w-4 me-1" /> إعادة للتعديل</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>إعادة التكليف للتعديل</DialogTitle></DialogHeader>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اذكر سبب الإعادة والمطلوب تعديله…" rows={4} />
              <DialogFooter>
                <Button onClick={returnRev}>إعادة</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
