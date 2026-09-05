import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TaskTable } from "@/components/task/TaskTable";
import { useAppStore, useSession } from "@/lib/store";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/types";
import { Archive, Filter, Plus, Search } from "lucide-react";
import { getUser } from "@/services/userService";
import { scopeTasks, scopedDepartments, hasPermission } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";

export const Route = createFileRoute("/tasks/")({
  head: () => ({ meta: [{ title: "التكليفات — منظومة التكليفات" }] }),
  component: TasksPage,
});

type QuickFilter = "all" | "new" | "working" | "submitted" | "attention" | "completed" | "mine";

function TasksPage() {
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const allTasks = useAppStore((s) => s.tasks);
  const allDepts = useAppStore((s) => s.departments);
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [deptId, setDeptId] = useState("");

  if (!user || (!hasPermission(user, "view_all_tasks") && !hasPermission(user, "view_department_tasks"))) {
    return <AccessDenied />;
  }

  const scopedDeptIds = scopedDepartments(user);
  const depts = scopedDeptIds
    ? allDepts.filter((d) => scopedDeptIds.includes(d.id) && !d.archived)
    : allDepts.filter((d) => !d.archived);
  const canCreate = hasPermission(user, "create_task");
  const canArchive = hasPermission(user, "view_archived_tasks");
  const showDeptFilter = depts.length > 1;

  const filtered = useMemo(() => {
    let list = scopeTasks(user, allTasks.filter((t) => !t.archived));

    if (quick === "new") list = list.filter((t) => t.status === "new");
    if (quick === "working") list = list.filter((t) => ["received", "in_progress", "waiting_info", "blocked", "returned"].includes(t.status));
    if (quick === "submitted") list = list.filter((t) => t.status === "submitted");
    if (quick === "attention") list = list.filter((t) => ["waiting_info", "blocked", "returned"].includes(t.status));
    if (quick === "completed") list = list.filter((t) => t.status === "approved");
    if (quick === "mine") list = list.filter((t) => t.assigneeId === uid || t.deptHeadId === uid || t.participantIds.includes(uid));

    if (status) list = list.filter((t) => t.status === status);
    if (priority) list = list.filter((t) => t.priority === priority);
    if (deptId) list = list.filter((t) => t.departmentId === deptId);

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((t) =>
        t.title.toLowerCase().includes(s) ||
        t.number.toLowerCase().includes(s) ||
        t.description.toLowerCase().includes(s),
      );
    }

    return [...list].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }, [user, allTasks, quick, status, priority, deptId, q, uid]);

  const quickFilters: { id: QuickFilter; label: string }[] = [
    { id: "all", label: "الكل" },
    { id: "new", label: "جديد" },
    { id: "working", label: "قيد التنفيذ" },
    { id: "submitted", label: "بانتظار الاعتماد" },
    { id: "attention", label: "تحتاج متابعة" },
    { id: "completed", label: "مكتمل" },
    { id: "mine", label: "مهامي" },
  ];

  return (
    <AppShell>
      <PageHeader
        title="التكليفات"
        subtitle="كل ما تحتاجه للمتابعة اليومية في مكان واحد"
        breadcrumbs={[{ to: "/dashboard", label: "الرئيسية" }, { label: "التكليفات" }]}
        actions={
          <div className="flex gap-2">
            {canArchive && (
              <Button variant="outline" asChild>
                <Link to="/tasks/archived"><Archive className="h-4 w-4 me-1" /> المؤرشفات</Link>
              </Button>
            )}
            {canCreate && (
              <Button asChild><Link to="/tasks/new"><Plus className="h-4 w-4 me-1" /> تكليف جديد</Link></Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالرقم أو العنوان…" className="h-11 pr-9" />
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-11"><Filter className="h-4 w-4 me-1" /> تصفية</Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-full sm:max-w-sm">
            <SheetHeader><SheetTitle>تصفية التكليفات</SheetTitle></SheetHeader>
            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <div className="text-sm font-medium">الحالة</div>
                <Select value={status || "__all"} onValueChange={(v) => setStatus(v === "__all" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">كل الحالات</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">الأولوية</div>
                <Select value={priority || "__all"} onValueChange={(v) => setPriority(v === "__all" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">كل الأولويات</SelectItem>
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {showDeptFilter && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">القسم</div>
                  <Select value={deptId || "__all"} onValueChange={(v) => setDeptId(v === "__all" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">كل الأقسام</SelectItem>
                      {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => { setStatus(""); setPriority(""); setDeptId(""); }}
              >
                مسح التصفية
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {quickFilters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setQuick(f.id)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              quick === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <TaskTable tasks={filtered} />
    </AppShell>
  );
}
