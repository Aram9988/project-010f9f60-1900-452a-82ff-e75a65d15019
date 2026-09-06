import { createFileRoute } from "@tanstack/react-router";
import ProjectsTasksCenter from "@/v5/App";

export const Route = createFileRoute("/")({
  component: ProjectsTasksCenter,
});
