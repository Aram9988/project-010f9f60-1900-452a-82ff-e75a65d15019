import { useEffect, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { ThemeInit } from "@/components/theme-init";
import { useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { canAccessRoute, firstAllowedRoute } from "@/lib/nav";

export function AppShell({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const uid = useSession((s) => s.currentUserId);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const user = getUser(uid);
  // Redirect if the current identity is not allowed on this route (e.g., after demo user switch).
  useEffect(() => {
    if (!user) return;
    if (!canAccessRoute(user, pathname)) {
      const target = firstAllowedRoute(user);
      if (target !== pathname) nav({ to: target, replace: true });
    }
  }, [uid, pathname, user, nav]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ThemeInit />
      <TopBar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-w-0 pb-20 md:pb-8">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}