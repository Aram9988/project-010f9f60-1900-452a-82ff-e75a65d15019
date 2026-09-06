import { createFileRoute } from "@tanstack/react-router";
import CommandCenterV4 from "@/v4/App";

export const Route = createFileRoute("/")({
  component: CommandCenterV4,
});
