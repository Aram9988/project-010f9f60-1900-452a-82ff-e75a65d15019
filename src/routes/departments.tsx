import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { departmentService } from "@/services/departmentService";
import { userService, getUser } from "@/services/userService";
import { taskService } from "@/services/taskService";
import { Building2, Users } from "lucide-react";

export const Route = createFileRoute("/departments")({
  head: () => ({ meta: [{ title: "الأقسام — منظومة التكليفات" }] }),
  component: DeptsPage,
});

function DeptsPage() {
  const { data: depts = [] } = useQuery({ queryKey: ["depts"], queryFn: () => departmentService.list() });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: () => taskService.list() });

  return (
    <AppShell>
      <PageHeader title="الأقسام" subtitle="أقسام فرع اتصالات ريف دمشق" />
      <div className="grid gap-4 md:grid-cols-2">
        {depts.map((d) => {
          const head = getUser(d.headId);
          const members = users.filter((u) => u.departmentId === d.id);
          const deptTasks = tasks.filter((t) => t.departmentId === d.id);
          const open = deptTasks.filter((t) => !["approved", "cancelled", "archived"].includes(t.status)).length;
          return (
            <Card key={d.id}>
              <CardHeader className="flex-row items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div>
                <div><CardTitle className="text-base">{d.name}</CardTitle><div className="text-xs text-muted-foreground">رئيس القسم: {head?.name}</div></div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="rounded-md bg-muted p-2"><div className="text-lg font-bold">{deptTasks.length}</div><div className="text-[10px] text-muted-foreground">إجمالي</div></div>
                  <div className="rounded-md bg-info/10 p-2"><div className="text-lg font-bold text-info">{open}</div><div className="text-[10px] text-muted-foreground">مفتوحة</div></div>
                  <div className="rounded-md bg-success/10 p-2"><div className="text-lg font-bold text-success-foreground">{deptTasks.length - open}</div><div className="text-[10px] text-muted-foreground">منتهية</div></div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3 w-3" /> {members.length} موظف</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}