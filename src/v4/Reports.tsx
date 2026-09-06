import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { departments, priorityMeta, statusMeta, type Assignment, type DemoUser, type WorkType } from "../v2/model";
import { StatusChip } from "../v6/OperationalDetail";

type Period = "day" | "week" | "month" | "custom";
type ReportType = "activity" | "completed" | "open";
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const kindOf = (item: Assignment): WorkType => item.kind ?? "task";

function fmt(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ar-SY", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function deptName(id: string) { return departments.find((d) => d.id === id)?.name ?? "قسم غير محدد"; }
function kindLabel(item: Assignment) { return kindOf(item) === "project" ? "مشروع" : "مهمة"; }

export default function Reports({ tasks, user }: { tasks: Assignment[]; user: DemoUser }) {
  const today = new Date();
  const [period, setPeriod] = useState<Period>("week");
  const [type, setType] = useState<ReportType>("activity");
  const [workType, setWorkType] = useState<WorkType | "all">("all");
  const [departmentId, setDepartmentId] = useState("all");
  const [location, setLocation] = useState("all");
  const [from, setFrom] = useState(isoDate(new Date(today.getTime() - 7 * 86400000)));
  const [to, setTo] = useState(isoDate(today));
  const locations = Array.from(new Set(tasks.map((t) => t.location).filter(Boolean) as string[])).sort();

  const range = useMemo(() => {
    const end = period === "custom" ? new Date(`${to}T23:59:59`) : new Date();
    const hours = period === "day" ? 24 : period === "week" ? 168 : 720;
    const start = period === "custom" ? new Date(`${from}T00:00:00`) : new Date(end.getTime() - hours * 3600000);
    return { start, end };
  }, [period, from, to]);

  const rows = useMemo(() => tasks.filter((item) => {
    const changed = new Date(item.updatedAt);
    const inRange = changed >= range.start && changed <= range.end;
    const deptOk = departmentId === "all" || item.departmentId === departmentId;
    const workOk = workType === "all" || kindOf(item) === workType;
    const locationOk = location === "all" || item.location === location;
    const typeOk = type === "activity" ? inRange : type === "completed" ? item.status === "done" && inRange : item.status !== "done";
    return deptOk && workOk && locationOk && typeOk;
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [tasks, range, departmentId, workType, location, type]);

  function exportExcel() {
    const data = rows.map((item) => ({
      "النوع": kindLabel(item), "الرقم": item.number, "الاسم": item.title, "الموقع": item.location || "", "المرجع": item.referenceNumber || "", "القسم": deptName(item.departmentId), "الحالة": statusMeta[item.status].label, "الأولوية": priorityMeta[item.priority], "آخر تحديث": fmt(item.updatedAt),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "التقرير");
    XLSX.writeFile(wb, `work-report-${isoDate(new Date())}.xlsx`);
  }

  function exportCsv() {
    const table = [["النوع", "الرقم", "الاسم", "الموقع", "المرجع", "القسم", "الحالة", "الأولوية", "آخر تحديث"], ...rows.map((item) => [kindLabel(item), item.number, item.title, item.location || "", item.referenceNumber || "", deptName(item.departmentId), statusMeta[item.status].label, priorityMeta[item.priority], fmt(item.updatedAt)])];
    const csv = table.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `work-report-${isoDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return <div className="space-y-5"><div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-[10px] tracking-[.2em] text-cyan-300/50">REPORT ENGINE</div><h1 className="mt-2 text-2xl font-black">تقارير المشاريع والمهام</h1><p className="mt-1 text-xs text-slate-500">حسب النوع والفترة والقسم والموقع.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => window.print()} className="report-action"><Printer size={14} />طباعة / PDF</button><button onClick={exportExcel} className="report-action"><FileSpreadsheet size={14} />Excel</button><button onClick={exportCsv} className="report-action"><Download size={14} />CSV</button></div></div><section className="no-print tech-panel p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><Field label="نوع العمل"><select value={workType} onChange={(e) => setWorkType(e.target.value as WorkType | "all")} className="tech-field"><option value="all">المشاريع والمهام</option><option value="project">المشاريع فقط</option><option value="task">المهام فقط</option></select></Field><Field label="الفترة"><select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="tech-field"><option value="day">اليوم</option><option value="week">هذا الأسبوع</option><option value="month">هذا الشهر</option><option value="custom">فترة مخصصة</option></select></Field><Field label="حالة التقرير"><select value={type} onChange={(e) => setType(e.target.value as ReportType)} className="tech-field"><option value="activity">النشاط</option><option value="completed">المنجز</option><option value="open">المفتوح</option></select></Field>{user.role === "boss" && <Field label="القسم"><select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="tech-field"><option value="all">جميع الأقسام</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>}<Field label="الموقع"><select value={location} onChange={(e) => setLocation(e.target.value)} className="tech-field"><option value="all">جميع المواقع</option>{locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}</select></Field></div>{period === "custom" && <div className="mt-3 grid max-w-md grid-cols-2 gap-2"><Field label="من"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="tech-field" /></Field><Field label="إلى"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="tech-field" /></Field></div>}</section><section id="print-report" className="tech-panel overflow-hidden"><div className="border-b border-white/8 p-6"><div className="flex items-center gap-2 text-[9px] tracking-[.2em] text-cyan-300/60"><FileText size={13} />EXECUTIVE REPORT</div><h2 className="mt-3 text-2xl font-black">تقرير متابعة المشاريع والمهام</h2><p className="mt-2 text-[11px] text-slate-500">{range.start.toLocaleDateString("ar-SY")} — {range.end.toLocaleDateString("ar-SY")}</p></div><div className="grid gap-px bg-white/7 sm:grid-cols-4"><Stat label="إجمالي السجلات" value={rows.length} /><Stat label="مشاريع" value={rows.filter((i) => kindOf(i) === "project").length} /><Stat label="مهام" value={rows.filter((i) => kindOf(i) === "task").length} /><Stat label="مكتمل" value={rows.filter((i) => i.status === "done").length} /></div><div className="overflow-x-auto p-6"><table className="w-full min-w-[940px]"><thead><tr className="border-y border-white/8 text-[9px] text-slate-600"><th className="py-3">النوع</th><th>الاسم</th><th>الموقع</th><th>المرجع</th><th>القسم</th><th>الحالة</th><th>الأولوية</th><th>آخر تحديث</th></tr></thead><tbody className="divide-y divide-white/7">{rows.map((item) => <tr key={item.id} className="text-[11px]"><td className="py-4 font-bold text-cyan-300/70">{kindLabel(item)}</td><td className="font-bold">{item.title}</td><td className="text-slate-400">{item.location || "—"}</td><td className="text-slate-500">{item.referenceNumber || "—"}</td><td className="text-slate-400">{deptName(item.departmentId)}</td><td><StatusChip status={item.status} /></td><td>{priorityMeta[item.priority]}</td><td className="text-slate-500">{fmt(item.updatedAt)}</td></tr>)}</tbody></table>{rows.length === 0 && <div className="py-10 text-center text-xs text-slate-600">لا توجد بيانات مطابقة لخيارات التقرير.</div>}</div></section></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-2 block text-[9px] font-black text-slate-500">{label}</span>{children}</label>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="bg-[#0b1524] p-4 text-center"><div className="font-mono text-2xl font-black">{String(value).padStart(2, "0")}</div><div className="mt-1 text-[9px] text-slate-600">{label}</div></div>; }
