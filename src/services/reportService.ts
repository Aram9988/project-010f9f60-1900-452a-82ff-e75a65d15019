import { useAppStore } from "@/lib/store";
import { scopeTasks, hasPermission } from "@/lib/authz";
import type { ActivityEvent, ActivityType, User } from "@/lib/types";

export type ReportPeriod = "daily" | "weekly" | "monthly" | "custom" | "completed" | "in_progress";

export interface ReportDef {
  id: string;
  title: string;
  description: string;
  category: "daily" | "weekly" | "monthly" | "analysis";
}

export const REPORTS: ReportDef[] = [
  { id: "daily", title: "التقرير اليومي", description: "الأحداث والتحديثات الفعلية خلال يوم محدد فقط.", category: "daily" },
  { id: "weekly", title: "التقرير الأسبوعي", description: "أحداث أسبوع محدد مجمّعة حسب التكليف.", category: "weekly" },
  { id: "monthly", title: "التقرير الشهري", description: "أحداث شهر محدد مجمّعة حسب التكليف.", category: "monthly" },
  { id: "completed", title: "التكليفات المُنجزة", description: "التكليفات التي اعتُمدت (أُنجزت رسمياً) خلال الفترة.", category: "analysis" },
  { id: "in_progress", title: "التكليفات قيد التنفيذ", description: "التكليفات التي جرى العمل عليها خلال الفترة (لم تُنجز بعد).", category: "analysis" },
  { id: "custom", title: "تقرير حسب فترة مخصصة", description: "اختر تاريخ البدء والانتهاء.", category: "analysis" },
];

export interface ReportRow {
  taskId: string;
  number: string;
  title: string;
  departmentId: string;
  responsibleId?: string;
  events: ActivityEvent[];
  latestStatus: string;
}

export interface ReportFilters {
  from: string; // ISO
  to: string; // ISO
  departmentId?: string;
  status?: string;
  personId?: string;
  eventType?: ActivityType;
}

/** Exact calendar periods (anchored on `anchor` date, default = today). */
export function periodRange(period: ReportPeriod, from?: string, to?: string, anchor?: string): { from: string; to: string } {
  const base = anchor ? new Date(anchor) : new Date();
  if (isNaN(base.getTime())) base.setTime(Date.now());
  const start = new Date(base); const end = new Date(base);
  start.setHours(0,0,0,0); end.setHours(23,59,59,999);

  if (period === "daily") {
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (period === "weekly") {
    // ISO week starts Monday
    const day = start.getDay(); // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
    end.setTime(start.getTime()); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (period === "monthly") {
    start.setDate(1);
    end.setTime(start.getTime()); end.setMonth(start.getMonth() + 1); end.setDate(0); end.setHours(23,59,59,999);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  // custom / completed / in_progress use explicit from/to
  const s = from ? new Date(from) : new Date(); if (from) s.setHours(0,0,0,0);
  const e = to ? new Date(to) : new Date(); if (to) e.setHours(23,59,59,999);
  return { from: s.toISOString(), to: e.toISOString() };
}

export const reportService = {
  async list(): Promise<ReportDef[]> { return REPORTS; },
  async byId(id: string): Promise<ReportDef | undefined> { return REPORTS.find((r) => r.id === id); },

  /** Build an activity-based report scoped by authorization. */
  async build(user: User | undefined, filters: ReportFilters & { mode?: "activity" | "completed" | "in_progress" }): Promise<ReportRow[]> {
    if (!user || !hasPermission(user, "view_reports")) return [];
    const s = useAppStore.getState();
    const tasks = scopeTasks(user, s.tasks);
    const taskById = new Map(tasks.map((t) => [t.id, t]));

    const from = new Date(filters.from).getTime();
    const to = new Date(filters.to).getTime();
    let events = s.activity.filter((e) => {
      const ts = new Date(e.createdAt).getTime();
      if (ts < from || ts > to) return false;
      const t = taskById.get(e.taskId); if (!t) return false;
      if (filters.departmentId && t.departmentId !== filters.departmentId) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.personId && e.actorId !== filters.personId) return false;
      if (filters.eventType && e.type !== filters.eventType) return false;
      return true;
    });

    if (filters.mode === "completed") {
      const approvedTaskIds = new Set(
        s.activity.filter((e) => e.type === "task_approved" && new Date(e.createdAt).getTime() >= from && new Date(e.createdAt).getTime() <= to)
          .map((e) => e.taskId),
      );
      events = events.filter((e) => approvedTaskIds.has(e.taskId));
    } else if (filters.mode === "in_progress") {
      // Only tasks that saw movement in-period AND are not yet approved by period end.
      const approvedByEnd = new Set(
        s.activity.filter((e) => e.type === "task_approved" && new Date(e.createdAt).getTime() <= to).map((e) => e.taskId),
      );
      events = events.filter((e) => !approvedByEnd.has(e.taskId));
    }

    const grouped = new Map<string, ReportRow>();
    for (const ev of events) {
      const t = taskById.get(ev.taskId); if (!t) continue;
      let row = grouped.get(t.id);
      if (!row) {
        row = {
          taskId: t.id, number: t.number, title: t.title,
          departmentId: t.departmentId,
          responsibleId: t.assigneeId ?? t.deptHeadId,
          events: [], latestStatus: t.status,
        };
        grouped.set(t.id, row);
      }
      row.events.push(ev);
    }
    return Array.from(grouped.values()).sort((a, b) => a.number.localeCompare(b.number));
  },
};
