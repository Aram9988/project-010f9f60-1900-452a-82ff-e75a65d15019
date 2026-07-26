import { Link, useRouterState } from "@tanstack/react-router";
import { NAV_ITEMS } from "@/lib/nav";
import { useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { cn } from "@/lib/utils";
import { ChevronsLeftRight } from "lucide-react";

export function Sidebar() {
  const collapsed = useSession((s) => s.sidebarCollapsed);
  const toggle = useSession((s) => s.toggleSidebar);
  const userId = useSession((s) => s.currentUserId);
  const user = getUser(userId);
  const path = useRouterState({ select: (r) => r.location.pathname });

  const items = NAV_ITEMS.filter(
    (i) => !i.roles || (user && i.roles.includes(user.role)),
  );

  return (
    <aside
      className={cn(
        "hidden md:flex sticky top-16 h-[calc(100vh-4rem)] shrink-0 flex-col border-l border-border bg-sidebar text-sidebar-foreground transition-[width]",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {items.map((it) => {
            const active = path === it.to || (it.to !== "/dashboard" && path.startsWith(it.to));
            const Icon = it.icon;
            return (
              <li key={it.to}>
                <Link
                  to={it.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent",
                  )}
                  title={it.label}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span className="truncate">{it.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <button
        onClick={toggle}
        className="border-t border-sidebar-border p-3 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent flex items-center gap-2 justify-center"
      >
        <ChevronsLeftRight className="h-4 w-4" />
        {!collapsed && <span>طي الشريط</span>}
      </button>
    </aside>
  );
}