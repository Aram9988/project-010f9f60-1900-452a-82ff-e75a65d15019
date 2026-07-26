import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAppStore } from "@/lib/store";
import { getUser } from "@/services/userService";
import { hasPermission } from "@/lib/authz";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // client-only routing decision on next render — safe simple redirect to dashboard
    const uid = useAppStore.getState().currentUserId;
    const user = getUser(uid);
    if (user && !hasPermission(user, "view_all_tasks") && !hasPermission(user, "view_department_tasks")) {
      if (hasPermission(user, "view_reports")) throw redirect({ to: "/reports" });
      throw redirect({ to: "/profile" });
    }
    throw redirect({ to: "/dashboard" });
  },
});
