import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MoreHorizontal, Archive, RotateCcw, Trash2 } from "lucide-react";
import { hasPermission } from "@/lib/authz";
import { useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { taskService } from "@/services/taskService";
import type { Task } from "@/lib/types";
import { toast } from "sonner";

export function TaskActionsMenu({ task, onChanged }: { task: Task; onChanged?: () => void }) {
  const qc = useQueryClient();
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const canArchive = hasPermission(user, "delete_task");
  const canRestore = hasPermission(user, "restore_task");
  const canDelete = hasPermission(user, "permanently_delete_task");

  if (!canArchive && !canRestore && !canDelete) return null;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["task", task.id] });
    qc.invalidateQueries({ queryKey: ["activity", task.id] });
    onChanged?.();
  }

  async function doArchive() {
    if (!reason.trim()) return toast.error("سبب الأرشفة مطلوب");
    await taskService.archive(task.id, uid, reason.trim());
    setArchiveOpen(false); setReason("");
    invalidate(); toast.success("تمت أرشفة التكليف");
  }
  async function doRestore() { await taskService.restore(task.id, uid); invalidate(); toast.success("تمت الاستعادة"); }
  async function doDelete() {
    if (confirmText !== "حذف") return toast.error("اكتب: حذف — للتأكيد النهائي");
    await taskService.permanentlyDelete(task.id, uid);
    setDeleteOpen(false); setConfirmText("");
    invalidate(); toast.success("تم الحذف النهائي");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" title="إدارة التكليف"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canArchive && !task.archived && (
            <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
              <Archive className="h-4 w-4 me-2" /> أرشفة التكليف
            </DropdownMenuItem>
          )}
          {canRestore && task.archived && (
            <DropdownMenuItem onClick={doRestore}>
              <RotateCcw className="h-4 w-4 me-2" /> استعادة من الأرشيف
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive">
                <Trash2 className="h-4 w-4 me-2" /> حذف نهائي
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>أرشفة التكليف</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            سيتم إخفاء التكليف من العروض النشطة مع الاحتفاظ بكامل سجل التنفيذ. يمكن استعادته لاحقاً.
          </p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الأرشفة (إلزامي)…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)}>إلغاء</Button>
            <Button onClick={doArchive}>تأكيد الأرشفة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive">حذف نهائي — لا يمكن التراجع</DialogTitle></DialogHeader>
          <p className="text-sm">
            سيتم حذف التكليف بشكل دائم من قاعدة البيانات. اكتب كلمة <b>حذف</b> للتأكيد.
          </p>
          <Textarea value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="اكتب: حذف" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={doDelete}>حذف نهائي</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
