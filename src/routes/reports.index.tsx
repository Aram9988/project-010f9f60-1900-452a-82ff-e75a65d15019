import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportService } from "@/services/reportService";
import { departmentService } from "@/services/departmentService";
import { FileBarChart2 } from "lucide-react";

export const Route = createFileRoute("/reports/")({
  head: () => ({ meta: [{ title: "التقارير — منظومة التكليفات" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: reports = [] } = useQuery({ queryKey: ["reports"], queryFn: () => reportService.list() });
  const { data: depts = [] } = useQuery({ queryKey: ["depts"], queryFn: () => departmentService.list() });
  return (
    <AppShell>
      <PageHeader title="التقارير" subtitle="تقارير جاهزة للطباعة والاعتماد" />
      <Card className="mb-6"><CardHeader><CardTitle className="text-base">فلاتر التقرير</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input type="date" />
          <Input type="date" />
          <Select><SelectTrigger><SelectValue placeholder="القسم" /></SelectTrigger><SelectContent>{depts.map(d=><SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
          <Select><SelectTrigger><SelectValue placeholder="الأولوية" /></SelectTrigger><SelectContent><SelectItem value="all">الكل</SelectItem><SelectItem value="critical">عاجل جداً</SelectItem></SelectContent></Select>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
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