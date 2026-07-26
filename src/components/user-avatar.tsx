import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

export function UserAvatar({ user, size = 32, className }: { user?: User; size?: number; className?: string }) {
  const initials = user?.name?.split(" ").slice(-2).map((w) => w[0]).join("") || "؟";
  return (
    <div
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold", className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={user?.name}
    >
      {initials}
    </div>
  );
}