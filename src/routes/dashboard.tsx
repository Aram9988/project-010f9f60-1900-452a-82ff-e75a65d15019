import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { taskService, tasksForUser } from "@/services/taskService";
import { getDepartment, departmentService } from "@/services/departmentService";
import { TaskTable } from "@/components/task/TaskTable";
import { StatusBadge } from "@/components/badges";
import { isOverdue } from "@/lib/format";
import { STATUS_LABELS, ROLE_LABELS } from "@/lib/types";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, FileCheck2, MessageCircle, ShieldAlert, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "لوحة التحكم — منظومة التكليفات" }, { name: "description", content: "لوحة تحكم رئيسية للتكليفات النشطة والمتأخرة." }] }),
  component: DashboardPage,
});

function Stat({ icon: Icon, label, value, tone = "primary" }: { icon: any; label: string; value: number | string; tone?: "primary" | "gold" | "destructive" | "success" }) {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-gold/15 text-gold-foreground",
    destructive: "bg-destructive/10 text-destructive",
    success: "bg-success/15 text-success-foreground",
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
  const user = getUser(uid)!;
  const { data: allTasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: () => taskService.list() });
  const { data: depts = [] } = useQuery({ queryKey: ["depts"], queryFn: () => departmentService.list() });

  const tasks = tasksForUser(uid, user.role);
  const overdue = tasks.filter((t) => isOverdue(t.dueAt, t.status));
  const critical = tasks.filter((t) => t.priority === "critical");
  const submitted = tasks.filter((t) => t.status === "submitted");
  const newTasks = tasks.filter((t) => t.status === "new");
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const blocked = tasks.filter((t) => t.status === "blocked");
  const returned = tasks.filter((t) => t.status === "returned");

  const byStatus = Object.keys(STATUS_LABELS).map((k) => ({
    name: STATUS_LABELS[k as keyof typeof STATUS_LABELS], value: tasks.filter((t) => t.status === k).length,
  })).filter((x) => x.value > 0);

  const byDept = depts.map((d) => ({ name: d.short, value: allTasks.filter((t) => t.departmentId === d.id).length }));
  const trend = [
    { m: "الأحد", done: 2 }, { m: "الاثنين", done: 4 }, { m: "الثلاثاء", done: 3 },
    { m: "الأربعاء", done: 5 }, { m: "الخميس", done: 4 }, { m: "الجمعة", done: 2 }, { m: "السبت", done: 3 },
  ];
  const COLORS = ["#4b5c86", "#c39a44", "#4a9d6b", "#c34a44", "#4a86c3"];

  return (
    <AppShell>
      <PageHeader
        title={`مرحباً، ${user.name.split(" ").slice(-2).join(" ")}`}
        subtitle={`${ROLE_LABELS[user.role]} — لمحة سريعة عن التكليفات النشطة`}
      />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Stat icon={ClipboardList} label="تكليفات جديدة" value={newTasks.length} />
        <Stat icon={Clock} label="قيد التنفيذ" value={inProgress.length} />
        <Stat icon={AlertTriangle} label="متأخرة" value={overdue.length} tone="destructive" />
        <Stat icon={ShieldAlert} label="عاجل جداً" value={critical.length} tone="destructive" />
        <Stat icon={FileCheck2} label="بانتظار الاعتماد" value={submitted.length} tone="gold" />
        <Stat icon={MessageCircle} label="بانتظار المعلومات" value={tasks.filter(t=>t.status==="waiting_info").length} />
        <Stat icon={CheckCircle2} label="معتمد" value={tasks.filter(t=>t.status==="approved").length} tone="success" />
        <Stat icon={TrendingUp} label="معاد للتعديل" value={returned.length} tone="gold" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">اتجاه الإنجاز الأسبوعي</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="m" fontSize={12} />
                <YAxis fontSize={12} />
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

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">التكليفات حسب القسم</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDept}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--color-primary)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">تحتاج انتباهك</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[...critical, ...overdue, ...blocked].slice(0, 5).map((t) => (
              <a key={t.id} href={`/tasks/${t.id}`} className="flex items-center justify-between rounded-lg border border-border p-2 hover:bg-muted/50">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground font-mono">{t.number}</div>
                  <div className="text-sm font-medium line-clamp-1">{t.title}</div>
                </div>
                <StatusBadge status={t.status} />
              </a>
            ))}
            {[...critical, ...overdue, ...blocked].length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">لا يوجد ما يستدعي انتباهك.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-bold">أحدث التكليفات</h2>
        <TaskTable tasks={tasks.slice(0, 8)} />
      </div>
    </AppShell>
  );
}