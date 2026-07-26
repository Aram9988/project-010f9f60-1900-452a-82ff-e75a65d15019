import type { Role } from "./types";
import { LayoutDashboard, ClipboardList, Inbox, PlusCircle, Building2, Users2, FileBarChart2, Bell, ShieldCheck, Settings, UserCircle2, type LucideIcon } from "lucide-react";

export interface NavItem { to: string; label: string; icon: LucideIcon; roles?: Role[]; }

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/tasks", label: "جميع التكليفات", icon: ClipboardList },
  { to: "/tasks/mine", label: "تكليفاتي", icon: Inbox },
  { to: "/tasks/new", label: "إنشاء تكليف", icon: PlusCircle, roles: ["boss", "associate", "office", "dept_head"] },
  { to: "/departments", label: "الأقسام", icon: Building2 },
  { to: "/users", label: "المستخدمون والصلاحيات", icon: Users2, roles: ["admin", "boss", "associate"] },
  { to: "/reports", label: "التقارير", icon: FileBarChart2 },
  { to: "/notifications", label: "الإشعارات", icon: Bell },
  { to: "/audit", label: "سجل التدقيق", icon: ShieldCheck, roles: ["admin", "boss", "associate"] },
  { to: "/settings", label: "إعدادات النظام", icon: Settings, roles: ["admin"] },
  { to: "/profile", label: "الملف الشخصي", icon: UserCircle2 },
];