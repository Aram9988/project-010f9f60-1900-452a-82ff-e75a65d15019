import { createFileRoute } from "@tanstack/react-router";
import OperationalCenter from "@/v7/App";

export const Route = createFileRoute("/")({
  component: OperationalCenter,
});
