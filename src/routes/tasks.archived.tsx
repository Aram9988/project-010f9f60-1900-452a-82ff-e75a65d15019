import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { useAppStore, useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { hasPermission, scopeTasks } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";
import { TaskTable } from "@/components/task/TaskTable";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const Route = createFileRoute("/tasks/archived")({
  head: () => ({ meta: [{ title: "التكليفات المؤرشفة — منظومة التكليفات" }] }),
  component: ArchivedTasks,
});

function ArchivedTasks() {
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const tasks = useAppStore((s) => s.tasks);
  const [q, setQ] = useState("");
  if (!user || !hasPermission(user, "view_archived_tasks")) return <AccessDenied />;
  const list = useMemo(() => {
    const scoped = scopeTasks(user, tasks.filter((t) => t.archived));
    if (!q.trim()) return scoped;
    const s = q.trim();
    return scoped.filter((t) => t.title.includes(s) || t.number.includes(s) || (t.archiveReason ?? "").includes(s));
  }, [user, tasks, q]);
  return (
    <AppShell>
      <PageHeader title="التكليفات المؤرشفة" subtitle="التكليفات المحفوظة مع كامل سجل تنفيذها. يمكنك استعادتها من صفحة التكليف." />
      <div className="mb-4 relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في العنوان، الرقم، أو سبب الأرشفة…" className="pr-9" />
      </div>
      <TaskTable tasks={list} />
    </AppShell>
  );
}
