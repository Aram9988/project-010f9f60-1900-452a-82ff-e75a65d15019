import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TaskTable } from "@/components/task/TaskTable";
import { TaskCard } from "@/components/task/TaskCard";
import { taskService } from "@/services/taskService";
import { departmentService } from "@/services/departmentService";
import { STATUS_LABELS, PRIORITY_LABELS, type TaskStatus, type TaskPriority } from "@/lib/types";
import { Link } from "@tanstack/react-router";
import { Plus, Search, Filter } from "lucide-react";
import { isOverdue, fmtDate } from "@/lib/format";

const SAVED = [
  { id: "all", label: "الكل" },
  { id: "mine-today", label: "تكليفات اليوم" },
  { id: "overdue", label: "المتأخرة" },
  { id: "critical", label: "العاجلة جداً" },
  { id: "await-ack", label: "بانتظار الاستلام" },
  { id: "await-approval", label: "بانتظار اعتماد المدير" },
  { id: "returned", label: "المعادة للتعديل" },
];

export const Route = createFileRoute("/tasks/")({
  head: () => ({ meta: [{ title: "جميع التكليفات — منظومة التكليفات" }] }),
  component: TasksPage,
});

function TasksPage() {
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: () => taskService.list() });
  const { data: depts = [] } = useQuery({ queryKey: ["depts"], queryFn: () => departmentService.list() });
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState("all");
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [deptId, setDeptId] = useState<string>("");

  const filtered = useMemo(() => {
    let list = tasks;
    if (saved === "overdue") list = list.filter((t) => isOverdue(t.dueAt, t.status));
    if (saved === "critical") list = list.filter((t) => t.priority === "critical");
    if (saved === "await-ack") list = list.filter((t) => t.status === "new");
    if (saved === "await-approval") list = list.filter((t) => t.status === "submitted");
    if (saved === "returned") list = list.filter((t) => t.status === "returned");
    if (status) list = list.filter((t) => t.status === status);
    if (priority) list = list.filter((t) => t.priority === priority);
    if (deptId) list = list.filter((t) => t.departmentId === deptId);
    if (q.trim()) {
      const s = q.trim();
      list = list.filter((t) => t.title.includes(s) || t.number.includes(s) || t.description.includes(s));
    }
    return list.sort((a, b) => (a.priority === "critical" ? -1 : 0) - (b.priority === "critical" ? -1 : 0));
  }, [tasks, saved, status, priority, deptId, q]);

  return (
    <AppShell>
      <PageHeader
        title="جميع التكليفات"
        subtitle="جميع التكليفات النشطة والمؤرشفة"
        breadcrumbs={[{ to: "/dashboard", label: "الرئيسية" }, { label: "التكليفات" }]}
        actions={<Button asChild><Link to="/tasks/new"><Plus className="h-4 w-4 me-1" /> تكليف جديد</Link></Button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {SAVED.map((s) => (
          <button key={s.id} onClick={() => setSaved(s.id)}
            className={`rounded-full border px-3 py-1 text-xs ${saved === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"}`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…" className="pr-9" />
        </div>
        <Select value={status || "__all"} onValueChange={(v) => setStatus(v === "__all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">كل الحالات</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority || "__all"} onValueChange={(v) => setPriority(v === "__all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الأولوية" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">كل الأولويات</SelectItem>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={deptId || "__all"} onValueChange={(v) => setDeptId(v === "__all" ? "" : v)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="القسم" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">كل الأقسام</SelectItem>
            {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">قائمة</TabsTrigger>
          <TabsTrigger value="board">لوحة</TabsTrigger>
          <TabsTrigger value="calendar">تقويم</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-4">
          <TaskTable tasks={filtered} />
        </TabsContent>
        <TabsContent value="board" className="mt-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {(["new","received","in_progress","submitted"] as TaskStatus[]).map((s) => (
              <div key={s} className="rounded-xl bg-muted/40 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-bold text-sm">{STATUS_LABELS[s]}</span>
                  <Badge variant="outline">{filtered.filter((t) => t.status === s).length}</Badge>
                </div>
                <div className="space-y-2">
                  {filtered.filter((t) => t.status === s).map((t) => <TaskCard key={t.id} task={t} />)}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="calendar" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="space-y-2">
              {filtered.map((t) => (
                <Link key={t.id} to="/tasks/$taskId" params={{taskId: t.id}} className="flex items-center justify-between rounded-lg border p-2 hover:bg-muted/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-14 place-items-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                      {fmtDate(t.dueAt)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground font-mono">{t.number}</div>
                      <div className="font-medium line-clamp-1">{t.title}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}