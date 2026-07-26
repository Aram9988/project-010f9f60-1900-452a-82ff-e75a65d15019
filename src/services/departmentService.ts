import { useAppStore } from "@/lib/store";
import type { Department } from "@/lib/types";
export const departmentService = {
  async list(): Promise<Department[]> { return useAppStore.getState().departments; },
  async byId(id: string): Promise<Department | undefined> { return useAppStore.getState().departments.find((d) => d.id === id); },
};
export function getDepartment(id: string | undefined): Department | undefined {
  if (!id) return undefined;
  return useAppStore.getState().departments.find((d) => d.id === id);
}
