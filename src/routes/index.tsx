import { createFileRoute } from "@tanstack/react-router";
import SyncGate from "@/v8/SyncGate";

export const Route = createFileRoute("/")({
  component: SyncGate,
});
