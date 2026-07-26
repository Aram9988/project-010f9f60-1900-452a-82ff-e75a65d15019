import { useAppStore } from "@/lib/store";
import type { AppNotification } from "@/lib/types";
export const notificationService = {
  async listForUser(userId: string): Promise<AppNotification[]> {
    return useAppStore.getState().notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async unreadCount(userId: string): Promise<number> {
    return useAppStore.getState().notifications.filter((n) => n.userId === userId && !n.read).length;
  },
  async markRead(id: string) { useAppStore.getState().markNotifRead(id); },
  async markAllRead(userId: string) { useAppStore.getState().markAllNotifsRead(userId); },
};
