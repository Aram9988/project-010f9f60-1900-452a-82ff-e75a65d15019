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

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول — منظومة إدارة التكليفات" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const setUser = useSession((s) => s.setCurrentUser);
  const [username, setUsername] = useState("boss");
  const [password, setPassword] = useState("••••••••");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const u = await authService.login(username, password);
    if (u) { setUser(u.id); toast.success("مرحباً بك"); nav({ to: "/dashboard" }); }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between bg-primary text-primary-foreground p-10">
        <div>
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary-foreground/15 font-black text-xl">و.د</div>
          <div className="mt-6">
            <div className="text-sm opacity-90">وزارة الداخلية</div>
            <div className="text-lg font-bold">قيادة الأمن الداخلي</div>
            <div className="text-sm mt-1 opacity-80">فرع اتصالات ريف دمشق</div>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-black leading-snug">منظومة إدارة ومتابعة التكليفات</h2>
          <p className="mt-3 text-sm opacity-90 max-w-md leading-7">
            نظام داخلي رسمي لتسجيل التكليفات ومتابعة تنفيذها بشفافية ومسؤولية،
            من الإصدار وحتى الاعتماد النهائي.
          </p>
          <div className="mt-8 flex items-center gap-2 text-xs opacity-80">
            <ShieldCheck className="h-4 w-4" /> نظام داخلي مؤمّن — الوصول عبر شبكة الجهة فقط
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-2xl font-black">تسجيل الدخول</h1>
            <p className="text-sm text-muted-foreground mt-1">أدخل بيانات حسابك المخصص من إدارة النظام.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="u">اسم المستخدم</Label>
            <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="مثال: boss" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p">كلمة المرور</Label>
            <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="r" defaultChecked />
            <Label htmlFor="r" className="text-sm cursor-pointer">تذكرني على هذا الجهاز</Label>
          </div>
          <Button type="submit" className="w-full h-11 text-base">دخول</Button>
          <p className="text-[11px] text-muted-foreground text-center">
            لا يتوفر التسجيل الذاتي. تُنشأ الحسابات من قِبل مدير النظام.
          </p>
          <div className="rounded-md bg-muted p-3 text-[11px] text-muted-foreground">
            نموذج تجريبي — يمكنك استخدام: <code>boss</code>, <code>associate</code>, <code>office</code>, <code>head1</code>–<code>head4</code>, <code>emp1</code>–<code>emp4</code>, <code>admin</code>
          </div>
        </form>
      </div>
    </div>
  );
}