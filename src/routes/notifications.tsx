import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { notificationService } from "@/services/notificationService";
import { useAppStore, useSession } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck } from "lucide-react";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "الإشعارات — منظومة التكليفات" }] }),
  component: NotifsPage,
});

function NotifsPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const uid = useSession((s) => s.currentUserId);
  const notifs = useAppStore((s) => s.notifications.filter((n) => n.userId === uid).sort((a,b) => b.createdAt.localeCompare(a.createdAt)));

  async function markAll() { await notificationService.markAllRead(uid); qc.invalidateQueries(); }
  async function open(n: (typeof notifs)[number]) {
    await notificationService.markRead(n.id); qc.invalidateQueries();
    if (n.taskId) nav({ to: "/tasks/$taskId", params: { taskId: n.taskId } });
  }

  return (
    <AppShell>
      <PageHeader title="الإشعارات" subtitle="جميع تنبيهاتك الأخيرة"
        actions={<Button variant="outline" onClick={markAll}><CheckCheck className="h-4 w-4 me-1" /> تعليم الكل كمقروء</Button>} />
      <Card><CardContent className="p-0">
        {notifs.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground"><Bell className="mx-auto h-6 w-6 mb-2" />لا توجد إشعارات</div>}
        {notifs.map((n) => (
          <button key={n.id} onClick={() => open(n)}
            className={cn("block w-full text-right border-t p-4 hover:bg-muted/30", !n.read && "bg-primary/5")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{n.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
              </div>
              <div className="flex items-center gap-2">
                {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtDateTime(n.createdAt)}</span>
              </div>
            </div>
          </button>
        ))}
      </CardContent></Card>
    </AppShell>
  );
}
