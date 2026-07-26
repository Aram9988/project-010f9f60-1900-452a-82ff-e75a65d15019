import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAppStore } from "@/lib/store";
import { getUser } from "@/services/userService";
import { firstAllowedRoute } from "@/lib/nav";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const uid = useAppStore.getState().currentUserId;
    const user = getUser(uid);
    throw redirect({ to: firstAllowedRoute(user) });
  },
});
