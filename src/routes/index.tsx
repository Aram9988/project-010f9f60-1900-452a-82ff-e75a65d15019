import { createFileRoute } from "@tanstack/react-router";
import CommandCenterApp from "@/v2/App";

export const Route = createFileRoute("/")({
  component: CommandCenterApp,
});
