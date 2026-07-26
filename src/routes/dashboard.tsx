import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore, useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { TaskTable } from "@/components/task/TaskTable";
import { StatusBadge } from "@/components/badges";
import { STATUS_LABELS, ROLE_LABELS, type TaskStatus } from "@/lib/types";
import { scopeTasks, hasPermission } from "@/lib/authz";
import { CheckCircle2, ClipboardList, Clock, FileCheck2, MessageCircle, RotateCcw, ShieldAlert, Sparkles, PauseCircle, Send } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { AccessDenied } from "@/components/access-denied";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — منظومة التكليفات" },
      { name: "description", content: "لوحة تحكم رئيسية لمتابعة تكليفات فرع اتصالات ريف دمشق." },
    ],
  }),
  component: DashboardPage,
});

function Stat({ icon: Icon, label, value, tone = "primary" }: { icon: any; label: string; value: number | string; tone?: "primary" | "gold" | "destructive" | "success" | "info" | "muted" }) {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-gold/15 text-gold-foreground",
    destructive: "bg-destructive/10 text-destructive",
    success: "bg-success/15 text-success",
    info: "bg-info/10 text-info",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`grid h-11 w-11 place-items-center rounded-lg ${toneCls}`}><Icon className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-black">{value}</div>
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
  const depts = useAppStore((s) => s.departments);

  if (!user || (!hasPermission(user, "view_all_tasks") && !hasPermission(user, "view_department_tasks"))) {
    return <AccessDenied />;
  }

  const scoped = scopeTasks(user, allTasks.filter((t) => !t.archived));
  const count = (s: TaskStatus) => scoped.filter((t) => t.status === s).length;
  const needsAttention = scoped.filter((t) => ["returned","waiting_info","blocked"].includes(t.status));

  const byStatus = Object.keys(STATUS_LABELS).map((k) => ({
    name: STATUS_LABELS[k as TaskStatus], value: count(k as TaskStatus),
  })).filter((x) => x.value > 0);

  const byDept = depts
    .filter((d) => !d.archived)
    .map((d) => ({ name: d.short, value: scoped.filter((t) => t.departmentId === d.id).length }))
    .filter((x) => x.value > 0);

  // real 7-day approval trend from activity
  const trend: { m: string; done: number }[] = [];
  const days = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  const now = new Date();
  const activity = useAppStore.getState().activity;
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const done = activity.filter((e) => e.type === "task_approved" && new Date(e.createdAt) >= d && new Date(e.createdAt) < next).length;
    trend.push({ m: days[d.getDay()], done });
  }

  const COLORS = ["var(--color-primary)","var(--color-gold)","var(--color-success)","var(--color-info)","var(--color-destructive)"];

  return (
    <AppShell>
      <PageHeader
        title={`مرحباً، ${user.name.split(" ").slice(-2).join(" ")}`}
        subtitle={`${ROLE_LABELS[user.role]} — لمحة سريعة عن التكليفات النشطة`}
      />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Stat icon={Sparkles} label="جديد" value={count("new")} tone="info" />
        <Stat icon={ClipboardList} label="تم الاستلام" value={count("received")} tone="primary" />
        <Stat icon={Clock} label="قيد التنفيذ" value={count("in_progress")} tone="primary" />
        <Stat icon={MessageCircle} label="بانتظار المعلومات" value={count("waiting_info")} tone="gold" />
        <Stat icon={PauseCircle} label="متوقف / عالق" value={count("blocked")} tone="destructive" />
        <Stat icon={Send} label="مقدم للمراجعة" value={count("submitted")} tone="gold" />
        <Stat icon={RotateCcw} label="معاد للتعديل" value={count("returned")} tone="destructive" />
        <Stat icon={CheckCircle2} label="مكتمل ومعتمد" value={count("approved")} tone="success" />
      </div>

      {needsAttention.length > 0 && (
        <Card className="mt-4 border-gold/40">
          <CardHeader className="flex-row items-center gap-2"><ShieldAlert className="h-4 w-4 text-gold" /><CardTitle className="text-base">تحتاج متابعة ({needsAttention.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {needsAttention.slice(0, 6).map((t) => (
              <Link key={t.id} to="/tasks/$taskId" params={{ taskId: t.id }} className="flex items-center justify-between rounded-lg border p-2 hover:bg-muted/50">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground font-mono">{t.number}</div>
                  <div className="text-sm font-medium line-clamp-1">{t.title}</div>
                </div>
                <StatusBadge status={t.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">التكليفات المعتمدة — آخر 7 أيام</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="m" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="done" stroke="var(--color-primary)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">التوزيع حسب الحالة</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={80}>
                  {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {byDept.length > 0 && (
        <div className="mt-6">
          <Card>
            <CardHeader><CardTitle className="text-base">التكليفات حسب القسم</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDept}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-bold">أحدث التكليفات</h2>
        <TaskTable tasks={scoped.slice(0, 8)} />
      </div>
    </AppShell>
  );
}
