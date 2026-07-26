import { useAppStore } from "@/lib/store";
import type { Role, User } from "@/lib/types";

export const userService = {
  async list(): Promise<User[]> { return useAppStore.getState().users; },
  async byId(id: string): Promise<User | undefined> { return useAppStore.getState().users.find((u) => u.id === id); },
  async byRole(role: Role): Promise<User[]> { return useAppStore.getState().users.filter((u) => u.role === role); },
  async byDepartment(deptId: string): Promise<User[]> { return useAppStore.getState().users.filter((u) => u.departmentId === deptId); },
};
export function getUser(id: string | undefined): User | undefined {
  if (!id) return undefined;
  return useAppStore.getState().users.find((u) => u.id === id);
}
