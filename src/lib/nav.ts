import type { Permission, User } from "./types";
import { hasPermission } from "./authz";
import { LayoutDashboard, ClipboardList, PlusCircle, FileBarChart2, Settings2, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  /** Short label used on the mobile bar. */
  shortLabel?: string;
  icon: LucideIcon;
  permission?: Permission;
  requireOperational?: boolean;
  /** Roles that this route is strictly forbidden for (Diwan lockdown). */
  forbidRoles?: string[];
  /** Always visible regardless of permissions (e.g., profile). */
  alwaysVisible?: boolean;
}

/** Does the user administer the system (department/user/permission management)? */
export function isAdministrator(user: User | undefined): boolean {
  return (
    hasPermission(user, "manage_departments") ||
    hasPermission(user, "manage_users") ||
    hasPermission(user, "manage_permissions")
  );
}

/**
 * PRIMARY navigation — only the pages used in daily work.
 * Everything else (notifications, profile, archive, administration) is
 * reachable from the top bar, the tasks page, or the admin hub.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "لوحة التحكم", shortLabel: "الرئيسية", icon: LayoutDashboard, requireOperational: true, forbidRoles: ["diwan"] },
  { to: "/tasks", label: "التكليفات", shortLabel: "التكليفات", icon: ClipboardList, requireOperational: true, forbidRoles: ["diwan"] },
  { to: "/tasks/new", label: "تكليف جديد", shortLabel: "جديد", icon: PlusCircle, permission: "create_task", forbidRoles: ["diwan"] },
  { to: "/reports", label: "التقارير", shortLabel: "التقارير", icon: FileBarChart2, permission: "view_reports" },
];

/**
 * Full route permission table — used ONLY for access control, not for the
 * sidebar. Hiding a link must never weaken the guard behind it.
 */
const ROUTE_RULES: NavItem[] = [
  ...NAV_ITEMS,
  { to: "/tasks/mine", label: "تكليفاتي", icon: ClipboardList, requireOperational: true, forbidRoles: ["diwan"] },
  { to: "/tasks/archived", label: "المؤرشفات", icon: ClipboardList, permission: "view_archived_tasks", forbidRoles: ["diwan"] },
  { to: "/notifications", label: "الإشعارات", icon: ClipboardList, forbidRoles: ["diwan"] },
  { to: "/departments", label: "الأقسام", icon: Settings2, permission: "manage_departments", forbidRoles: ["diwan"] },
  { to: "/users", label: "المستخدمون والصلاحيات", icon: Settings2, permission: "manage_users", forbidRoles: ["diwan"] },
  { to: "/audit", label: "سجل التدقيق", icon: Settings2, permission: "view_audit", forbidRoles: ["diwan"] },
  { to: "/settings", label: "إعدادات النظام", icon: Settings2, permission: "manage_permissions", forbidRoles: ["diwan"] },
  { to: "/profile", label: "الملف الشخصي", icon: Settings2, alwaysVisible: true },
];

function allowed(user: User, it: NavItem): boolean {
  if (it.forbidRoles?.includes(user.role)) return false;
  if (it.alwaysVisible) return true;
  if (it.requireOperational) {
    return hasPermission(user, "view_all_tasks") || hasPermission(user, "view_department_tasks");
  }
  if (it.permission) return hasPermission(user, it.permission);
  return true;
}

/** Desktop sidebar items for the given user (plus the admin hub when relevant). */
export function navFor(user: User | undefined): NavItem[] {
  if (!user) return [];
  const items = NAV_ITEMS.filter((it) => allowed(user, it));
  if (isAdministrator(user)) {
    items.push({ to: "/admin", label: "الإدارة", shortLabel: "الإدارة", icon: Settings2 });
  }
  return items;
}

/** Mobile bar: at most four destinations, never mechanically sliced. */
export function mobileNavFor(user: User | undefined): NavItem[] {
  if (!user) return [];
  const wanted = ["/dashboard", "/tasks", "/tasks/new", "/reports"];
  return NAV_ITEMS.filter((it) => wanted.includes(it.to) && allowed(user, it)).slice(0, 4);
}

/** First permitted landing route for the given user (used on role switch / redirect). */
export function firstAllowedRoute(user: User | undefined): string {
  if (!user) return "/login";
  if (allowed(user, NAV_ITEMS[0])) return "/dashboard";
  if (hasPermission(user, "view_reports")) return "/reports";
  const first = navFor(user)[0];
  return first?.to ?? "/profile";
}

/** Whether the given user is permitted to be on the given pathname. */
export function canAccessRoute(user: User | undefined, pathname: string): boolean {
  if (!user) return false;
  // profile & change-password always allowed to signed-in users
  if (pathname.startsWith("/profile") || pathname.startsWith("/change-password") || pathname.startsWith("/login") || pathname === "/") return true;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return isAdministrator(user) || hasPermission(user, "view_audit");
  }
  const it = ROUTE_RULES
    .filter((i) => pathname === i.to || pathname.startsWith(i.to + "/"))
    .sort((a, b) => b.to.length - a.to.length)[0];
  if (!it) {
    // fallback: task detail pages
    if (pathname.startsWith("/tasks/")) return !user.role.includes("diwan") && (hasPermission(user, "view_all_tasks") || hasPermission(user, "view_department_tasks"));
    if (pathname.startsWith("/reports/")) return hasPermission(user, "view_reports");
    return true;
  }
  return allowed(user, it);
}
