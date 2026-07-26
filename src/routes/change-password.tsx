import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAppStore, useSession } from "@/lib/store";
import { toast } from "sonner";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/change-password")({
  head: () => ({ meta: [{ title: "تغيير كلمة المرور — منظومة التكليفات" }] }),
  component: ChangePassword,
});

function ChangePassword() {
  const nav = useNavigate();
  const uid = useSession((s) => s.currentUserId);
  const req = useAppStore((s) => s.passwordRequests.find((r) => r.userId === uid && r.status === "pending"));
  const resolve = useAppStore((s) => s.resolvePasswordChange);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return toast.error("كلمة المرور يجب ألا تقل عن 10 أحرف");
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return toast.error("يجب أن تحوي أحرفاً وأرقاماً");
    if (pw !== pw2) return toast.error("كلمتا المرور غير متطابقتين");
    if (req) resolve(req.id, uid);
    setPw(""); setPw2("");
    toast.success("تم تغيير كلمة المرور بنجاح");
    nav({ to: "/profile" });
  }

  return (
    <AppShell>
      <PageHeader title="تغيير كلمة المرور" subtitle="صفحة آمنة — لا تُخزّن كلمات المرور في السجلات أو الإشعارات" />
      {!req ? (
        <Card className="max-w-md">
          <CardContent className="p-6 text-sm space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-4 w-4" /> لا يوجد طلب تغيير كلمة مرور فعّال لحسابك.
            </div>
            <p className="text-xs text-muted-foreground">
              لا يمكن تغيير كلمة المرور إلا بعد أن يفتح مدير النظام طلباً لك. توجّه إلى ملفك الشخصي.
            </p>
            <Button asChild variant="outline"><Link to="/profile">العودة للملف الشخصي</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-md">
          <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-4">
              <div className="rounded-md border border-gold/40 bg-gold/10 p-2 text-xs">
                طلب رسمي من مدير النظام بتاريخ {new Date(req.createdAt).toLocaleDateString("ar-EG")}.
              </div>
              <div><Label>كلمة المرور الجديدة</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
              <div><Label>تأكيد كلمة المرور</Label><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div>
              <p className="text-[11px] text-muted-foreground">هذه واجهة تجريبية — سياسة كلمات المرور الفعلية وتشفيرها والجلسات ستفعّل مع الخادم الداخلي.</p>
              <Button type="submit" className="w-full">حفظ كلمة المرور</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
