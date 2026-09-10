import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { priorityMeta, statusMeta, type Assignment, type WorkType } from "../v2/model";
import { roleOf, type OrgState, type OrgUser } from "./orgModel";
import { useLiveAppState } from "./liveState";
import { StatusChip } from "./WorkDetail";

const DAY_MS = 24 * 60 * 60 * 1000;
type CompletedReportPeriod = "weekly" | "monthly";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function parseReportDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function fmtReportDate(value: string) {
  return parseReportDate(value).toLocaleDateString("ar-SY", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function completionTime(item: Assignment) {
  const doneUpdates = item.updates
    .filter((update) => update.status === "done")
    .sort((a, b) => b.at.localeCompare(a.at));
  return doneUpdates[0]?.at ?? item.updatedAt;
}

function inReportPeriod(value: string, reportDate: string, period: CompletedReportPeriod) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const selected = parseReportDate(reportDate);
  if (period === "monthly") {
    const start = new Date(selected.getFullYear(), selected.getMonth(), 1, 0, 0, 0, 0).getTime();
    const end = new Date(selected.getFullYear(), selected.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
    return timestamp >= start && timestamp < end;
  }
  const end = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() + 1, 0, 0, 0, 0).getTime();
  const start = end - 7 * DAY_MS;
  return timestamp >= start && timestamp < end;
}

function reportRowText(item: Assignment) {
  const title = item.title.trim();
  const details = item.details?.trim();
  if (item.status === "active") return `قيد التنفيذ: ${title}${details ? ` ${details}` : ""}`;
  return `${title}${details ? ` ${details}` : ""}`;
}

function completedReportHtml(rows: Assignment[], org: OrgState, departmentId: string, period: CompletedReportPeriod, reportDate: string) {
  const selectedDepartment = departmentId === "all" ? "جميع الأقسام" : org.departments.find((d) => d.id === departmentId)?.name ?? "القسم";
  const headline = period === "weekly" ? "تقرير الأعمال الأسبوعي" : "تقرير الأعمال الشهري";
  const bodyRows = rows.map((item) => `<tr><td>${escapeHtml(reportRowText(item))}</td></tr>`).join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(headline)}</title>
<style>
@page { size: A4; margin: 22mm 18mm; }
* { box-sizing: border-box; }
html, body { background: #fff; }
body { margin: 0; direction: rtl; font-family: Arial, Tahoma, sans-serif; color: #111; }
.report { width: 100%; max-width: 900px; margin: 0 auto; padding-top: 8px; }
.date { text-align: right; margin-bottom: 24px; font-size: 11pt; }
h1 { margin: 0; text-align: center; font-size: 20pt; font-weight: 700; }
h2 { margin: 14px 0 10px; text-align: center; font-size: 16pt; font-weight: 400; }
.department { margin: 0 0 34px; text-align: center; font-size: 11pt; color: #444; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; direction: rtl; }
th, td { border: 1px solid #555; padding: 10px 12px; vertical-align: middle; text-align: right; font-size: 12pt; line-height: 1.65; }
th { background: #d9eaf7; text-align: center; font-size: 13pt; font-weight: 700; }
.empty { color: #777; padding: 28px; text-align: center; }
</style>
</head>
<body>
<div class="report">
  <div class="date">التاريخ: ${escapeHtml(fmtReportDate(reportDate))}</div>
  <h1>${escapeHtml(headline)}</h1>
  <h2>الأعمال المنجزة</h2>
  <div class="department">${escapeHtml(selectedDepartment)}</div>
  <table>
    <thead><tr><th>الأعمال المنجزة</th></tr></thead>
    <tbody>${bodyRows || '<tr><td class="empty">لا توجد أعمال منجزة أو مهام قيد التنفيذ ضمن الاختيار الحالي.</td></tr>'}</tbody>
  </table>
</div>
</body>
</html>`;
}

function printCompletedReport(rows: Assignment[], org: OrgState, departmentId: string, period: CompletedReportPeriod, reportDate: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const cleanup = () => window.setTimeout(() => iframe.remove(), 500);
  const printWindow = iframe.contentWindow;
  const printDocument = iframe.contentDocument ?? printWindow?.document;
  if (!printWindow || !printDocument) {
    iframe.remove();
    window.alert("تعذر تجهيز ملف PDF للطباعة. يرجى المحاولة مرة أخرى.");
    return;
  }

  printDocument.open();
  printDocument.write(completedReportHtml(rows, org, departmentId, period, reportDate));
  printDocument.close();

  window.setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.addEventListener("afterprint", cleanup, { once: true });
      printWindow.print();
      window.setTimeout(cleanup, 30_000);
    } catch {
      iframe.remove();
      window.alert("تعذر فتح نافذة الطباعة. يرجى المحاولة مرة أخرى.");
    }
  }, 300);
}

export default function Reports({ items, org, currentUser }: { items: Assignment[]; org: OrgState; currentUser: OrgUser }) {
  const [liveApp] = useLiveAppState();
  const [kind, setKind] = useState<WorkType | "all">("all");
  const [departmentId, setDepartmentId] = useState("all");
  const [assigneeId, setAssigneeId] = useState("all");
  const [status, setStatus] = useState("all");
  const [completedDepartmentId, setCompletedDepartmentId] = useState("all");
  const [completedPeriod, setCompletedPeriod] = useState<CompletedReportPeriod>("weekly");
  const [completedReportDate, setCompletedReportDate] = useState(() => localDateValue());
  const [showCompletedReport, setShowCompletedReport] = useState(false);

  const isDiwan = roleOf(org, currentUser)?.key === "diwan";
  const reportSourceItems = isDiwan ? liveApp.tasks : items;

  const rows = useMemo(() => reportSourceItems.filter((i) => (kind === "all" || i.kind === kind) && (departmentId === "all" || i.departmentId === departmentId) && (assigneeId === "all" || i.assigneeId === assigneeId) && (status === "all" || i.status === status)), [reportSourceItems, kind, departmentId, assigneeId, status]);

  const completedReportRows = useMemo(() => {
    const departmentMatch = (item: Assignment) => completedDepartmentId === "all" || item.departmentId === completedDepartmentId;
    const completed = reportSourceItems.filter((item) => item.status === "done" && departmentMatch(item) && inReportPeriod(completionTime(item), completedReportDate, completedPeriod));
    const activeTasks = reportSourceItems.filter((item) => item.kind === "task" && item.status === "active" && !item.archivedAt && departmentMatch(item));
    const byId = new Map<string, Assignment>();
    [...completed, ...activeTasks].forEach((item) => byId.set(item.id, item));
    return [...byId.values()].sort((a, b) => {
      const aTime = a.status === "done" ? completionTime(a) : a.updatedAt;
      const bTime = b.status === "done" ? completionTime(b) : b.updatedAt;
      return aTime.localeCompare(bTime);
    });
  }, [reportSourceItems, completedDepartmentId, completedPeriod, completedReportDate]);

  function exportExcel() {
    const data = rows.map((i) => ({ النوع: i.kind === "project" ? "مشروع" : "مهمة", الاسم: i.title, القسم: org.departments.find((d) => d.id === i.departmentId)?.name ?? "", "المسند إليه": org.users.find((u) => u.id === i.assigneeId)?.name ?? "", الحالة: statusMeta[i.status].label, الأولوية: priorityMeta[i.priority], الموقع: i.location ?? "", المرجع: i.referenceNumber ?? "" }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "التقرير"); XLSX.writeFile(wb, "operations-report.xlsx");
  }

  const reportHeadline = completedPeriod === "weekly" ? "تقرير الأعمال الأسبوعي" : "تقرير الأعمال الشهري";
  const reportDepartment = completedDepartmentId === "all" ? "جميع الأقسام" : org.departments.find((d) => d.id === completedDepartmentId)?.name ?? "القسم";

  return <div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="text-[10px] tracking-[.2em] text-cyan-300/50">REPORT ENGINE</div><h1 className="mt-2 text-2xl font-black">التقارير</h1><p className="mt-1 text-xs text-slate-500">{isDiwan ? "وصول مخصص للتقارير فقط لجميع الأقسام دون إظهار الأعمال على لوحة المتابعة." : "تقارير حسب القسم والشخص والحالة ونوع العمل."}</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => setShowCompletedReport((value) => !value)} className="report-action border-cyan-300/20 text-cyan-200"><FileDown size={14} />تقرير الأعمال المنجزة</button><button onClick={() => window.print()} className="report-action"><Printer size={14} />طباعة / PDF</button><button onClick={exportExcel} className="report-action"><FileSpreadsheet size={14} />Excel</button><button onClick={() => exportCsv(rows, org)} className="report-action"><Download size={14} />CSV</button></div>
    </div>

    {showCompletedReport && <section className="tech-panel overflow-hidden border-cyan-300/15">
      <div className="grid gap-5 border-b border-white/7 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,620px)] lg:items-end">
        <div className="min-w-0 text-right" dir="rtl"><div className="text-[10px] font-black tracking-[.16em] text-cyan-300/60">COMPLETED WORK REPORT</div><h2 className="mt-2 text-lg font-black">تقرير الأعمال المنجزة</h2><p className="mt-1 max-w-2xl text-[10px] leading-5 text-slate-500">تقرير أسبوعي أو شهري حسب القالب المعتمد، مع الأعمال المنجزة والمهام النشطة الحالية فقط.</p></div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" dir="rtl">
          <select className="tech-field w-full min-w-0" value={completedPeriod} onChange={(e) => setCompletedPeriod(e.target.value as CompletedReportPeriod)}><option value="weekly">تقرير أسبوعي</option><option value="monthly">تقرير شهري</option></select>
          <input type="date" className="tech-field w-full min-w-0" value={completedReportDate} onChange={(e) => setCompletedReportDate(e.target.value)} />
          <select className="tech-field w-full min-w-0" value={completedDepartmentId} onChange={(e) => setCompletedDepartmentId(e.target.value)}><option value="all">جميع الأقسام</option>{org.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
          <button type="button" disabled={completedReportRows.length === 0} onClick={() => printCompletedReport(completedReportRows, org, completedDepartmentId, completedPeriod, completedReportDate)} className="report-action w-full min-w-0 justify-center whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40"><Printer size={14} />طباعة / حفظ PDF</button>
        </div>
      </div>
      <div className="p-5">
        <div className="mx-auto max-w-5xl rounded-[2px] bg-white px-5 py-10 text-slate-950 shadow-2xl sm:px-10" dir="rtl">
          <div className="mb-6 text-right text-[11px]">التاريخ: {fmtReportDate(completedReportDate)}</div>
          <div className="text-center"><div className="text-xl font-black">{reportHeadline}</div><div className="mt-3 text-base">الأعمال المنجزة</div><div className="mt-2 text-[11px] text-slate-600">{reportDepartment}</div></div>
          <div className="mt-10 overflow-x-auto"><table className="w-full min-w-[560px] table-fixed border-collapse text-right text-[12px]"><thead><tr><th className="border border-slate-500 bg-[#d9eaf7] p-3 text-center">الأعمال المنجزة</th></tr></thead><tbody>{completedReportRows.map((item) => <tr key={item.id}><td className="border border-slate-500 p-3 align-middle leading-6">{reportRowText(item)}</td></tr>)}</tbody></table>{completedReportRows.length === 0 && <div className="border border-t-0 border-slate-500 p-8 text-center text-sm text-slate-500">لا توجد أعمال منجزة أو مهام قيد التنفيذ ضمن هذا الاختيار.</div>}</div>
        </div>
        <div className="mt-3 text-center text-[9px] text-slate-600">الأعمال المنجزة ضمن الفترة + المهام النشطة الحالية: {completedReportRows.length}</div>
      </div>
    </section>}

    <section className="tech-panel p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><select className="tech-field" value={kind} onChange={(e) => setKind(e.target.value as WorkType | "all")}><option value="all">المشاريع والمهام</option><option value="project">المشاريع فقط</option><option value="task">المهام فقط</option></select><select className="tech-field" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}><option value="all">جميع الأقسام</option>{org.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><select className="tech-field" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="all">جميع الأشخاص</option>{org.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><select className="tech-field" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">جميع الحالات</option>{Object.entries(statusMeta).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div></section>
    <section id="print-report" className="tech-panel overflow-hidden"><div className="border-b border-white/7 p-5"><h2 className="text-lg font-black">تقرير المشاريع والمهام</h2><div className="mt-1 text-[10px] text-slate-600">تم إنشاؤه بواسطة: {currentUser.name}</div></div><div className="overflow-x-auto p-5"><table className="w-full min-w-[900px] text-right"><thead><tr className="border-b border-white/8 text-[9px] text-slate-600"><th className="py-3">النوع</th><th>الاسم</th><th>القسم</th><th>المسند إليه</th><th>الحالة</th><th>الأولوية</th><th>الموقع</th></tr></thead><tbody className="divide-y divide-white/7">{rows.map((i) => <tr key={i.id} className="text-[11px]"><td className="py-4 text-cyan-300/70">{i.kind === "project" ? "مشروع" : "مهمة"}</td><td className="font-bold">{i.title}</td><td className="text-slate-400">{org.departments.find((d) => d.id === i.departmentId)?.name ?? "—"}</td><td className="text-slate-400">{org.users.find((u) => u.id === i.assigneeId)?.name ?? "—"}</td><td><StatusChip status={i.status} /></td><td>{priorityMeta[i.priority]}</td><td className="text-slate-500">{i.location || "—"}</td></tr>)}</tbody></table>{rows.length === 0 && <div className="py-10 text-center text-xs text-slate-600">لا توجد نتائج.</div>}</div></section>
  </div>;
}

function exportCsv(rows: Assignment[], org: OrgState) { const table = [["النوع", "الاسم", "القسم", "المسند إليه", "الحالة", "الأولوية", "الموقع"], ...rows.map((i) => [i.kind === "project" ? "مشروع" : "مهمة", i.title, org.departments.find((d) => d.id === i.departmentId)?.name ?? "", org.users.find((u) => u.id === i.assigneeId)?.name ?? "", statusMeta[i.status].label, priorityMeta[i.priority], i.location ?? ""])]; const csv = table.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n"); const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "operations-report.csv"; a.click(); URL.revokeObjectURL(url); }
