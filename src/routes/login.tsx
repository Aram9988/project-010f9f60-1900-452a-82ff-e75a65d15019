import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { authService } from "@/services/authService";
import { useSession } from "@/lib/store";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول — منظومة إدارة التكليفات" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const setUser = useSession((s) => s.setCurrentUser);
  const [username, setUsername] = useState("boss");
  const [password, setPassword] = useState("demo");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const u = await authService.login(username, password);
    if (u) {
      setUser(u.id);
      toast.success("مرحباً بك في النسخة التجريبية");
      nav({ to: "/dashboard" });
    } else {
      toast.error("اسم المستخدم التجريبي غير موجود");
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between bg-primary text-primary-foreground p-10">
        <div>
          <Logo size={64} className="bg-primary-foreground/15" showFallbackLetters={false} />
          <div className="mt-6">
            <div className="text-sm opacity-90">نسخة عرض عامة</div>
            <div className="text-lg font-bold">منظومة إدارة ومتابعة التكليفات</div>
            <div className="text-sm mt-1 opacity-80">بيانات افتراضية للتجربة فقط</div>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-black leading-snug">إدارة التكليفات ببساطة</h2>
          <p className="mt-3 text-sm opacity-90 max-w-md leading-7">
            نموذج واجهة لتجربة إنشاء التكليفات، متابعة حالتها، التحديثات، الاعتماد والتقارير.
          </p>
          <div className="mt-8 flex items-center gap-2 text-xs opacity-80">
            <ShieldCheck className="h-4 w-4" /> هذه النسخة العامة لا تحتوي على بيانات تشغيلية حقيقية
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div className="md:hidden flex items-center gap-3">
            <Logo size={44} />
            <div>
              <div className="text-[11px] text-muted-foreground">نسخة عرض عامة</div>
              <div className="text-sm font-bold">منظومة إدارة التكليفات</div>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black">دخول النسخة التجريبية</h1>
            <p className="text-sm text-muted-foreground mt-1">استخدم أحد أسماء المستخدمين التجريبية لاختبار الأدوار.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="u">اسم المستخدم التجريبي</Label>
            <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="boss" autoComplete="off" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p">كلمة مرور تجريبية</Label>
            <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="r" defaultChecked />
            <Label htmlFor="r" className="text-sm cursor-pointer">تذكر المستخدم على هذا الجهاز</Label>
          </div>
          <Button type="submit" className="w-full h-11 text-base">دخول</Button>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-5 text-muted-foreground">
            تنبيه أمني: المصادقة هنا تجريبية وتعمل داخل المتصفح فقط. لا تستخدم بيانات اعتماد أو معلومات حقيقية في هذه النسخة العامة.
          </div>
        </form>
      </div>
    </div>
  );
}
