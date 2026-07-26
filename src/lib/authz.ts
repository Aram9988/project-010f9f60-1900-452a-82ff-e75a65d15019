import type { Permission, Task, User } from "./types";
import { useAppStore } from "./store";

/** Runtime permission check driven by role→permission map in the store. */
export function hasPermission(user: User | undefined, perm: Permission): boolean {
  if (!user || user.active === false || user.archived) return false;
  const map = useAppStore.getState().rolePermissions;
  return (map[user.role] ?? []).includes(perm);
}

/** Whether the given user is allowed to see the given task. */
export function canAccessTask(user: User | undefined, task: Task): boolean {
  if (!user) return false;
  if (task.archived && !hasPermission(user, "view_archived_tasks")) return false;
  if (hasPermission(user, "view_all_tasks")) return true;
  if (hasPermission(user, "view_department_tasks")) {
    // Department is the ONLY gate. Assignment/participation in another
    // department must never widen scope — that would leak cross-department
    // task titles, numbers, and discussion content.
    if (!user.departmentId) return false;
    return task.departmentId === user.departmentId;
  }
  return false;
}

/** Filter a task list down to the ones the user can access. */
export function scopeTasks(user: User | undefined, tasks: Task[]): Task[] {
  if (!user) return [];
  return tasks.filter((t) => canAccessTask(user, t));
}

/** Which department IDs is the user scoped to? undefined = all. */
export function scopedDepartments(user: User | undefined): string[] | undefined {
  if (!user) return [];
  if (hasPermission(user, "view_all_tasks")) return undefined;
  if (user.role === "office" && user.departmentId) return [user.departmentId];
  if (user.departmentId) return [user.departmentId];
  return [];
}