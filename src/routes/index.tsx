import { createFileRoute } from "@tanstack/react-router";
import OrganizationalCommandCenter from "@/v8/App";

export const Route = createFileRoute("/")({
  component: OrganizationalCommandCenter,
});
