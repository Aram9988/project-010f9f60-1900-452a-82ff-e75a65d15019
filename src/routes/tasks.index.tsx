import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TaskTable } from "@/components/task/TaskTable";
import { TaskCard } from "@/components/task/TaskCard";
import { useAppStore, useSession } from "@/lib/store";
import { STATUS_LABELS, PRIORITY_LABELS, type TaskStatus } from "@/lib/types";
import { Plus, Search } from "lucide-react";
import { getUser } from "@/services/userService";
import { scopeTasks, scopedDepartments, hasPermission } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";

export const Route = createFileRoute("/tasks/")({
  head: () => ({ meta: [{ title: "جميع التكليفات — منظومة التكليفات" }] }),
  component: TasksPage,
});

function TasksPage() {
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const allTasks = useAppStore((s) => s.tasks);
  const allDepts = useAppStore((s) => s.departments);
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState("all");
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [deptId, setDeptId] = useState<string>("");

  if (!user || (!hasPermission(user,"view_all_tasks") && !hasPermission(user,"view_department_tasks"))) return <AccessDenied />;

  const scopedDeptIds = scopedDepartments(user);
  const depts = scopedDeptIds ? allDepts.filter((d) => scopedDeptIds.includes(d.id)) : allDepts;
  const canCreate = hasPermission(user, "create_task");

  const filtered = useMemo(() => {
    let list = scopeTasks(user, allTasks.filter((t) => !t.archived));
    if (saved === "critical") list = list.filter((t) => t.priority === "critical");
    if (saved === "await-ack") list = list.filter((t) => t.status === "new");
    if (saved === "await-approval") list = list.filter((t) => t.status === "submitted");
    if (saved === "returned") list = list.filter((t) => t.status === "returned");
    if (saved === "needs-attention") list = list.filter((t) => ["waiting_info","blocked","returned"].includes(t.status));
    if (status) list = list.filter((t) => t.status === status);
    if (priority) list = list.filter((t) => t.priority === priority);
    if (deptId) list = list.filter((t) => t.departmentId === deptId);
    if (q.trim()) {
      const s = q.trim();
      list = list.filter((t) => t.title.includes(s) || t.number.includes(s) || t.description.includes(s));
    }
    return list;
  }, [user, allTasks, saved, status, priority, deptId, q]);

  const SAVED = [
    { id: "all", label: "الكل" },
    { id: "critical", label: "العاجلة جداً" },
    { id: "await-ack", label: "بانتظار الاستلام" },
    { id: "await-approval", label: "بانتظار الاعتماد" },
    { id: "returned", label: "المعادة للتعديل" },
    { id: "needs-attention", label: "تحتاج متابعة" },
  ];

  return (
    <AppShell>
      <PageHeader
        title="جميع التكليفات"
        subtitle="التكليفات النشطة المصرح لك بعرضها"
        breadcrumbs={[{ to: "/dashboard", label: "الرئيسية" }, { label: "التكليفات" }]}
        actions={canCreate ? <Button asChild><Link to="/tasks/new"><Plus className="h-4 w-4 me-1" /> تكليف جديد</Link></Button> : undefined}
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
      </Tabs>
    </AppShell>
  );
}
