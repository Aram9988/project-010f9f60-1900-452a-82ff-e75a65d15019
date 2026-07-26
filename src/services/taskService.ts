import { tasks, activity } from "@/lib/mock/seed";
import type { Task, TaskStatus, ActivityEvent } from "@/lib/types";

export const taskService = {
  async list(): Promise<Task[]> { return [...tasks]; },
  async byId(id: string): Promise<Task | undefined> { return tasks.find((t) => t.id === id); },
  async create(input: Partial<Task>): Promise<Task> {
    const num = tasks.length + 1;
    const t: Task = {
      id: "t" + Date.now(),
      number: "TK-2026-" + String(1000 + num).padStart(4, "0"),
      title: input.title || "بدون عنوان",
      description: input.description || "",
      issuedById: input.issuedById || "u1",
      departmentId: input.departmentId || "d1",
      deptHeadId: input.deptHeadId,
      assigneeId: input.assigneeId,
      participantIds: input.participantIds || [],
      issuedAt: new Date().toISOString(),
      dueAt: input.dueAt || new Date(Date.now() + 7 * 86400000).toISOString(),
      priority: input.priority || "normal",
      status: input.status || "new",
      progress: 0,
      tags: input.tags || [],
      attachments: [],
      subtasks: [],
    };
    tasks.unshift(t);
    activity.unshift({ id: "e" + Date.now(), taskId: t.id, type: "task_created", actorId: t.issuedById, createdAt: t.issuedAt });
    return t;
  },
  async updateStatus(id: string, status: TaskStatus, actorId: string) {
    const t = tasks.find((x) => x.id === id); if (!t) return;
    t.status = status;
    activity.unshift({ id: "e" + Date.now(), taskId: id, type: "status_changed", actorId, createdAt: new Date().toISOString(), detail: status });
  },
  async updateProgress(id: string, progress: number, actorId: string) {
    const t = tasks.find((x) => x.id === id); if (!t) return;
    t.progress = progress;
    activity.unshift({ id: "e" + Date.now(), taskId: id, type: "progress_updated", actorId, createdAt: new Date().toISOString(), detail: progress + "٪" });
  },
  async approve(id: string, actorId: string) {
    const t = tasks.find((x) => x.id === id); if (!t) return;
    t.status = "approved"; t.approvedById = actorId; t.approvedAt = new Date().toISOString();
    activity.unshift({ id: "e" + Date.now(), taskId: id, type: "task_approved", actorId, createdAt: t.approvedAt });
  },
  async returnForRevision(id: string, actorId: string, reason: string) {
    const t = tasks.find((x) => x.id === id); if (!t) return;
    t.status = "returned"; t.delayReason = reason;
    activity.unshift({ id: "e" + Date.now(), taskId: id, type: "task_returned", actorId, createdAt: new Date().toISOString(), detail: reason });
  },
  async acknowledge(id: string, actorId: string) {
    const t = tasks.find((x) => x.id === id); if (!t) return;
    if (t.status === "new") t.status = "received";
    activity.unshift({ id: "e" + Date.now(), taskId: id, type: "task_acknowledged", actorId, createdAt: new Date().toISOString() });
  },
  async activityFor(taskId: string): Promise<ActivityEvent[]> {
    return activity.filter((a) => a.taskId === taskId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
};

export function tasksForUser(userId: string, role: string): Task[] {
  if (["boss", "associate", "office", "admin"].includes(role)) return tasks;
  return tasks.filter((t) => t.assigneeId === userId || t.deptHeadId === userId || t.participantIds.includes(userId));
}