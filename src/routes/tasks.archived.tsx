import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { useAppStore, useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { hasPermission, scopeTasks } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";
import { TaskTable } from "@/components/task/TaskTable";

export const Route = createFileRoute("/tasks/archived")({
  head: () => ({ meta: [{ title: "التكليفات المؤرشفة — منظومة التكليفات" }] }),
  component: ArchivedTasks,
});

function ArchivedTasks() {
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const tasks = useAppStore((s) => s.tasks);
  if (!user || !hasPermission(user, "view_archived_tasks")) return <AccessDenied />;
  const list = scopeTasks(user, tasks.filter((t) => t.archived));
  return (
    <AppShell>
      <PageHeader title="التكليفات المؤرشفة" subtitle="التكليفات المحفوظة مع كامل سجل تنفيذها" />
      <TaskTable tasks={list} />
    </AppShell>
  );
}
