import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { reportService } from "@/services/reportService";
import { getDepartment } from "@/services/departmentService";
import { getUser } from "@/services/userService";
import { fmtDate } from "@/lib/format";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/types";
import { FileDown, Printer, Sheet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/$reportId")({
  head: () => ({ meta: [{ title: "معاينة التقرير — منظومة التكليفات" }] }),
  component: ReportPreview,
});

function ReportPreview() {
  const { reportId } = Route.useParams();
  const { data: report } = useQuery({ queryKey: ["report", reportId], queryFn: () => reportService.byId(reportId) });
  const { data: rows = [] } = useQuery({ queryKey: ["report-data", reportId], queryFn: () => reportService.data(reportId) });

  const mock = () => toast.success("سيتم تفعيل التصدير في النسخة النهائية");

  return (
    <AppShell>
      <PageHeader
        title={report?.title || "تقرير"}
        subtitle={report?.description}
        breadcrumbs={[{ to: "/reports", label: "التقارير" }, { label: report?.title || "" }]}
        actions={
          <>
            <Button variant="outline" onClick={mock}><Printer className="h-4 w-4 me-1" /> طباعة</Button>
            <Button variant="outline" onClick={mock}><FileDown className="h-4 w-4 me-1" /> تصدير PDF</Button>
            <Button variant="outline" onClick={mock}><Sheet className="h-4 w-4 me-1" /> تصدير Excel</Button>
          </>
        }
      />

      <div className="mx-auto max-w-4xl rounded-xl border bg-card p-8 shadow-sm">
        <div className="text-center border-b pb-4">
          <div className="text-sm font-bold">وزارة الداخلية — قيادة الأمن الداخلي</div>
          <div className="text-xs text-muted-foreground">فرع اتصالات ريف دمشق</div>
          <h1 className="text-2xl font-black mt-3">{report?.title}</h1>
          <div className="text-xs text-muted-foreground mt-1">تاريخ الإصدار: {fmtDate(new Date().toISOString())}</div>
        </div>

        <table className="w-full mt-6 text-sm">
          <thead className="text-right text-xs text-muted-foreground border-b">
            <tr><th className="py-2">الرقم</th><th className="py-2">التكليف</th><th className="py-2">القسم</th><th className="py-2">المسؤول</th><th className="py-2">الأولوية</th><th className="py-2">الحالة</th><th className="py-2">المهلة</th></tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="py-2 font-mono text-xs">{t.number}</td>
                <td className="py-2">{t.title}</td>
                <td className="py-2">{getDepartment(t.departmentId)?.short}</td>
                <td className="py-2">{t.assigneeId ? getUser(t.assigneeId)?.name : "—"}</td>
                <td className="py-2">{PRIORITY_LABELS[t.priority]}</td>
                <td className="py-2">{STATUS_LABELS[t.status]}</td>
                <td className="py-2 text-xs">{fmtDate(t.dueAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-10 grid grid-cols-2 gap-6 text-xs">
          <div className="border-t pt-3 text-center">أعدّه<br/><span className="text-muted-foreground">التوقيع</span></div>
          <div className="border-t pt-3 text-center">اعتمده المدير<br/><span className="text-muted-foreground">التوقيع</span></div>
        </div>
      </div>
    </AppShell>
  );
}