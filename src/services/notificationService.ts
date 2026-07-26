import { notifications } from "@/lib/mock/seed";
import type { AppNotification } from "@/lib/types";
export const notificationService = {
  async listForUser(userId: string): Promise<AppNotification[]> {
    return notifications.filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async unreadCount(userId: string): Promise<number> {
    return notifications.filter((n) => n.userId === userId && !n.read).length;
  },
  async markRead(id: string) { const n = notifications.find((x) => x.id === id); if (n) n.read = true; },
  async markAllRead(userId: string) { notifications.forEach((n) => { if (n.userId === userId) n.read = true; }); },
};