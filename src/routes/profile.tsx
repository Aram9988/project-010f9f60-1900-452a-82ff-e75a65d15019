import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { getDepartment } from "@/services/departmentService";
import { ROLE_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "الملف الشخصي — منظومة التكليفات" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
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
          <div className="mt-6 flex gap-2">
            <Button variant="outline">تغيير كلمة المرور</Button>
            <Button variant="outline">تحديث بيانات الاتصال</Button>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border p-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="font-medium mt-0.5">{value}</div></div>;
}