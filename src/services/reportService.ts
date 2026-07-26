import { useAppStore } from "@/lib/store";
import { scopeTasks, hasPermission } from "@/lib/authz";
import type { ActivityEvent, ActivityType, User } from "@/lib/types";

export type ReportPeriod = "day" | "week" | "month" | "custom";

export interface ReportDef {
  id: string;
  title: string;
  description: string;
  category: "daily" | "weekly" | "monthly" | "analysis";
}

export const REPORTS: ReportDef[] = [
  { id: "daily", title: "التقرير اليومي", description: "الأحداث والتحديثات الفعلية خلال اليوم فقط.", category: "daily" },
  { id: "weekly", title: "التقرير الأسبوعي", description: "أحداث الأسبوع مجمّعة حسب التكليف.", category: "weekly" },
  { id: "monthly", title: "التقرير الشهري", description: "أحداث الشهر مجمّعة حسب التكليف.", category: "monthly" },
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

export function periodRange(period: ReportPeriod, from?: string, to?: string): { from: string; to: string } {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (period === "day") return { from: start.toISOString(), to: end.toISOString() };
  if (period === "week") { start.setDate(start.getDate() - 6); return { from: start.toISOString(), to: end.toISOString() }; }
  if (period === "month") { start.setDate(start.getDate() - 29); return { from: start.toISOString(), to: end.toISOString() }; }
  return {
    from: from ? new Date(from).toISOString() : start.toISOString(),
    to: to ? new Date(to).toISOString() : end.toISOString(),
  };
}

export const reportService = {
  async list(): Promise<ReportDef[]> { return REPORTS; },
  async byId(id: string): Promise<ReportDef | undefined> { return REPORTS.find((r) => r.id === id); },

  /** Build an activity-based report scoped by authorization. */
  async build(user: User | undefined, filters: ReportFilters): Promise<ReportRow[]> {
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
