import { createFileRoute } from "@tanstack/react-router";
import OperationalCenter from "@/v6/App";

export const Route = createFileRoute("/")({
  component: OperationalCenter,
});
