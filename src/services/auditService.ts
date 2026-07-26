import { useAppStore } from "@/lib/store";
import type { AuditEntry } from "@/lib/types";
export const auditService = {
  async list(): Promise<AuditEntry[]> {
    return [...useAppStore.getState().audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
};
