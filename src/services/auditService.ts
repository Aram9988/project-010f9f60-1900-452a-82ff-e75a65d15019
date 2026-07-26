import { audit } from "@/lib/mock/seed";
import type { AuditEntry } from "@/lib/types";
export const auditService = {
  async list(): Promise<AuditEntry[]> { return [...audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
};