import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { taskService, tasksForUser } from "@/services/taskService";
import { useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { TaskTable } from "@/components/task/TaskTable";

export const Route = createFileRoute("/tasks/mine")({
  head: () => ({ meta: [{ title: "تكليفاتي — منظومة التكليفات" }] }),
  component: MyTasks,
});

function MyTasks() {
  const uid = useSession((s) => s.currentUserId);
  const user = getUser(uid)!;
  useQuery({ queryKey: ["tasks"], queryFn: () => taskService.list() });
  const tasks = tasksForUser(uid, user.role);
  return (
    <AppShell>
      <PageHeader title="تكليفاتي" subtitle="التكليفات المسندة إليك أو المشارك بها" />
      <TaskTable tasks={tasks} />
    </AppShell>
  );
}