import type { Permission, User } from "./types";
import { hasPermission } from "./authz";
import { LayoutDashboard, ClipboardList, Inbox, PlusCircle, Building2, Users2, FileBarChart2, Bell, ShieldCheck, Settings, UserCircle2, Archive, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
  requireOperational?: boolean;
  /** Roles that this route is strictly forbidden for (Diwan lockdown). */
  forbidRoles?: string[];
  /** Always visible regardless of permissions (e.g., profile). */
  alwaysVisible?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, requireOperational: true, forbidRoles: ["diwan"] },
  { to: "/tasks", label: "جميع التكليفات", icon: ClipboardList, requireOperational: true, forbidRoles: ["diwan"] },
  { to: "/tasks/mine", label: "تكليفاتي", icon: Inbox, requireOperational: true, forbidRoles: ["diwan"] },
  { to: "/tasks/new", label: "إنشاء تكليف", icon: PlusCircle, permission: "create_task", forbidRoles: ["diwan"] },
  { to: "/tasks/archived", label: "المؤرشفات", icon: Archive, permission: "view_archived_tasks", forbidRoles: ["diwan"] },
  { to: "/departments", label: "الأقسام", icon: Building2, permission: "manage_departments", forbidRoles: ["diwan"] },
  { to: "/users", label: "المستخدمون والصلاحيات", icon: Users2, permission: "manage_users", forbidRoles: ["diwan"] },
  { to: "/reports", label: "التقارير", icon: FileBarChart2, permission: "view_reports" },
  { to: "/notifications", label: "الإشعارات", icon: Bell, forbidRoles: ["diwan"] },
  { to: "/audit", label: "سجل التدقيق", icon: ShieldCheck, permission: "view_audit", forbidRoles: ["diwan"] },
  { to: "/settings", label: "إعدادات النظام", icon: Settings, permission: "manage_permissions", forbidRoles: ["diwan"] },
  { to: "/profile", label: "الملف الشخصي", icon: UserCircle2, alwaysVisible: true },
];

export function navFor(user: User | undefined): NavItem[] {
  if (!user) return [];
  return NAV_ITEMS.filter((it) => {
    if (it.forbidRoles?.includes(user.role)) return false;
    if (it.alwaysVisible) return true;
    if (it.requireOperational) {
      return hasPermission(user, "view_all_tasks") || hasPermission(user, "view_department_tasks");
    }
    if (it.permission) return hasPermission(user, it.permission);
    return true;
  });
}

/** First permitted landing route for the given user (used on role switch / redirect). */
export function firstAllowedRoute(user: User | undefined): string {
  const items = navFor(user);
  // Prefer /dashboard first if allowed
  const dash = items.find((i) => i.to === "/dashboard");
  if (dash) return "/dashboard";
  const reports = items.find((i) => i.to === "/reports");
  if (reports) return "/reports";
  const first = items.find((i) => i.to !== "/profile");
  return first?.to ?? "/profile";
}

/** Whether the given user is permitted to be on the given pathname. */
export function canAccessRoute(user: User | undefined, pathname: string): boolean {
  if (!user) return false;
  // profile & change-password always allowed to signed-in users
  if (pathname.startsWith("/profile") || pathname.startsWith("/change-password") || pathname.startsWith("/login") || pathname === "/") return true;
  const items = NAV_ITEMS;
  // Match longest prefix
  const it = items
    .filter((i) => pathname === i.to || pathname.startsWith(i.to + "/"))
    .sort((a, b) => b.to.length - a.to.length)[0];
  if (!it) {
    // fallback: task detail pages
    if (pathname.startsWith("/tasks/")) return !user.role.includes("diwan") && (hasPermission(user, "view_all_tasks") || hasPermission(user, "view_department_tasks"));
    if (pathname.startsWith("/reports/")) return hasPermission(user, "view_reports");
    return true;
  }
  if (it.forbidRoles?.includes(user.role)) return false;
  if (it.alwaysVisible) return true;
  if (it.requireOperational) return hasPermission(user, "view_all_tasks") || hasPermission(user, "view_department_tasks");
  if (it.permission) return hasPermission(user, it.permission);
  return true;
}
