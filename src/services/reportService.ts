import type { Task } from "@/lib/types";
import { tasks } from "@/lib/mock/seed";

export interface ReportDef {
  id: string;
  title: string;
  description: string;
  category: "daily" | "weekly" | "monthly" | "analysis";
}

export const REPORTS: ReportDef[] = [
  { id: "daily-completion", title: "تقرير الإنجاز اليومي", description: "الأعمال المنجزة خلال اليوم مع خطة الغد.", category: "daily" },
  { id: "in-progress", title: "تقرير الأعمال قيد التنفيذ", description: "جميع التكليفات الجارية حالياً.", category: "daily" },
  { id: "overdue", title: "تقرير الأعمال المتأخرة", description: "التكليفات التي تجاوزت الموعد وأسباب التأخر.", category: "daily" },
  { id: "weekly-dept", title: "التقرير الأسبوعي للقسم", description: "ملخص أعمال القسم خلال الأسبوع.", category: "weekly" },
  { id: "monthly", title: "التقرير الشهري", description: "ملخص شامل للأعمال خلال الشهر.", category: "monthly" },
  { id: "by-dept", title: "تقرير التكليفات حسب القسم", description: "توزيع التكليفات على الأقسام.", category: "analysis" },
  { id: "by-user", title: "تقرير التكليفات حسب المسؤول", description: "توزيع التكليفات حسب الأشخاص.", category: "analysis" },
  { id: "by-priority", title: "تقرير التكليفات حسب الأولوية", description: "توزيع حسب الأهمية.", category: "analysis" },
  { id: "avg-time", title: "تقرير متوسط زمن الإنجاز", description: "الوقت المتوسط من الإصدار إلى الاعتماد.", category: "analysis" },
  { id: "issued-by-boss", title: "تقرير التكليفات الصادرة عن المدير", description: "جميع التكليفات التي أصدرها المدير.", category: "analysis" },
];

export const reportService = {
  async list(): Promise<ReportDef[]> { return REPORTS; },
  async byId(id: string): Promise<ReportDef | undefined> { return REPORTS.find((r) => r.id === id); },
  async data(id: string): Promise<Task[]> {
    switch (id) {
      case "overdue":
        return tasks.filter((t) => new Date(t.dueAt).getTime() < Date.now() && !["approved", "cancelled", "archived"].includes(t.status));
      case "in-progress":
        return tasks.filter((t) => t.status === "in_progress");
      case "issued-by-boss":
        return tasks.filter((t) => t.issuedById === "u1");
      case "daily-completion":
        return tasks.filter((t) => t.status === "approved");
      default:
        return tasks;
    }
  },
};