import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Menu, Moon, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/store";
import { getUser, userService } from "@/services/userService";
import { ROLE_LABELS } from "@/lib/types";
import { UserAvatar } from "@/components/user-avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "@/services/notificationService";
import { fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BrandBlock } from "@/components/logo";

export function TopBar() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const userId = useSession((s) => s.currentUserId);
  const setUser = useSession((s) => s.setCurrentUser);
  const theme = useSession((s) => s.theme);
  const toggleTheme = useSession((s) => s.toggleTheme);
  const toggleSidebar = useSession((s) => s.toggleSidebar);
  const user = getUser(userId);

  const { data: allUsers = [] } = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });
  const { data: notifs = [] } = useQuery({
    queryKey: ["notifs", userId],
    queryFn: () => notificationService.listForUser(userId),
    refetchInterval: 3000,
  });
  const unread = notifs.filter((n) => !n.read).length;

  async function openNotif(n: (typeof notifs)[number]) {
    await notificationService.markRead(n.id);
    qc.invalidateQueries({ queryKey: ["notifs", userId] });
    if (n.taskId) nav({ to: "/tasks/$taskId", params: { taskId: n.taskId } });
    else nav({ to: "/notifications" });
  }

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex h-full items-center gap-3 px-4 md:px-6">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
        <Link to="/dashboard" className="shrink-0"><BrandBlock /></Link>

        <div className="flex-1 mx-2 max-w-xl hidden md:block">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث في التكليفات…" className="pr-9 bg-background"
              onKeyDown={(e) => { if (e.key === "Enter") nav({ to: "/tasks", search: { q: (e.currentTarget as HTMLInputElement).value } as any }); }} />
          </div>
        </div>

        <div className="mr-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <span className="hidden sm:inline text-xs text-muted-foreground">تجريبي · الدور:</span>
                <span className="font-semibold">{user ? ROLE_LABELS[user.role] : "—"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-h-96 overflow-y-auto">
              <DropdownMenuLabel>الدخول كمستخدم آخر (تجريبي)</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allUsers.filter((u) => u.active !== false).map((u) => (
                <DropdownMenuItem key={u.id} onClick={() => { setUser(u.id); qc.invalidateQueries(); }} className="flex-col items-start gap-0">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-xs text-muted-foreground">{ROLE_LABELS[u.role]}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unread}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-0">
              <div className="border-b border-border p-3 flex items-center justify-between">
                <span className="font-semibold">الإشعارات</span>
                <Link to="/notifications" className="text-xs text-primary hover:underline">عرض الكل</Link>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifs.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">لا توجد إشعارات</div>
                )}
                {notifs.slice(0, 8).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openNotif(n)}
                    className={cn("block w-full text-right border-b border-border/50 p-3 hover:bg-muted/50", !n.read && "bg-primary/5")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{n.title}</span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{fmtRelative(n.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" onClick={toggleTheme} title="تبديل السمة">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <UserAvatar user={user} size={30} />
                <span className="hidden md:inline text-sm font-medium">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/profile">الملف الشخصي</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/settings">الإعدادات</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/login">تسجيل الخروج</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
