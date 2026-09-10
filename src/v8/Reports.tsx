import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { priorityMeta, statusMeta, type Assignment, type WorkType } from "../v2/model";
import type { OrgState, OrgUser } from "./orgModel";
import { StatusChip } from "./WorkDetail";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function completedDescription(item: Assignment) {
  const direct = item.details?.trim();
  const latestMeaningful = [...item.updates]
    .filter((update) => !update.system && update.text?.trim())
    .sort((a, b) => b.at.localeCompare(a.at))[0]?.text?.trim();
  if (direct && latestMeaningful && latestMeaningful !== direct) return `${direct}\n${latestMeaningful}`;
  return direct || latestMeaningful || "تم إنجاز العمل وإغلاقه حسب الأصول.";
}

function completionReportHtml(rows: Assignment[], org: OrgState, departmentId: string) {
  const selectedDepartment = departmentId === "all" ? "جميع الأقسام" : org.departments.find((d) => d.id === departmentId)?.name ?? "القسم";
  const includeDepartment = departmentId === "all";
  const bodyRows = rows.map((item) => {
    const department = org.departments.find((d) => d.id === item.departmentId)?.name ?? "—";
    const kind = item.kind === "project" ? "مشروع" : "مهمة";
    const work = `<div class="work-title">${escapeHtml(item.title)}</div><div class="work-kind">${kind}</div>`;
    const description = escapeHtml(completedDescription(item)).replaceAll("\n", "<br>");
    return `<tr>${includeDepartment ? `<td class="dept">${escapeHtml(department)}</td>` : ""}<td>${work}</td><td>${description}</td></tr>`;
  }).join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>تقرير الأعمال المنجزة - ${escapeHtml(selectedDepartment)}</title>
<style>
@page { size: A4; margin: 24mm 18mm; }
* { box-sizing: border-box; }
body { margin: 0; direction: rtl; font-family: Arial, Tahoma, sans-serif; color: #111; background: #fff; }
.report { width: 100%; max-width: 900px; margin: 0 auto; }
h1 { margin: 0; text-align: center; font-size: 20pt; font-weight: 700; }
h2 { margin: 14px 0 42px; text-align: center; font-size: 16pt; font-weight: 400; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; direction: rtl; }
th, td { border: 1px solid #555; padding: 10px 12px; vertical-align: middle; text-align: right; font-size: 12pt; line-height: 1.55; }
th { background: #d9eaf7; text-align: center; font-size: 13pt; font-weight: 700; }
${includeDepartment ? "th:nth-child(1), td:nth-child(1) { width: 22%; } th:nth-child(2), td:nth-child(2) { width: 28%; } th:nth-child(3), td:nth-child(3) { width: 50%; }" : "th:nth-child(1), td:nth-child(1) { width: 34%; } th:nth-child(2), td:nth-child(2) { width: 66%; }"}
.work-title { font-weight: 700; }
.work-kind { margin-top: 5px; font-size: 9pt; color: #666; }
.dept { font-weight: 700; }
.empty { text-align: center; color: #777; padding: 28px; }
</style>
</head>
<body><div class="report"><h1>تقرير الأعمال المنجزة</h1><h2>${escapeHtml(selectedDepartment)}</h2><table><thead><tr>${includeDepartment ? "<th>القسم</th>" : ""}<th>الأعمال المنجزة</th><th>الوصف</th></tr></thead><tbody>${bodyRows || `<tr><td colspan="${includeDepartment ? 3 : 2}" class="empty">لا توجد أعمال منجزة ضمن الاختيار الحالي.</td></tr>`}</tbody></table></div></body>
</html>`;
}

function downloadCompletedWord(rows: Assignment[], org: OrgState, departmentId: string) {
  const html = completionReportHtml(rows, org, departmentId);
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const department = departmentId === "all" ? "جميع-الأقسام" : org.departments.find((d) => d.id === departmentId)?.name ?? "القسم";
  a.href = url;
  a.download = `تقرير-الأعمال-المنجزة-${department}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printCompletedReport(rows: Assignment[], org: OrgState, departmentId: string) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return;
  popup.document.open();
  popup.document.write(completionReportHtml(rows, org, departmentId));
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 250);
}

export default function Reports({ items, org, currentUser }: { items: Assignment[]; org: OrgState; currentUser: OrgUser }) {
  const [kind, setKind] = useState<WorkType | "all">("all");
  const [departmentId, setDepartmentId] = useState("all");
  const [assigneeId, setAssigneeId] = useState("all");
  const [status, setStatus] = useState("all");
  const [completedDepartmentId, setCompletedDepartmentId] = useState("all");
  const [showCompletedReport, setShowCompletedReport] = useState(false);

  const rows = useMemo(() => items.filter((i) => (kind === "all" || i.kind === kind) && (departmentId === "all" || i.departmentId === departmentId) && (assigneeId === "all" || i.assigneeId === assigneeId) && (status === "all" || i.status === status)), [items, kind, departmentId, assigneeId, status]);
  const completedRows = useMemo(() => items
    .filter((item) => item.status === "done" && (completedDepartmentId === "all" || item.departmentId === completedDepartmentId))
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)), [items, completedDepartmentId]);

  function exportExcel() {
    const data = rows.map((i) => ({ النوع: i.kind === "project" ? "مشروع" : "مهمة", الاسم: i.title, القسم: org.departments.find((d) => d.id === i.departmentId)?.name ?? "", "المسند إليه": org.users.find((u) => u.id === i.assigneeId)?.name ?? "", الحالة: statusMeta[i.status].label, الأولوية: priorityMeta[i.priority], الموقع: i.location ?? "", المرجع: i.referenceNumber ?? "" }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "التقرير"); XLSX.writeFile(wb, "operations-report.xlsx");
  }

  return <div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="text-[10px] tracking-[.2em] text-cyan-300/50">REPORT ENGINE</div><h1 className="mt-2 text-2xl font-black">التقارير</h1><p className="mt-1 text-xs text-slate-500">تقارير حسب القسم والشخص والحالة ونوع العمل.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => setShowCompletedReport((value) => !value)} className="report-action border-cyan-300/20 text-cyan-200"><FileDown size={14} />تقرير الأعمال المنجزة</button><button onClick={() => window.print()} className="report-action"><Printer size={14} />طباعة / PDF</button><button onClick={exportExcel} className="report-action"><FileSpreadsheet size={14} />Excel</button><button onClick={() => exportCsv(rows, org)} className="report-action"><Download size={14} />CSV</button></div>
    </div>

    {showCompletedReport && <section className="tech-panel overflow-hidden border-cyan-300/15">
      <div className="flex flex-col gap-4 border-b border-white/7 p-5 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="text-[10px] font-black tracking-[.16em] text-cyan-300/60">COMPLETED WORK REPORT</div><h2 className="mt-2 text-lg font-black">توليد تقرير الأعمال المنجزة</h2><p className="mt-1 text-[10px] leading-5 text-slate-500">يعتمد نفس أسلوب القالب المرفق: عنوان مركزي وجدول برأس أزرق، ويعرض فقط الأعمال التي حالتها «مكتمل» مع وصفها.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="tech-field min-w-[220px]" value={completedDepartmentId} onChange={(e) => setCompletedDepartmentId(e.target.value)}><option value="all">جميع الأقسام</option>{org.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
          <button type="button" disabled={completedRows.length === 0} onClick={() => downloadCompletedWord(completedRows, org, completedDepartmentId)} className="report-action disabled:cursor-not-allowed disabled:opacity-40"><FileDown size={14} />تنزيل Word</button>
          <button type="button" disabled={completedRows.length === 0} onClick={() => printCompletedReport(completedRows, org, completedDepartmentId)} className="report-action disabled:cursor-not-allowed disabled:opacity-40"><Printer size={14} />طباعة / PDF</button>
        </div>
      </div>
      <div className="p-5">
        <div className="mx-auto max-w-5xl rounded-[2px] bg-white px-5 py-10 text-slate-950 shadow-2xl sm:px-10" dir="rtl">
          <div className="text-center"><div className="text-xl font-black">تقرير الأعمال المنجزة</div><div className="mt-3 text-base">{completedDepartmentId === "all" ? "جميع الأقسام" : org.departments.find((d) => d.id === completedDepartmentId)?.name ?? "القسم"}</div></div>
          <div className="mt-10 overflow-x-auto"><table className="w-full min-w-[650px] table-fixed border-collapse text-right text-[12px]"><thead><tr>{completedDepartmentId === "all" && <th className="w-[22%] border border-slate-500 bg-[#d9eaf7] p-3 text-center">القسم</th>}<th className={`${completedDepartmentId === "all" ? "w-[28%]" : "w-[34%]"} border border-slate-500 bg-[#d9eaf7] p-3 text-center`}>الأعمال المنجزة</th><th className="border border-slate-500 bg-[#d9eaf7] p-3 text-center">الوصف</th></tr></thead><tbody>{completedRows.map((item) => <tr key={item.id}>{completedDepartmentId === "all" && <td className="border border-slate-500 p-3 font-bold">{org.departments.find((d) => d.id === item.departmentId)?.name ?? "—"}</td>}<td className="border border-slate-500 p-3 align-middle"><div className="font-bold">{item.title}</div><div className="mt-1 text-[9px] text-slate-500">{item.kind === "project" ? "مشروع" : "مهمة"}</div></td><td className="whitespace-pre-line border border-slate-500 p-3 align-middle leading-6">{completedDescription(item)}</td></tr>)}</tbody></table>{completedRows.length === 0 && <div className="border border-t-0 border-slate-500 p-8 text-center text-sm text-slate-500">لا توجد أعمال منجزة ضمن هذا القسم.</div>}</div>
        </div>
        <div className="mt-3 text-center text-[9px] text-slate-600">عدد الأعمال المنجزة: {completedRows.length}</div>
      </div>
    </section>}

    <section className="tech-panel p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><select className="tech-field" value={kind} onChange={(e) => setKind(e.target.value as WorkType | "all")}><option value="all">المشاريع والمهام</option><option value="project">المشاريع فقط</option><option value="task">المهام فقط</option></select><select className="tech-field" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}><option value="all">جميع الأقسام</option>{org.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><select className="tech-field" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="all">جميع الأشخاص</option>{org.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><select className="tech-field" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">جميع الحالات</option>{Object.entries(statusMeta).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div></section>
    <section id="print-report" className="tech-panel overflow-hidden"><div className="border-b border-white/7 p-5"><h2 className="text-lg font-black">تقرير المشاريع والمهام</h2><div className="mt-1 text-[10px] text-slate-600">تم إنشاؤه بواسطة: {currentUser.name}</div></div><div className="overflow-x-auto p-5"><table className="w-full min-w-[900px] text-right"><thead><tr className="border-b border-white/8 text-[9px] text-slate-600"><th className="py-3">النوع</th><th>الاسم</th><th>القسم</th><th>المسند إليه</th><th>الحالة</th><th>الأولوية</th><th>الموقع</th></tr></thead><tbody className="divide-y divide-white/7">{rows.map((i) => <tr key={i.id} className="text-[11px]"><td className="py-4 text-cyan-300/70">{i.kind === "project" ? "مشروع" : "مهمة"}</td><td className="font-bold">{i.title}</td><td className="text-slate-400">{org.departments.find((d) => d.id === i.departmentId)?.name ?? "—"}</td><td className="text-slate-400">{org.users.find((u) => u.id === i.assigneeId)?.name ?? "—"}</td><td><StatusChip status={i.status} /></td><td>{priorityMeta[i.priority]}</td><td className="text-slate-500">{i.location || "—"}</td></tr>)}</tbody></table>{rows.length === 0 && <div className="py-10 text-center text-xs text-slate-600">لا توجد نتائج.</div>}</div></section>
  </div>;
}

function exportCsv(rows: Assignment[], org: OrgState) { const table = [["النوع", "الاسم", "القسم", "المسند إليه", "الحالة", "الأولوية", "الموقع"], ...rows.map((i) => [i.kind === "project" ? "مشروع" : "مهمة", i.title, org.departments.find((d) => d.id === i.departmentId)?.name ?? "", org.users.find((u) => u.id === i.assigneeId)?.name ?? "", statusMeta[i.status].label, priorityMeta[i.priority], i.location ?? ""])]; const csv = table.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n"); const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "operations-report.csv"; a.click(); URL.revokeObjectURL(url); }
