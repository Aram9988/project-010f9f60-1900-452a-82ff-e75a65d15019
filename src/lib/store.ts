import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  currentUserId: string;
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  recentDepartments: string[];
  setCurrentUser: (id: string) => void;
  setTheme: (t: "light" | "dark") => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  pushRecentDepartment: (id: string) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      currentUserId: "u1",
      theme: "light",
      sidebarCollapsed: false,
      recentDepartments: [],
      setCurrentUser: (id) => set({ currentUserId: id }),
      setTheme: (t) => set({ theme: t }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      pushRecentDepartment: (id) =>
        set((s) => ({
          recentDepartments: [id, ...s.recentDepartments.filter((x) => x !== id)].slice(0, 3),
        })),
    }),
    { name: "tk-session" },
  ),
);