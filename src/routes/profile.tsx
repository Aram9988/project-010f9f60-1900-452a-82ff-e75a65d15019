import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { useAppStore, useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { getDepartment } from "@/services/departmentService";
import { ROLE_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "الملف الشخصي — منظومة التكليفات" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const req = useAppStore((s) => s.passwordRequests.find((r) => r.userId === uid && r.status === "pending"));
  if (!user) return <AppShell>—</AppShell>;
  const dept = user.departmentId ? getDepartment(user.departmentId) : undefined;
  return (
    <AppShell>
      <PageHeader title="الملف الشخصي" />
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <UserAvatar user={user} size={72} />
            <div>
              <h2 className="text-xl font-bold">{user.name}</h2>
              <div className="text-sm text-muted-foreground">{ROLE_LABELS[user.role]}{dept ? ` · ${dept.name}` : ""}</div>
            </div>
          </div>
          <div className="grid gap-3 mt-6 md:grid-cols-3 text-sm">
            <Info label="اسم المستخدم" value={user.username} />
            <Info label="الرتبة" value={user.rank || "—"} />
            <Info label="القسم" value={dept?.name || "—"} />
          </div>
          {req && (
            <div className="mt-6 rounded-md border border-gold/40 bg-gold/10 p-3 text-sm">
              <div className="flex items-center gap-2 mb-1"><KeyRound className="h-4 w-4" /> <b>طلب تغيير كلمة المرور بانتظارك</b></div>
              <p className="text-xs text-muted-foreground">طلب منك مدير النظام تغيير كلمة المرور.</p>
              <Button asChild size="sm" className="mt-2"><Link to="/change-password">فتح صفحة تغيير كلمة المرور</Link></Button>
            </div>
          )}
          <div className="mt-6 flex gap-2">
            <Button asChild variant="outline"><Link to="/change-password">تغيير كلمة المرور</Link></Button>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border p-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="font-medium mt-0.5">{value}</div></div>;
}
