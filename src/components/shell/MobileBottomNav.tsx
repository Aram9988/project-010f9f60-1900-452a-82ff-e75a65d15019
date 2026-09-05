import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { mobileNavFor } from "@/lib/nav";

export function MobileBottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const items = mobileNavFor(user);
  if (items.length === 0) return null;

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card">
      <ul className="flex">
        {items.map((it) => {
          const active = path === it.to || (it.to !== "/dashboard" && path.startsWith(it.to));
          const Icon = it.icon;
          return (
            <li key={it.to} className="flex-1">
              <Link to={it.to} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px]", active ? "text-primary" : "text-muted-foreground")}>
                <Icon className="h-5 w-5" />
                <span>{it.shortLabel ?? it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
