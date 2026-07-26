import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore, useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { canAccessTask } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";
import type { AppNotification } from "@/lib/types";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "الإشعارات — منظومة التكليفات" }] }),
  component: NotifsPage,
});

type ReadFilter = "all" | "unread" | "read";

function safeDate(iso: string | undefined) {
  if (!iso) return "";
  try { return fmtDateTime(iso); } catch { return String(iso); }
}

function NotifsPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const all = useAppStore((s) => s.notifications);
  const tasks = useAppStore((s) => s.tasks);
  const markRead = useAppStore((s) => s.markNotifRead);
  const markUnread = useAppStore((s) => s.markNotifUnread);
  const markAllRead = useAppStore((s) => s.markAllNotifsRead);
  const [filter, setFilter] = useState<ReadFilter>("all");

  const notifs = useMemo(() => {
    const list = (Array.isArray(all) ? all : []).filter((n) => n && n.userId === uid);
    list.sort((a, b) => String(b?.createdAt ?? "").localeCompare(String(a?.createdAt ?? "")));
    if (filter === "unread") return list.filter((n) => !n.read);
    if (filter === "read") return list.filter((n) => n.read);
    return list;
  }, [all, uid, filter]);

  const unreadCount = useMemo(() => (Array.isArray(all) ? all : []).filter((n) => n && n.userId === uid && !n.read).length, [all, uid]);

  if (!user) return <AccessDenied />;
  if (user.role === "diwan") return <AccessDenied message="الديوان لا يستقبل إشعارات تشغيلية." />;

  function invalidate() { qc.invalidateQueries(); }

  function open(n: AppNotification) {
    try {
      if (n.type === "password_request") {
        markRead(n.id); invalidate();
        nav({ to: "/change-password" });
        return;
      }
      if (!n.taskId) { markRead(n.id); invalidate(); return; }
      const task = tasks.find((t) => t.id === n.taskId);
      if (!task) {
        markRead(n.id); invalidate();
        toast.error("التكليف المرتبط بهذا الإشعار لم يعد متاحاً.");
        return;
      }
      if (!canAccessTask(user, task)) {
        markRead(n.id); invalidate();
        toast.error("لا تملك صلاحية الوصول إلى هذا التكليف.");
        return;
      }
      markRead(n.id); invalidate();
      nav({ to: "/tasks/$taskId", params: { taskId: task.id }, search: n.commentId ? { commentId: n.commentId } : {} });
    } catch (err) {
      console.error("notification open failed", err, n);
      toast.error("تعذّر فتح الإشعار.");
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="الإشعارات"
        subtitle={`${unreadCount} إشعار غير مقروء`}
        actions={<Button variant="outline" onClick={() => { markAllRead(uid); invalidate(); }}><CheckCheck className="h-4 w-4 me-1" /> تعليم الكل كمقروء</Button>}
      />
      <div className="mb-3 flex gap-1">
        {(["all","unread","read"] as ReadFilter[]).map((k) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
            {k === "all" ? "الكل" : k === "unread" ? "غير مقروء" : "مقروء"}
          </Button>
        ))}
      </div>
      <Card><CardContent className="p-0">
        {notifs.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto h-6 w-6 mb-2" />لا توجد إشعارات
          </div>
        )}
        {notifs.map((n) => (
          <div key={n.id} className={cn("border-t p-4 flex items-start justify-between gap-3 hover:bg-muted/30", !n.read && "bg-primary/5")}>
            <button onClick={() => open(n)} className="flex-1 min-w-0 text-right">
              <div className="text-sm font-semibold">{n.title || "إشعار"}</div>
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>
            </button>
            <div className="flex items-center gap-2 shrink-0">
              {!n.read && <span className="h-2 w-2 rounded-full bg-primary" title="غير مقروء" />}
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{safeDate(n.createdAt)}</span>
              <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                onClick={() => { n.read ? markUnread(n.id) : markRead(n.id); invalidate(); }}>
                {n.read ? "تعليم كغير مقروء" : "تعليم كمقروء"}
              </Button>
            </div>
          </div>
        ))}
      </CardContent></Card>
    </AppShell>
  );
}