import type { Permission, User } from "./types";
import { hasPermission } from "./authz";
import { LayoutDashboard, ClipboardList, Inbox, PlusCircle, Building2, Users2, FileBarChart2, Bell, ShieldCheck, Settings, UserCircle2, Archive, type LucideIcon } from "lucide-react";

export interface NavItem { to: string; label: string; icon: LucideIcon; permission?: Permission; requireOperational?: boolean; }

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, requireOperational: true },
  { to: "/tasks", label: "جميع التكليفات", icon: ClipboardList, requireOperational: true },
  { to: "/tasks/mine", label: "تكليفاتي", icon: Inbox, requireOperational: true },
  { to: "/tasks/new", label: "إنشاء تكليف", icon: PlusCircle, permission: "create_task" },
  { to: "/tasks/archived", label: "المؤرشفات", icon: Archive, permission: "view_archived_tasks" },
  { to: "/departments", label: "الأقسام", icon: Building2, permission: "manage_departments" },
  { to: "/users", label: "المستخدمون والصلاحيات", icon: Users2, permission: "manage_users" },
  { to: "/reports", label: "التقارير", icon: FileBarChart2, permission: "view_reports" },
  { to: "/notifications", label: "الإشعارات", icon: Bell },
  { to: "/audit", label: "سجل التدقيق", icon: ShieldCheck, permission: "view_audit" },
  { to: "/settings", label: "إعدادات النظام", icon: Settings, permission: "manage_permissions" },
  { to: "/profile", label: "الملف الشخصي", icon: UserCircle2 },
];

export function navFor(user: User | undefined): NavItem[] {
  if (!user) return [];
  return NAV_ITEMS.filter((it) => {
    if (it.requireOperational) {
      return hasPermission(user, "view_all_tasks") || hasPermission(user, "view_department_tasks");
    }
    if (it.permission) return hasPermission(user, it.permission);
    return true;
  });
}
