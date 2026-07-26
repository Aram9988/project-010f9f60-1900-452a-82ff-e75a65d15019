import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REPORTS } from "@/services/reportService";
import { FileBarChart2 } from "lucide-react";
import { useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { hasPermission } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";

export const Route = createFileRoute("/reports/")({
  head: () => ({ meta: [{ title: "التقارير — منظومة التكليفات" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const user = getUser(useSession((s) => s.currentUserId));
  if (!user || !hasPermission(user, "view_reports")) return <AccessDenied />;
  return (
    <AppShell>
      <PageHeader title="التقارير" subtitle="تقارير قائمة على الأحداث الفعلية خلال الفترة المختارة" />
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">أنواع التقارير</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          كل تقرير يعرض فقط التكليفات التي شهدت نشاطاً خلال الفترة (إنشاء، توجيه، تحديث، اعتماد، ...). التكليفات التي لم تتحرك خلال الفترة لا تظهر.
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.id} to="/reports/$reportId" params={{ reportId: r.id }}
            className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><FileBarChart2 className="h-5 w-5" /></div>
              <div><h3 className="font-semibold">{r.title}</h3><p className="text-xs text-muted-foreground mt-1">{r.description}</p></div>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
