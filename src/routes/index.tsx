import { createFileRoute } from "@tanstack/react-router";
import ModernCommandCenter from "@/v3/App";

export const Route = createFileRoute("/")({
  component: ModernCommandCenter,
});
