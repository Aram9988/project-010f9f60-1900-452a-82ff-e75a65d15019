import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore, useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { ACTIVITY_LABELS, type ActivityType } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { hasPermission } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "سجل التدقيق — منظومة التكليفات" }] }),
  component: AuditPage,
});

function labelFor(action: string | undefined) {
  if (!action) return "إجراء";
  const l = (ACTIVITY_LABELS as Record<string, string>)[action];
  return l ?? action.replace(/_/g, " ");
}
function safeDate(iso: string | undefined) {
  if (!iso) return "";
  try { return fmtDateTime(iso); } catch { return String(iso); }
}

function AuditPage() {
  const user = getUser(useSession((s) => s.currentUserId));
  const audit = useAppStore((s) => s.audit);
  const users = useAppStore((s) => s.users);
  const [q, setQ] = useState("");
  const [actor, setActor] = useState<string>("all");
  const [action, setAction] = useState<string>("all");

  const entries = useMemo(() => {
    const list = Array.isArray(audit) ? [...audit] : [];
    list.sort((a, b) => String(b?.createdAt ?? "").localeCompare(String(a?.createdAt ?? "")));
    const qs = q.trim();
    return list.filter((e) => {
      if (!e) return false;
      if (actor !== "all" && e.actorId !== actor) return false;
      if (action !== "all" && e.action !== action) return false;
      if (qs && !`${e.taskId ?? ""} ${e.detail ?? ""} ${labelFor(e.action)}`.includes(qs)) return false;
      return true;
    });
  }, [audit, q, actor, action]);

  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    (audit ?? []).forEach((e) => e?.action && set.add(e.action));
    return Array.from(set);
  }, [audit]);

  if (!user || !hasPermission(user, "view_audit")) return <AccessDenied />;

  return (
    <AppShell>
      <PageHeader title="سجل التدقيق" subtitle="سجل غير قابل للتعديل لكافة الإجراءات داخل النظام" />
      <div className="mb-4 grid gap-2 md:grid-cols-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في التكليف أو التفاصيل…" />
        <Select value={actor} onValueChange={setActor}>
          <SelectTrigger><SelectValue placeholder="المستخدم" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع المستخدمين</SelectItem>
            {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger><SelectValue placeholder="الإجراء" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الإجراءات</SelectItem>
            {actionOptions.map((a) => <SelectItem key={a} value={a}>{labelFor(a)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground self-center">إجمالي السجلات المطابقة: {entries.length}</div>
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        {entries.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <ShieldCheck className="mx-auto h-6 w-6 mb-2" />
            لا توجد سجلات مطابقة.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-right text-xs text-muted-foreground">
              <tr><th className="p-3">الوقت</th><th className="p-3">المستخدم</th><th className="p-3">الإجراء</th><th className="p-3">التكليف</th><th className="p-3">التفاصيل</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const actorUser = getUser(e.actorId);
                return (
                  <tr key={e.id} className="border-t">
                    <td className="p-3 text-xs whitespace-nowrap">{safeDate(e.createdAt)}</td>
                    <td className="p-3">{actorUser?.name ?? <span className="text-muted-foreground">مستخدم غير متاح</span>}</td>
                    <td className="p-3 font-medium">{labelFor(e.action as ActivityType)}</td>
                    <td className="p-3 font-mono text-xs">{e.taskId || "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{e.detail || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent></Card>
    </AppShell>
  );
}