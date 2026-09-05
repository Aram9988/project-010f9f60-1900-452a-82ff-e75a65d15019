import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore, useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { TaskTable } from "@/components/task/TaskTable";
import { StatusBadge } from "@/components/badges";
import { ROLE_LABELS, type TaskStatus } from "@/lib/types";
import { scopeTasks, hasPermission } from "@/lib/authz";
import { CheckCircle2, Clock, Plus, Send, ShieldAlert, Sparkles } from "lucide-react";
import { AccessDenied } from "@/components/access-denied";
import { VerbalTaskDialog } from "@/components/task/VerbalTaskDialog";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — منظومة التكليفات" },
      { name: "description", content: "لوحة تحكم مبسطة لمتابعة تكليفات فرع اتصالات ريف دمشق." },
      { property: "og:title", content: "لوحة التحكم — منظومة التكليفات" },
      { property: "og:description", content: "متابعة سريعة للتكليفات النشطة." },
    ],
  }),
  component: DashboardPage,
});

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "info" | "primary" | "gold" | "success" }) {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-gold/15 text-gold",
    success: "bg-success/15 text-success",
    info: "bg-info/10 text-info",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`grid h-12 w-12 place-items-center rounded-xl ${toneCls}`}><Icon className="h-6 w-6" /></div>
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-3xl font-black">{value}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const allTasks = useAppStore((s) => s.tasks);

  if (!user || (!hasPermission(user, "view_all_tasks") && !hasPermission(user, "view_department_tasks"))) {
    return <AccessDenied />;
  }

  const scoped = scopeTasks(user, allTasks.filter((t) => !t.archived));
  const count = (...s: TaskStatus[]) => scoped.filter((t) => s.includes(t.status)).length;
  const needsAttention = scoped.filter((t) => ["returned", "waiting_info", "blocked"].includes(t.status));
  const latest = [...scoped].sort((a, b) => (b.issuedAt || "").localeCompare(a.issuedAt || "")).slice(0, 8);
  const canCreate = hasPermission(user, "create_task");

  return (
    <AppShell>
      <PageHeader
        title={`مرحباً، ${user.name.split(" ").slice(-2).join(" ")}`}
        subtitle={ROLE_LABELS[user.role]}
        actions={canCreate ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg"><Link to="/tasks/new"><Plus className="h-5 w-5 me-1" /> إنشاء تكليف</Link></Button>
            <VerbalTaskDialog />
          </div>
        ) : undefined}
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat icon={Sparkles} label="جديد" value={count("new")} tone="info" />
        <Stat icon={Clock} label="قيد التنفيذ" value={count("received", "in_progress")} tone="primary" />
        <Stat icon={Send} label="بانتظار الاعتماد" value={count("submitted")} tone="gold" />
        <Stat icon={CheckCircle2} label="مكتمل ومعتمد" value={count("approved")} tone="success" />
      </div>

      {needsAttention.length > 0 && (
        <Card className="mt-8 border-gold/40">
          <CardHeader className="flex-row items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-gold" />
            <CardTitle className="text-base">تحتاج متابعة ({needsAttention.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {needsAttention.slice(0, 5).map((t) => (
              <Link key={t.id} to="/tasks/$taskId" params={{ taskId: t.id }} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-muted-foreground">{t.number}</div>
                  <div className="text-sm font-medium line-clamp-1">{t.title}</div>
                </div>
                <StatusBadge status={t.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">أحدث التكليفات</h2>
          <Link to="/tasks" className="text-sm text-primary hover:underline">عرض كل التكليفات</Link>
        </div>
        <TaskTable tasks={latest} />
      </div>
    </AppShell>
  );
}
