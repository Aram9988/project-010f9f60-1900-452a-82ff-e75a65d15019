import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAppStore, useSession } from "@/lib/store";
import { toast } from "sonner";

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
    if (pw !== pw2) return toast.error("كلمتا المرور غير متطابقتين");
    if (req) resolve(req.id, uid);
    setPw(""); setPw2("");
    toast.success("تم تغيير كلمة المرور بنجاح");
    nav({ to: "/profile" });
  }

  return (
    <AppShell>
      <PageHeader title="تغيير كلمة المرور" subtitle="صفحة آمنة — لا تُخزّن كلمات المرور في السجلات أو الإشعارات" />
      <Card className="max-w-md">
        <CardContent className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div><Label>كلمة المرور الجديدة</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
            <div><Label>تأكيد كلمة المرور</Label><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div>
            <Button type="submit" className="w-full">حفظ كلمة المرور</Button>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
