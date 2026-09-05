import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { reportService, periodRange, type ReportPeriod, type ReportRow } from "@/services/reportService";
import { useAppStore, useSession } from "@/lib/store";
import { getDepartment } from "@/services/departmentService";
import { getUser } from "@/services/userService";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ACTIVITY_LABELS, STATUS_LABELS } from "@/lib/types";
import { FileDown, Printer, Sheet } from "lucide-react";
import { hasPermission, scopedDepartments } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/")({
  head: () => ({ meta: [{ title: "التقارير — منظومة التكليفات" }] }),
  component: ReportsPage,
});

type Mode = "activity" | "completed" | "in_progress";

function ReportsPage() {
  const user = getUser(useSession((s) => s.currentUserId));
  const allDepts = useAppStore((s) => s.departments);
  const activityVersion = useAppStore((s) => s.activity.length);
  const today = new Date().toISOString().slice(0, 10);

  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
  const [mode, setMode] = useState<Mode>("activity");
  const [anchor, setAnchor] = useState(today);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [departmentId, setDepartmentId] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);

  if (!user || !hasPermission(user, "view_reports")) return <AccessDenied />;

  const canExport = hasPermission(user, "export_reports");
  const scopeIds = scopedDepartments(user);
  const departments = scopeIds
    ? allDepts.filter((d) => scopeIds.includes(d.id) && !d.archived)
    : allDepts.filter((d) => !d.archived);
  const showDepartment = departments.length > 1;

  const range = useMemo(() => {
    if (period === "custom") return periodRange("custom", from, to);
    return periodRange(period as ReportPeriod, undefined, undefined, anchor);
  }, [period, from, to, anchor]);

  useEffect(() => {
    let active = true;
    reportService.build(user, {
      from: range.from,
      to: range.to,
      departmentId: departmentId || undefined,
      mode,
    }).then((result) => { if (active) setRows(result); });
    return () => { active = false; };
  }, [user, range.from, range.to, departmentId, mode, activityVersion]);

  function exportRows() {
    return rows.flatMap((r) => r.events.map((e) => ({
      الرقم: r.number,
      التكليف: r.title,
      القسم: getDepartment(r.departmentId)?.name ?? "",
      الحدث: ACTIVITY_LABELS[e.type],
      التفاصيل: e.detail ?? "",
      بواسطة: getUser(e.actorId)?.name ?? "",
      الوقت: fmtDateTime(e.createdAt),
      الحالة: STATUS_LABELS[r.latestStatus as keyof typeof STATUS_LABELS] ?? r.latestStatus,
    })));
  }

  function exportXlsx() {
    if (!canExport) return toast.error("لا تملك صلاحية التصدير");
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "التقرير");
    XLSX.writeFile(wb, `report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportCsv() {
    if (!canExport) return toast.error("لا تملك صلاحية التصدير");
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <PageHeader
        title="التقارير"
        subtitle="اختر الفترة ونوع التقرير — وسيظهر النشاط الفعلي فقط"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 me-1" /> طباعة / PDF</Button>
            <Button variant="outline" onClick={exportXlsx} disabled={!canExport}><Sheet className="h-4 w-4 me-1" /> Excel</Button>
            <Button variant="outline" onClick={exportCsv} disabled={!canExport}><FileDown className="h-4 w-4 me-1" /> CSV</Button>
          </div>
        }
      />

      <Card className="mb-5 no-print">
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">الفترة</label>
            <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">اليوم</SelectItem>
                <SelectItem value="weekly">هذا الأسبوع</SelectItem>
                <SelectItem value="monthly">هذا الشهر</SelectItem>
                <SelectItem value="custom">فترة مخصصة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">نوع التقرير</label>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activity">النشاط</SelectItem>
                <SelectItem value="completed">المنجز</SelectItem>
                <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {period === "custom" ? (
            <>
              <div className="space-y-1"><label className="text-xs font-medium">من</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="space-y-1"><label className="text-xs font-medium">إلى</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-medium">التاريخ المرجعي</label>
              <Input type={period === "monthly" ? "month" : "date"} value={period === "monthly" ? anchor.slice(0, 7) : anchor} onChange={(e) => setAnchor(period === "monthly" ? e.target.value + "-01" : e.target.value)} />
            </div>
          )}

          {showDepartment && (
            <div className="space-y-1">
              <label className="text-xs font-medium">القسم</label>
              <Select value={departmentId || "__all"} onValueChange={(v) => setDepartmentId(v === "__all" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">كل الأقسام</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mx-auto max-w-6xl rounded-xl border bg-card p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="border-b pb-4 text-center">
          <div className="text-sm font-bold">وزارة الداخلية — قيادة الأمن الداخلي</div>
          <div className="text-xs text-muted-foreground">فرع اتصالات ريف دمشق</div>
          <h1 className="mt-3 text-xl font-black">تقرير متابعة التكليفات</h1>
          <div className="mt-1 text-xs text-muted-foreground">{fmtDate(range.from)} — {fmtDate(range.to)}</div>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">لا يوجد نشاط ضمن الفترة المختارة.</div>
        ) : (
          <div className="mt-6 space-y-4">
            {rows.map((r) => (
              <section key={r.taskId} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-[11px] text-muted-foreground">{r.number}</div>
                    <div className="font-bold">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{getDepartment(r.departmentId)?.name}</div>
                  </div>
                  <div className="text-xs font-medium">{STATUS_LABELS[r.latestStatus as keyof typeof STATUS_LABELS] ?? r.latestStatus}</div>
                </div>
                <div className="mt-3 space-y-2">
                  {r.events.map((e) => (
                    <div key={e.id} className="flex flex-col gap-1 rounded-md bg-muted/35 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm"><span className="font-semibold">{ACTIVITY_LABELS[e.type]}</span>{e.detail ? ` — ${e.detail}` : ""}</div>
                      <div className="text-[11px] text-muted-foreground">{getUser(e.actorId)?.name ?? "—"} · {fmtDateTime(e.createdAt)}</div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
