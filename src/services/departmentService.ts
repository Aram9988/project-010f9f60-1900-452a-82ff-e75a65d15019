import { departments } from "@/lib/mock/seed";
import type { Department } from "@/lib/types";
export const departmentService = {
  async list(): Promise<Department[]> { return departments; },
  async byId(id: string): Promise<Department | undefined> { return departments.find((d) => d.id === id); },
};
export function getDepartment(id: string): Department | undefined { return departments.find((d) => d.id === id); }