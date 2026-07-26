import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { notificationService } from "@/services/notificationService";
import { useSession } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck } from "lucide-react";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "الإشعارات — منظومة التكليفات" }] }),
  component: NotifsPage,
});

function NotifsPage() {
  const qc = useQueryClient();
  const uid = useSession((s) => s.currentUserId);
  const { data: notifs = [] } = useQuery({ queryKey: ["notifs", uid], queryFn: () => notificationService.listForUser(uid) });

  async function markAll() { await notificationService.markAllRead(uid); qc.invalidateQueries({ queryKey: ["notifs", uid] }); }

  return (
    <AppShell>
      <PageHeader title="الإشعارات" subtitle="جميع تنبيهاتك الأخيرة"
        actions={<Button variant="outline" onClick={markAll}><CheckCheck className="h-4 w-4 me-1" /> تعليم الكل كمقروء</Button>} />
      <Card><CardContent className="p-0">
        {notifs.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground"><Bell className="mx-auto h-6 w-6 mb-2" />لا توجد إشعارات</div>}
        {notifs.map((n) => (
          <Link key={n.id} to={n.taskId ? "/tasks/$taskId" : "/notifications"} params={n.taskId ? { taskId: n.taskId } : (undefined as any)}
            className={cn("block border-t p-4 hover:bg-muted/30", !n.read && "bg-primary/5")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{n.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
              </div>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtDateTime(n.createdAt)}</span>
            </div>
          </Link>
        ))}
      </CardContent></Card>
    </AppShell>
  );
}