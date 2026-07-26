import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { useAppStore, useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { TaskTable } from "@/components/task/TaskTable";
import { canAccessTask } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";

export const Route = createFileRoute("/tasks/mine")({
  head: () => ({ meta: [{ title: "تكليفاتي — منظومة التكليفات" }] }),
  component: MyTasks,
});

function MyTasks() {
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid);
  const all = useAppStore((s) => s.tasks);
  if (!user) return <AccessDenied />;
  const mine = all.filter((t) => !t.archived && (t.assigneeId === uid || t.deptHeadId === uid || t.participantIds.includes(uid) || t.issuedById === uid) && canAccessTask(user, t));
  return (
    <AppShell>
      <PageHeader title="تكليفاتي" subtitle="التكليفات المسندة إليك أو المشارك بها" />
      <TaskTable tasks={mine} />
    </AppShell>
  );
}
