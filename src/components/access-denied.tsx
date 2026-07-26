import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccessDenied({ message }: { message?: string }) {
  return (
    <AppShell>
      <div className="mx-auto max-w-md text-center py-24">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive">
          <Lock className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-black">غير مصرح بالوصول</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {message || "لا تملك الصلاحية لعرض هذه الصفحة. يرجى مراجعة مدير النظام إذا كنت تحتاج للوصول."}
        </p>
        <Button asChild className="mt-6"><Link to="/profile">العودة إلى الملف الشخصي</Link></Button>
      </div>
    </AppShell>
  );
}
