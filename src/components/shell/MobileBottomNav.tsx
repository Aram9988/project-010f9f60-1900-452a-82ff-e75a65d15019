import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, PlusCircle, Bell, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/tasks", label: "التكليفات", icon: ClipboardList },
  { to: "/tasks/new", label: "إنشاء", icon: PlusCircle },
  { to: "/notifications", label: "التنبيهات", icon: Bell },
  { to: "/profile", label: "حسابي", icon: UserCircle2 },
];

export function MobileBottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card">
      <ul className="flex">
        {items.map((it) => {
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