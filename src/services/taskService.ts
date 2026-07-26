import { useAppStore } from "@/lib/store";
import { scopeTasks } from "@/lib/authz";
import type { ActivityEvent, Task, TaskStatus, User } from "@/lib/types";

export const taskService = {
  async list(): Promise<Task[]> { return useAppStore.getState().tasks; },
  async listActive(): Promise<Task[]> { return useAppStore.getState().tasks.filter((t) => !t.archived); },
  async listArchived(): Promise<Task[]> { return useAppStore.getState().tasks.filter((t) => t.archived); },
  async byId(id: string): Promise<Task | undefined> { return useAppStore.getState().tasks.find((t) => t.id === id); },
  async create(input: Partial<Task> & { title: string; departmentId: string; issuedById: string }): Promise<Task> {
    return useAppStore.getState().createTask(input);
  },
  async updateStatus(id: string, status: TaskStatus, actorId: string) {
    useAppStore.getState().updateTaskStatus(id, status, actorId);
  },
  async updateProgress(id: string, progress: number, actorId: string) {
    useAppStore.getState().updateTaskProgress(id, progress, actorId);
  },
  async acknowledge(id: string, actorId: string) { useAppStore.getState().acknowledgeTask(id, actorId); },
  async submit(id: string, actorId: string, summary?: string) { useAppStore.getState().submitTask(id, actorId, summary); },
  async approve(id: string, actorId: string) { useAppStore.getState().approveTask(id, actorId); },
  async returnForRevision(id: string, actorId: string, reason: string) { useAppStore.getState().returnTask(id, actorId, reason); },
  async archive(id: string, actorId: string, reason: string) { useAppStore.getState().archiveTask(id, actorId, reason); },
  async restore(id: string, actorId: string) { useAppStore.getState().restoreTask(id, actorId); },
  async permanentlyDelete(id: string, actorId: string) { useAppStore.getState().permanentlyDeleteTask(id, actorId); },
  async activityFor(taskId: string): Promise<ActivityEvent[]> {
    return useAppStore.getState().activity
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
};

/** Legacy helper — now goes through central authorization. */
export function tasksForUser(userId: string, _role?: string): Task[] {
  const state = useAppStore.getState();
  const user = state.users.find((u) => u.id === userId);
  return scopeTasks(user, state.tasks.filter((t) => !t.archived));
}
