import { users } from "@/lib/mock/seed";
import type { User, Role } from "@/lib/types";

export const userService = {
  async list(): Promise<User[]> { return users; },
  async byId(id: string): Promise<User | undefined> { return users.find((u) => u.id === id); },
  async byRole(role: Role): Promise<User[]> { return users.filter((u) => u.role === role); },
  async byDepartment(deptId: string): Promise<User[]> { return users.filter((u) => u.departmentId === deptId); },
};
export function getUser(id: string): User | undefined { return users.find((u) => u.id === id); }