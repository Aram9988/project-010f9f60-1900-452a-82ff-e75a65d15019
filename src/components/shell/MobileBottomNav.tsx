import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, PlusCircle, Bell, UserCircle2, FileBarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { hasPermission } from "@/lib/authz";

export function MobileBottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const canOps = user && (hasPermission(user, "view_all_tasks") || hasPermission(user, "view_department_tasks"));
  const canReports = user && hasPermission(user, "view_reports");

  const items = [
    canOps && { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
    canOps && { to: "/tasks", label: "التكليفات", icon: ClipboardList },
    user && hasPermission(user, "create_task") && { to: "/tasks/new", label: "إنشاء", icon: PlusCircle },
    canReports && { to: "/reports", label: "التقارير", icon: FileBarChart2 },
    { to: "/notifications", label: "التنبيهات", icon: Bell },
    { to: "/profile", label: "حسابي", icon: UserCircle2 },
  ].filter(Boolean) as { to: string; label: string; icon: any }[];

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card">
      <ul className="flex">
        {items.slice(0, 5).map((it) => {
          const active = path === it.to;
          const Icon = it.icon;
          return (
            <li key={it.to} className="flex-1">
              <Link to={it.to} className={cn("flex flex-col items-center gap-1 py-2 text-[10px]", active ? "text-primary" : "text-muted-foreground")}>
                <Icon className="h-5 w-5" />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
