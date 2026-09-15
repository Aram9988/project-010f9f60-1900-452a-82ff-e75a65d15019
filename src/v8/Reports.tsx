import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { priorityMeta, statusMeta, type Assignment, type UpdateEntry, type WorkType } from "../v2/model";
import { roleOf, type OrgState, type OrgUser } from "./orgModel";
import { StatusChip } from "./WorkDetail";

type CompletedReportPeriod = "weekly" | "monthly";
type ProjectActivityRow = { item: Assignment; update: UpdateEntry };

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function dateValue(date: Date) {
  return localDateValue(date);
}

function initialRange(period: CompletedReportPeriod, anchor = new Date()) {
  const to = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const from = period === "weekly"
    ? new Date(to.getFullYear(), to.getMonth(), to.getDate() - 6)
    : new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: dateValue(from), to: dateValue(to) };
}

function parseReportDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function fmtReportDate(value: string) {
  return parseReportDate(value).toLocaleDateString("ar-SY", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function fmtDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ar-SY", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function completionTime(item: Assignment) {
  const doneUpdates = item.updates
    .filter((update) => update.status === "done")
    .sort((a, b) => b.at.localeCompare(a.at));
  return doneUpdates[0]?.at ?? item.updatedAt;
}

function inDateRange(value: string, fromDate: string, toDate: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const start = new Date(`${fromDate}T00:00:00`).getTime();
  const end = new Date(`${toDate}T23:59:59.999`).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && timestamp >= start && timestamp <= end;
}

function reportRowText(item: Assignment) {
  const title = item.title.trim();
  const details = item.details?.trim();
  if (item.kind === "project" && item.status === "active") return `دراسة ${title}`;
  if (item.status === "active") return `قيد التنفيذ: ${title}${details ? ` ${details}` : ""}`;
  return `${title}${details ? ` ${details}` : ""}`;
}

function completedReportHtml(rows: Assignment[], org: OrgState, departmentId: string, period: CompletedReportPeriod, fromDate: string, toDate: string) {
  const selectedDepartment = departmentId === "all" ? "جميع الأقسام" : org.departments.find((d) => d.id === departmentId)?.name ?? "القسم";
  const headline = period === "weekly" ? "تقرير الأعمال الأسبوعي" : "تقرير الأعمال الشهري";
  const bodyRows = rows.map((item) => `<tr><td>${escapeHtml(reportRowText(item))}</td></tr>`).join("");
  const rangeLabel = fromDate === toDate ? fmtReportDate(fromDate) : `من ${fmtReportDate(fromDate)} إلى ${fmtReportDate(toDate)}`;

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
  <div class="date">التاريخ: ${escapeHtml(rangeLabel)}</div>
  <h1>${escapeHtml(headline)}</h1>
  <h2>الأعمال المنجزة</h2>
  <div class="department">${escapeHtml(selectedDepartment)}</div>
  <table>
    <thead><tr><th>الأعمال المنجزة</th></tr></thead>
    <tbody>${bodyRows || '<tr><td class="empty">لا توجد أعمال منجزة أو مهام قيد التنفيذ أو دراسات نشطة ضمن التقرير.</td></tr>'}</tbody>
  </table>
</div>
</body>
</html>`;
}

function printHtml(html: string, errorMessage = "تعذر تجهيز ملف PDF للطباعة. يرجى المحاولة مرة أخرى.") {
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
    window.alert(errorMessage);
    return;
  }

  printDocument.open();
  printDocument.write(html);
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

function printCompletedReport(rows: Assignment[], org: OrgState, departmentId: string, period: CompletedReportPeriod, fromDate: string, toDate: string) {
  printHtml(completedReportHtml(rows, org, departmentId, period, fromDate, toDate));
}

function projectActivityReportHtml(project: Assignment, relatedTasks: Assignment[], activityRows: ProjectActivityRow[], completedTasks: Assignment[], org: OrgState, fromDate: string, toDate: string) {
  const department = org.departments.find((d) => d.id === project.departmentId)?.name ?? "—";
  const owner = org.users.find((u) => u.id === (project.assigneeId ?? project.ownerId))?.name ?? "—";
  const rangeLabel = fromDate === toDate ? fmtReportDate(fromDate) : `من ${fmtReportDate(fromDate)} إلى ${fmtReportDate(toDate)}`;
  const activeTasks = relatedTasks.filter((task) => !task.archivedAt && task.status === "active").length;
  const participants = new Set(activityRows.map(({ update }) => update.authorId).filter(Boolean));
  const attachments = activityRows.filter(({ update }) => !!update.attachment);
  const activityBody = activityRows.map(({ item, update }, index) => {
    const author = org.users.find((u) => u.id === update.authorId)?.name ?? "النظام";
    const source = item.kind === "project" ? "المشروع" : item.title;
    const status = update.status ? statusMeta[update.status].label : statusMeta[item.status].label;
    const attachment = update.attachment ? `<div class="attachment">مرفق: ${escapeHtml(update.attachment)}</div>` : "";
    return `<tr><td>${index + 1}</td><td>${escapeHtml(source)}</td><td>${escapeHtml(update.text || "تحديث على العمل")}${attachment}</td><td>${escapeHtml(author)}</td><td>${escapeHtml(status)}</td><td>${escapeHtml(fmtDateTime(update.at))}</td></tr>`;
  }).join("");
  const completedBody = completedTasks.map((task, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(task.title)}</td><td>${escapeHtml(org.users.find((u) => u.id === (task.assigneeId ?? task.ownerId))?.name ?? "—")}</td><td>${escapeHtml(fmtDateTime(completionTime(task)))}</td></tr>`).join("");
  const summary = activityRows.length
    ? `تم تسجيل ${activityRows.length} تحديثاً ضمن المشروع والمهام المرتبطة خلال الفترة المحددة${completedTasks.length ? `، وإنجاز ${completedTasks.length} مهمة` : ""}. يوجد حالياً ${activeTasks} مهمة مرتبطة قيد التنفيذ.`
    : `لم يتم تسجيل تحديثات على المشروع أو المهام المرتبطة خلال الفترة المحددة${completedTasks.length ? `، مع وجود ${completedTasks.length} مهمة تم إنجازها ضمن الفترة` : ""}.`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>تقرير متابعة المشروع - ${escapeHtml(project.title)}</title>
<style>
@page { size: A4; margin: 11mm 12mm 13mm; }
* { box-sizing: border-box; }
html, body { background:#f5f2ec; }
body { margin:0; direction:rtl; font-family:Arial,Tahoma,sans-serif; color:#233238; }
.page { max-width:920px; margin:0 auto; background:#f8f5ef; min-height:100vh; }
.hero { position:relative; background:#213a3f; color:white; padding:22px 28px 20px; border-bottom:5px solid #d8a51d; }
.hero:before { content:""; position:absolute; top:0; right:0; width:170px; height:4px; background:#1b8a86; }
.eyebrow { color:#d8a51d; font-size:12px; font-weight:700; letter-spacing:.04em; }
.hero h1 { margin:6px 0 2px; font-size:25px; }
.hero .project { color:#dbe6e5; font-size:15px; }
.hero .date { position:absolute; left:28px; bottom:22px; direction:ltr; color:#eef3f2; font-size:12px; }
.content { padding:20px 28px 26px; }
.cards { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:20px; }
.card { position:relative; border:1px solid #d6d9d4; background:#fbfaf7; border-radius:10px; padding:10px 12px; min-height:62px; }
.card:after { content:""; position:absolute; top:10px; bottom:10px; right:0; width:4px; background:#1b8a86; border-radius:4px; }
.card.gold:after { background:#d8a51d; }
.card .label { color:#7e8584; font-size:9px; margin-bottom:5px; }
.card .value { font-size:12px; font-weight:700; line-height:1.45; }
.section-title { display:flex; align-items:center; gap:10px; margin:20px 0 9px; font-size:19px; font-weight:700; color:#2d4145; }
.section-title:before { content:""; width:6px; height:24px; background:#d8a51d; }
.section-title:after { content:""; height:1px; flex:1; background:#bbc4c2; }
table { width:100%; border-collapse:collapse; table-layout:fixed; background:#fbfaf7; }
th { background:#213a3f; color:white; font-size:10px; padding:8px 7px; border:1px solid #53666a; }
td { font-size:9.5px; line-height:1.55; padding:8px 7px; border:1px solid #d5d8d3; vertical-align:top; }
tbody tr:nth-child(even) td { background:#f1f2ed; }
.activity th:nth-child(1), .activity td:nth-child(1) { width:5%; text-align:center; }
.activity th:nth-child(2), .activity td:nth-child(2) { width:18%; }
.activity th:nth-child(3), .activity td:nth-child(3) { width:37%; }
.activity th:nth-child(4), .activity td:nth-child(4) { width:14%; }
.activity th:nth-child(5), .activity td:nth-child(5) { width:12%; }
.activity th:nth-child(6), .activity td:nth-child(6) { width:14%; }
.attachment { margin-top:5px; color:#137a77; font-size:8.5px; }
.summary { border:1px solid #cfd8d5; border-radius:10px; background:#edf4f2; padding:14px 16px; line-height:1.8; font-size:11px; border-right:5px solid #1b8a86; }
.empty { padding:20px; text-align:center; color:#8a9290; }
.footer { margin-top:20px; padding-top:9px; border-top:1px solid #c8ceca; display:flex; justify-content:space-between; color:#8b918e; font-size:8.5px; }
@media print { html,body,.page { background:#fff; } .page { max-width:none; } }
</style>
</head>
<body>
<div class="page">
  <div class="hero">
    <div class="eyebrow">${escapeHtml(department)}</div>
    <h1>تقرير متابعة المشروع</h1>
    <div class="project">${escapeHtml(project.title)}</div>
    <div class="date">${escapeHtml(rangeLabel)}</div>
  </div>
  <div class="content">
    <div class="cards">
      <div class="card"><div class="label">المشروع</div><div class="value">${escapeHtml(project.title)}</div></div>
      <div class="card gold"><div class="label">حالة المشروع</div><div class="value">${escapeHtml(statusMeta[project.status].label)}</div></div>
      <div class="card"><div class="label">المسؤول</div><div class="value">${escapeHtml(owner)}</div></div>
      <div class="card gold"><div class="label">الموقع / المرجع</div><div class="value">${escapeHtml(project.location || project.referenceNumber || "—")}</div></div>
      <div class="card gold"><div class="label">التحديثات ضمن الفترة</div><div class="value">${activityRows.length}</div></div>
      <div class="card"><div class="label">المهام المنجزة</div><div class="value">${completedTasks.length}</div></div>
      <div class="card gold"><div class="label">المهام قيد التنفيذ</div><div class="value">${activeTasks}</div></div>
      <div class="card"><div class="label">المشاركون بالتحديث</div><div class="value">${participants.size}</div></div>
    </div>

    <div class="section-title">الأعمال والتحديثات خلال الفترة</div>
    <table class="activity">
      <thead><tr><th>م</th><th>المصدر</th><th>تفاصيل التحديث</th><th>المستخدم</th><th>الحالة</th><th>التاريخ والوقت</th></tr></thead>
      <tbody>${activityBody || '<tr><td colspan="6" class="empty">لا توجد تحديثات مسجلة ضمن الفترة المحددة.</td></tr>'}</tbody>
    </table>

    <div class="section-title">المهام المنجزة ضمن المشروع</div>
    <table>
      <thead><tr><th style="width:7%">م</th><th>المهمة</th><th style="width:23%">المسؤول</th><th style="width:24%">تاريخ الإنجاز</th></tr></thead>
      <tbody>${completedBody || '<tr><td colspan="4" class="empty">لا توجد مهام مرتبطة تم اعتماد إنجازها ضمن الفترة المحددة.</td></tr>'}</tbody>
    </table>

    <div class="section-title">الملخص التنفيذي</div>
    <div class="summary">${escapeHtml(summary)}${attachments.length ? ` تم إرفاق ملفات مع ${attachments.length} من التحديثات.` : ""}</div>

    <div class="footer"><span>فرع اتصالات ريف دمشق — وزارة الداخلية</span><span>${escapeHtml(project.number || project.id)}</span></div>
  </div>
</div>
</body>
</html>`;
}

function exportExcelRows(rows: Assignment[], org: OrgState) {
  const data = rows.map((i) => ({ النوع: i.kind === "project" ? "مشروع" : "مهمة", الاسم: i.title, القسم: org.departments.find((d) => d.id === i.departmentId)?.name ?? "", "المسند إليه": org.users.find((u) => u.id === i.assigneeId)?.name ?? "", الحالة: statusMeta[i.status].label, الأولوية: priorityMeta[i.priority], الموقع: i.location ?? "", المرجع: i.referenceNumber ?? "" }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "التقرير");
  XLSX.writeFile(wb, "operations-report.xlsx");
}

export default function Reports({ items, reportItems, org, currentUser }: { items: Assignment[]; reportItems: Assignment[]; org: OrgState; currentUser: OrgUser }) {
  const currentRole = roleOf(org, currentUser);
  const isDiwan = currentRole?.key === "diwan" || currentRole?.name?.trim().includes("ديوان") === true;

  const [kind, setKind] = useState<WorkType | "all">("all");
  const [departmentId, setDepartmentId] = useState("all");
  const [assigneeId, setAssigneeId] = useState("all");
  const [status, setStatus] = useState("all");
  const [completedDepartmentId, setCompletedDepartmentId] = useState("all");
  const [completedPeriod, setCompletedPeriod] = useState<CompletedReportPeriod>("weekly");
  const initial = initialRange("weekly");
  const [completedFromDate, setCompletedFromDate] = useState(initial.from);
  const [completedToDate, setCompletedToDate] = useState(initial.to);
  const [showCompletedReport, setShowCompletedReport] = useState(isDiwan);
  const [showProjectReport, setShowProjectReport] = useState(false);
  const [projectReportId, setProjectReportId] = useState("");
  const today = localDateValue();
  const [projectFromDate, setProjectFromDate] = useState(today);
  const [projectToDate, setProjectToDate] = useState(today);

  const reportSourceItems = isDiwan ? reportItems : items;

  const rows = useMemo(() => reportSourceItems.filter((i) => (kind === "all" || i.kind === kind) && (departmentId === "all" || i.departmentId === departmentId) && (assigneeId === "all" || i.assigneeId === assigneeId) && (status === "all" || i.status === status)), [reportSourceItems, kind, departmentId, assigneeId, status]);

  const completedReportRows = useMemo(() => {
    const departmentMatch = (item: Assignment) => completedDepartmentId === "all" || item.departmentId === completedDepartmentId;
    const completed = reportSourceItems.filter((item) => item.status === "done" && departmentMatch(item) && inDateRange(completionTime(item), completedFromDate, completedToDate));
    const activeTasks = reportSourceItems.filter((item) => item.kind === "task" && item.status === "active" && !item.archivedAt && departmentMatch(item) && inDateRange(item.updatedAt, completedFromDate, completedToDate));
    const activeProjects = reportSourceItems.filter((item) => item.kind === "project" && item.status === "active" && !item.archivedAt && departmentMatch(item));
    const byId = new Map<string, Assignment>();
    [...completed, ...activeTasks, ...activeProjects].forEach((item) => byId.set(item.id, item));
    return [...byId.values()].sort((a, b) => {
      const aTime = a.status === "done" ? completionTime(a) : a.updatedAt;
      const bTime = b.status === "done" ? completionTime(b) : b.updatedAt;
      return aTime.localeCompare(bTime);
    });
  }, [reportSourceItems, completedDepartmentId, completedFromDate, completedToDate]);

  const projectReportProjects = useMemo(() => reportSourceItems.filter((item) => item.kind === "project").sort((a, b) => a.title.localeCompare(b.title, "ar")), [reportSourceItems]);
  const selectedProject = projectReportProjects.find((project) => project.id === projectReportId) ?? null;
  const relatedProjectTasks = useMemo(() => selectedProject ? reportSourceItems.filter((item) => item.kind === "task" && item.parentProjectId === selectedProject.id) : [], [reportSourceItems, selectedProject]);
  const projectActivityRows = useMemo<ProjectActivityRow[]>(() => {
    if (!selectedProject) return [];
    const sources = [selectedProject, ...relatedProjectTasks];
    return sources.flatMap((item) => item.updates.filter((update) => inDateRange(update.at, projectFromDate, projectToDate)).map((update) => ({ item, update }))).sort((a, b) => a.update.at.localeCompare(b.update.at));
  }, [selectedProject, relatedProjectTasks, projectFromDate, projectToDate]);
  const completedProjectTasks = useMemo(() => relatedProjectTasks.filter((task) => task.status === "done" && inDateRange(completionTime(task), projectFromDate, projectToDate)).sort((a, b) => completionTime(a).localeCompare(completionTime(b))), [relatedProjectTasks, projectFromDate, projectToDate]);
  const projectDateRangeValid = projectFromDate <= projectToDate;

  function changeCompletedPeriod(next: CompletedReportPeriod) {
    setCompletedPeriod(next);
    const range = initialRange(next);
    setCompletedFromDate(range.from);
    setCompletedToDate(range.to);
  }

  const reportHeadline = completedPeriod === "weekly" ? "تقرير الأعمال الأسبوعي" : "تقرير الأعمال الشهري";
  const reportDepartment = completedDepartmentId === "all" ? "جميع الأقسام" : org.departments.find((d) => d.id === completedDepartmentId)?.name ?? "القسم";
  const dateRangeValid = completedFromDate <= completedToDate;
  const reportRangeLabel = completedFromDate === completedToDate ? fmtReportDate(completedFromDate) : `من ${fmtReportDate(completedFromDate)} إلى ${fmtReportDate(completedToDate)}`;

  return <div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="text-[10px] tracking-[.2em] text-cyan-300/50">REPORT ENGINE</div>
        <h1 className="mt-2 text-2xl font-black">التقارير</h1>
        <p className="mt-1 text-xs text-slate-500">{isDiwan ? "وصول مخصص للتقارير فقط لجميع الأقسام دون إظهار الأعمال على لوحة المتابعة." : "تقارير حسب القسم والشخص والحالة ونوع العمل."}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowCompletedReport((value) => !value)} className="report-action border-cyan-300/20 text-cyan-200"><FileDown size={14} />تقرير الأعمال المنجزة</button>
        <button onClick={() => setShowProjectReport((value) => !value)} className="report-action border-amber-300/20 text-amber-200"><FileDown size={14} />تقرير متابعة مشروع</button>
        {!isDiwan && <><button onClick={() => window.print()} className="report-action"><Printer size={14} />طباعة / PDF</button><button onClick={() => exportExcelRows(rows, org)} className="report-action"><FileSpreadsheet size={14} />Excel</button><button onClick={() => exportCsv(rows, org)} className="report-action"><Download size={14} />CSV</button></>}
      </div>
    </div>

    {showProjectReport && <section className="tech-panel overflow-hidden border-amber-300/15">
      <div className="grid gap-5 border-b border-white/7 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,760px)] xl:items-end">
        <div className="min-w-0 text-right" dir="rtl">
          <div className="text-[10px] font-black tracking-[.16em] text-amber-300/70">PROJECT FOLLOW-UP REPORT</div>
          <h2 className="mt-2 text-lg font-black">تقرير متابعة مشروع</h2>
          <p className="mt-1 max-w-2xl text-[10px] leading-5 text-slate-500">يعرض المشروع والمهام المرتبطة والتحديثات التي أضيفت خلال التاريخ المحدد فقط، وفق صلاحيات المستخدم الحالية.</p>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" dir="rtl">
          <select className="tech-field w-full min-w-0" value={projectReportId} onChange={(e) => setProjectReportId(e.target.value)}><option value="">اختر المشروع</option>{projectReportProjects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select>
          <label className="min-w-0"><span className="mb-1 block text-[9px] font-bold text-slate-500">من تاريخ</span><input type="date" className="tech-field w-full min-w-0" value={projectFromDate} max={projectToDate} onChange={(e) => setProjectFromDate(e.target.value)} /></label>
          <label className="min-w-0"><span className="mb-1 block text-[9px] font-bold text-slate-500">إلى تاريخ</span><input type="date" className="tech-field w-full min-w-0" value={projectToDate} min={projectFromDate} onChange={(e) => setProjectToDate(e.target.value)} /></label>
          <button type="button" disabled={!selectedProject || !projectDateRangeValid} onClick={() => selectedProject && printHtml(projectActivityReportHtml(selectedProject, relatedProjectTasks, projectActivityRows, completedProjectTasks, org, projectFromDate, projectToDate))} className="report-action w-full min-w-0 justify-center whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40"><Printer size={14} />طباعة / حفظ PDF</button>
        </div>
      </div>
      {!projectDateRangeValid && <div className="border-b border-rose-300/10 bg-rose-300/[0.035] px-5 py-2 text-[10px] font-bold text-rose-300">تاريخ البداية يجب أن يكون قبل أو مساوياً لتاريخ النهاية.</div>}
      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="text-[9px] text-slate-600">المشروع</div><div className="mt-2 text-sm font-black">{selectedProject?.title ?? "لم يتم اختيار مشروع"}</div></div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="text-[9px] text-slate-600">المهام المرتبطة المتاحة</div><div className="mt-2 font-mono text-2xl font-black text-cyan-200">{relatedProjectTasks.length}</div></div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="text-[9px] text-slate-600">التحديثات ضمن الفترة</div><div className="mt-2 font-mono text-2xl font-black text-amber-200">{projectActivityRows.length}</div></div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="text-[9px] text-slate-600">المهام المنجزة ضمن الفترة</div><div className="mt-2 font-mono text-2xl font-black text-emerald-200">{completedProjectTasks.length}</div></div>
      </div>
    </section>}

    {showCompletedReport && <section className="tech-panel overflow-hidden border-cyan-300/15">
      <div className="grid gap-5 border-b border-white/7 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,820px)] xl:items-end">
        <div className="min-w-0 text-right" dir="rtl">
          <div className="text-[10px] font-black tracking-[.16em] text-cyan-300/60">COMPLETED WORK REPORT</div>
          <h2 className="mt-2 text-lg font-black">تقرير الأعمال المنجزة</h2>
          <p className="mt-1 max-w-2xl text-[10px] leading-5 text-slate-500">اختر نوع التقرير والفترة من / إلى. الأعمال المنجزة والمهام النشطة تُحتسب ضمن الفترة المحددة، وتظهر المشاريع النشطة كدراسات طوال فترة بقائها قيد التنفيذ.</p>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" dir="rtl">
          <select className="tech-field w-full min-w-0" value={completedPeriod} onChange={(e) => changeCompletedPeriod(e.target.value as CompletedReportPeriod)}><option value="weekly">تقرير أسبوعي</option><option value="monthly">تقرير شهري</option></select>
          <label className="min-w-0"><span className="mb-1 block text-[9px] font-bold text-slate-500">من تاريخ</span><input type="date" className="tech-field w-full min-w-0" value={completedFromDate} max={completedToDate} onChange={(e) => setCompletedFromDate(e.target.value)} /></label>
          <label className="min-w-0"><span className="mb-1 block text-[9px] font-bold text-slate-500">إلى تاريخ</span><input type="date" className="tech-field w-full min-w-0" value={completedToDate} min={completedFromDate} onChange={(e) => setCompletedToDate(e.target.value)} /></label>
          <select className="tech-field w-full min-w-0 self-end" value={completedDepartmentId} onChange={(e) => setCompletedDepartmentId(e.target.value)}><option value="all">جميع الأقسام</option>{org.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
          <button type="button" disabled={!dateRangeValid || completedReportRows.length === 0} onClick={() => printCompletedReport(completedReportRows, org, completedDepartmentId, completedPeriod, completedFromDate, completedToDate)} className="report-action w-full min-w-0 self-end justify-center whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40"><Printer size={14} />طباعة / حفظ PDF</button>
        </div>
      </div>
      {!dateRangeValid && <div className="border-b border-rose-300/10 bg-rose-300/[0.035] px-5 py-2 text-[10px] font-bold text-rose-300">تاريخ البداية يجب أن يكون قبل أو مساوياً لتاريخ النهاية.</div>}
      <div className="p-5">
        <div className="mx-auto max-w-5xl rounded-[2px] bg-white px-5 py-10 text-slate-950 shadow-2xl sm:px-10" dir="rtl">
          <div className="mb-6 text-right text-[11px]">التاريخ: {reportRangeLabel}</div>
          <div className="text-center"><div className="text-xl font-black">{reportHeadline}</div><div className="mt-3 text-base">الأعمال المنجزة</div><div className="mt-2 text-[11px] text-slate-600">{reportDepartment}</div></div>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[560px] table-fixed border-collapse text-right text-[12px]"><thead><tr><th className="border border-slate-500 bg-[#d9eaf7] p-3 text-center">الأعمال المنجزة</th></tr></thead><tbody>{completedReportRows.map((item) => <tr key={item.id}><td className="border border-slate-500 p-3 align-middle leading-6">{reportRowText(item)}</td></tr>)}</tbody></table>
            {completedReportRows.length === 0 && <div className="border border-t-0 border-slate-500 p-8 text-center text-sm text-slate-500">لا توجد أعمال منجزة أو مهام قيد التنفيذ أو دراسات نشطة ضمن التقرير.</div>}
          </div>
        </div>
        <div className="mt-3 text-center text-[9px] text-slate-600">الأعمال ضمن الفترة المحددة: {completedReportRows.length}</div>
      </div>
    </section>}

    {!isDiwan && <>
      <section className="tech-panel p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><select className="tech-field" value={kind} onChange={(e) => setKind(e.target.value as WorkType | "all")}><option value="all">المشاريع والمهام</option><option value="project">المشاريع فقط</option><option value="task">المهام فقط</option></select><select className="tech-field" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}><option value="all">جميع الأقسام</option>{org.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><select className="tech-field" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="all">جميع الأشخاص</option>{org.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><select className="tech-field" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">جميع الحالات</option>{Object.entries(statusMeta).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div></section>
      <section id="print-report" className="tech-panel overflow-hidden"><div className="border-b border-white/7 p-5"><h2 className="text-lg font-black">تقرير المشاريع والمهام</h2><div className="mt-1 text-[10px] text-slate-600">تم إنشاؤه بواسطة: {currentUser.name}</div></div><div className="overflow-x-auto p-5"><table className="w-full min-w-[900px] text-right"><thead><tr className="border-b border-white/8 text-[9px] text-slate-600"><th className="py-3">النوع</th><th>الاسم</th><th>القسم</th><th>المسند إليه</th><th>الحالة</th><th>الأولوية</th><th>الموقع</th></tr></thead><tbody className="divide-y divide-white/7">{rows.map((i) => <tr key={i.id} className="text-[11px]"><td className="py-4 text-cyan-300/70">{i.kind === "project" ? "مشروع" : "مهمة"}</td><td className="font-bold">{i.title}</td><td className="text-slate-400">{org.departments.find((d) => d.id === i.departmentId)?.name ?? "—"}</td><td className="text-slate-400">{org.users.find((u) => u.id === i.assigneeId)?.name ?? "—"}</td><td><StatusChip status={i.status} /></td><td>{priorityMeta[i.priority]}</td><td className="text-slate-500">{i.location || "—"}</td></tr>)}</tbody></table>{rows.length === 0 && <div className="py-10 text-center text-xs text-slate-600">لا توجد نتائج.</div>}</div></section>
    </>}
  </div>;
}

function exportCsv(rows: Assignment[], org: OrgState) {
  const table = [["النوع", "الاسم", "القسم", "المسند إليه", "الحالة", "الأولوية", "الموقع"], ...rows.map((i) => [i.kind === "project" ? "مشروع" : "مهمة", i.title, org.departments.find((d) => d.id === i.departmentId)?.name ?? "", org.users.find((u) => u.id === i.assigneeId)?.name ?? "", statusMeta[i.status].label, priorityMeta[i.priority], i.location ?? ""])];
  const csv = table.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "operations-report.csv";
  a.click();
  URL.revokeObjectURL(url);
}
