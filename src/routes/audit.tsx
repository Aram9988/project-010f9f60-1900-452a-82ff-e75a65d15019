import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore, useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { ACTIVITY_LABELS } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { hasPermission } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "سجل التدقيق — منظومة التكليفات" }] }),
  component: AuditPage,
});

function AuditPage() {
  const user = getUser(useSession((s) => s.currentUserId));
  const entries = useAppStore((s) => [...s.audit].sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
  if (!user || !hasPermission(user, "view_audit")) return <AccessDenied />;
  return (
    <AppShell>
      <PageHeader title="سجل التدقيق" subtitle="سجل غير قابل للتعديل لكافة الإجراءات داخل النظام" />
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-right text-xs text-muted-foreground">
            <tr><th className="p-3">الوقت</th><th className="p-3">المستخدم</th><th className="p-3">الإجراء</th><th className="p-3">التكليف</th><th className="p-3">التفاصيل</th></tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-3 text-xs whitespace-nowrap">{fmtDateTime(e.createdAt)}</td>
                <td className="p-3">{getUser(e.actorId)?.name}</td>
                <td className="p-3 font-medium">{ACTIVITY_LABELS[e.action]}</td>
                <td className="p-3 font-mono text-xs">{e.taskId || "—"}</td>
                <td className="p-3 text-xs text-muted-foreground">{e.detail || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </AppShell>
  );
}
