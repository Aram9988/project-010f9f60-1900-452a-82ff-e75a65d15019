import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { hasPermission } from "@/lib/authz";
import { isAdministrator } from "@/lib/nav";
import { AccessDenied } from "@/components/access-denied";
import { Building2, ShieldCheck, Settings, Users2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "الإدارة — منظومة التكليفات" },
      { name: "description", content: "مركز إدارة الأقسام والمستخدمين والصلاحيات وسجل التدقيق وإعدادات النظام." },
      { property: "og:title", content: "الإدارة — منظومة التكليفات" },
      { property: "og:description", content: "مركز إدارة الأقسام والمستخدمين والصلاحيات وسجل التدقيق." },
    ],
  }),
  component: AdminHub,
});

function AdminHub() {
  const user = getUser(useSession((s) => s.currentUserId));
  if (!user || (!isAdministrator(user) && !hasPermission(user, "view_audit"))) return <AccessDenied />;

  const cards = [
    { to: "/departments" as const, label: "الأقسام", desc: "إضافة الأقسام وتحديد رؤسائها ومسؤولي المكتب.", icon: Building2, show: hasPermission(user, "manage_departments") },
    { to: "/users" as const, label: "المستخدمون والصلاحيات", desc: "إدارة الحسابات وكلمات المرور والأدوار.", icon: Users2, show: hasPermission(user, "manage_users") },
    { to: "/audit" as const, label: "سجل التدقيق", desc: "كل الإجراءات التي جرت على النظام.", icon: ShieldCheck, show: hasPermission(user, "view_audit") },
    { to: "/settings" as const, label: "إعدادات النظام", desc: "مصفوفة الصلاحيات وإعدادات عامة.", icon: Settings, show: hasPermission(user, "manage_permissions") },
  ].filter((c) => c.show);

  return (
    <AppShell>
      <PageHeader title="الإدارة" subtitle="إعدادات النظام بعيداً عن العمل اليومي" />
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="rounded-2xl border bg-card p-6 transition-shadow hover:shadow-md">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <c.icon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{c.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
