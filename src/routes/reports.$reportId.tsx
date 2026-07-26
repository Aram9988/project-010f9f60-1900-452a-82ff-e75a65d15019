import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { reportService, periodRange, REPORTS, type ReportPeriod } from "@/services/reportService";
import { useAppStore, useSession } from "@/lib/store";
import { getDepartment } from "@/services/departmentService";
import { getUser } from "@/services/userService";
import { fmtDateTime, fmtDate } from "@/lib/format";
import { ACTIVITY_LABELS, STATUS_LABELS, type ActivityType } from "@/lib/types";
import { FileDown, Printer, Sheet } from "lucide-react";
import { hasPermission, scopedDepartments } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/$reportId")({
  head: () => ({ meta: [{ title: "معاينة التقرير — منظومة التكليفات" }] }),
  component: ReportPreview,
});

function ReportPreview() {
  const { reportId } = Route.useParams();
  const user = getUser(useSession((s) => s.currentUserId));
  const report = REPORTS.find((r) => r.id === reportId);
  const allDepts = useAppStore((s) => s.departments);
  const _touch = useAppStore((s) => s.activity.length); // recompute on store change
  void _touch;

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [eventFilter, setEventFilter] = useState<string>("");

  const period: ReportPeriod = (report?.id as ReportPeriod) ?? "custom";
  const range = periodRange(period, from, to);

  if (!user || !hasPermission(user, "view_reports")) return <AccessDenied />;
  const canExport = hasPermission(user, "export_reports");
  const scopeIds = scopedDepartments(user);
  const depts = scopeIds ? allDepts.filter((d) => scopeIds.includes(d.id)) : allDepts;

  const rowsPromise = useMemo(() => reportService.build(user, {
    from: range.from, to: range.to,
    departmentId: deptFilter || undefined,
    eventType: (eventFilter as ActivityType) || undefined,
  }), [user, range.from, range.to, deptFilter, eventFilter]);

  const [rows, setRows] = useState<Awaited<typeof rowsPromise>>([]);
  useMemo(() => { rowsPromise.then(setRows); }, [rowsPromise]);

  function print() { window.print(); }
  function exportCsv() {
    if (!canExport) return toast.error("لا تملك صلاحية التصدير");
    const header = ["الرقم","التكليف","القسم","المسؤول","الحدث","بواسطة","الوقت","الحالة النهائية"];
    const lines = [header.join(",")];
    for (const r of rows) {
      for (const e of r.events) {
        lines.push([r.number, `"${r.title.replace(/"/g,'""')}"`, getDepartment(r.departmentId)?.short ?? "",
          r.responsibleId ? (getUser(r.responsibleId)?.name ?? "") : "", ACTIVITY_LABELS[e.type],
          getUser(e.actorId)?.name ?? "", fmtDateTime(e.createdAt), STATUS_LABELS[r.latestStatus as keyof typeof STATUS_LABELS]].join(","));
      }
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${report?.id}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <PageHeader
        title={report?.title || "تقرير"}
        subtitle={report?.description}
        breadcrumbs={[{ to: "/reports", label: "التقارير" }, { label: report?.title || "" }]}
        actions={
          <>
            <Button variant="outline" onClick={print}><Printer className="h-4 w-4 me-1" /> طباعة</Button>
            <Button variant="outline" onClick={exportCsv} disabled={!canExport}><Sheet className="h-4 w-4 me-1" /> تصدير CSV</Button>
            <Button variant="outline" onClick={print} disabled={!canExport}><FileDown className="h-4 w-4 me-1" /> حفظ PDF (طباعة)</Button>
          </>
        }
      />

      <Card className="mb-4 no-print">
        <CardContent className="grid gap-3 md:grid-cols-4 pt-4">
          {period === "custom" && (
            <>
              <div><label className="text-xs">من</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><label className="text-xs">إلى</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </>
          )}
          <div><label className="text-xs">القسم</label>
            <Select value={deptFilter || "__all"} onValueChange={(v) => setDeptFilter(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="كل الأقسام" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">كل الأقسام</SelectItem>
                {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><label className="text-xs">نوع الحدث</label>
            <Select value={eventFilter || "__all"} onValueChange={(v) => setEventFilter(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="جميع الأحداث" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">جميع الأحداث</SelectItem>
                {Object.entries(ACTIVITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="mx-auto max-w-5xl rounded-xl border bg-card p-8 shadow-sm print:shadow-none print:border-0">
        <div className="text-center border-b pb-4">
          <div className="text-sm font-bold">وزارة الداخلية — قيادة الأمن الداخلي</div>
          <div className="text-xs text-muted-foreground">فرع اتصالات ريف دمشق</div>
          <h1 className="text-2xl font-black mt-3">{report?.title}</h1>
          <div className="text-xs text-muted-foreground mt-1">
            الفترة: {fmtDate(range.from)} — {fmtDate(range.to)} · تاريخ الإصدار: {fmtDate(new Date().toISOString())}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">لا يوجد نشاط خلال هذه الفترة.</div>
        ) : (
          <table className="w-full mt-6 text-sm">
            <thead className="text-right text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2">الرقم</th><th className="py-2">التكليف</th><th className="py-2">القسم</th>
                <th className="py-2">المسؤول</th><th className="py-2">الحدث</th><th className="py-2">بواسطة</th>
                <th className="py-2">الوقت</th><th className="py-2">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((r) => r.events.map((e, i) => (
                <tr key={r.taskId + "_" + e.id} className="border-b">
                  {i === 0 ? (
                    <>
                      <td rowSpan={r.events.length} className="py-2 font-mono text-xs align-top">{r.number}</td>
                      <td rowSpan={r.events.length} className="py-2 align-top">{r.title}</td>
                      <td rowSpan={r.events.length} className="py-2 align-top">{getDepartment(r.departmentId)?.short}</td>
                      <td rowSpan={r.events.length} className="py-2 align-top">{r.responsibleId ? getUser(r.responsibleId)?.name : "—"}</td>
                    </>
                  ) : null}
                  <td className="py-2">{ACTIVITY_LABELS[e.type]}{e.detail ? ` · ${e.detail}` : ""}</td>
                  <td className="py-2 text-xs">{getUser(e.actorId)?.name}</td>
                  <td className="py-2 text-xs whitespace-nowrap">{fmtDateTime(e.createdAt)}</td>
                  {i === 0 ? <td rowSpan={r.events.length} className="py-2 align-top">{STATUS_LABELS[r.latestStatus as keyof typeof STATUS_LABELS]}</td> : null}
                </tr>
              )))}
            </tbody>
          </table>
        )}

        <div className="mt-10 grid grid-cols-2 gap-6 text-xs">
          <div className="border-t pt-3 text-center">أعدّه<br/><span className="text-muted-foreground">التوقيع</span></div>
          <div className="border-t pt-3 text-center">اعتمده المدير<br/><span className="text-muted-foreground">التوقيع</span></div>
        </div>
      </div>
    </AppShell>
  );
}
