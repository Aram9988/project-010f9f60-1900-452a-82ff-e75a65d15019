import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Network } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — منظومة التكليفات" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell>
      <PageHeader title="إعدادات النظام" subtitle="ضوابط الأمان والاستخدام الداخلي" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">الجلسة وكلمات المرور</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between"><Label>مهلة انتهاء الجلسة (دقيقة)</Label><Input type="number" defaultValue={30} className="w-24" /></div>
            <div className="flex items-center justify-between"><Label>الحد الأدنى لكلمة المرور</Label><Input type="number" defaultValue={10} className="w-24" /></div>
            <div className="flex items-center justify-between"><Label>تفعيل المصادقة الثنائية (2FA)</Label><Switch /></div>
            <div className="flex items-center justify-between"><Label>فرض تغيير كلمة المرور كل</Label>
              <Select defaultValue="90"><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30">30 يوم</SelectItem><SelectItem value="60">60 يوم</SelectItem><SelectItem value="90">90 يوم</SelectItem></SelectContent></Select>
            </div>
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-base">المرفقات</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between"><Label>الحجم الأقصى للمرفق (MB)</Label><Input type="number" defaultValue={25} className="w-24" /></div>
            <div className="space-y-2"><Label>الأنواع المسموحة</Label>
              <div className="flex flex-wrap gap-2 text-xs">
                {["PDF","Word","Excel","صور","رسومات هندسية"].map((t) => <span key={t} className="rounded-full border px-2 py-0.5">{t}</span>)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-base">النسخ الاحتياطي والتدقيق</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span>آخر نسخة احتياطية</span><span className="text-muted-foreground">اليوم — 03:00 صباحاً</span></div>
            <div className="flex items-center justify-between"><Label>الاحتفاظ بسجل التدقيق</Label>
              <Select defaultValue="365"><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="180">180 يوم</SelectItem><SelectItem value="365">سنة</SelectItem><SelectItem value="1825">5 سنوات</SelectItem></SelectContent></Select>
            </div>
            <div className="flex items-center justify-between"><Label>تمكين تكليفات سرية</Label><Switch defaultChecked /></div>
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Network className="h-4 w-4" /> بنية الوصول الداخلي</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs leading-6">
              <ShieldCheck className="inline h-4 w-4 me-1 text-primary" />
              البنية النهائية المعتمدة للوصول:
              <div className="mt-2 font-mono text-[11px] bg-background rounded p-2 border">
                جهاز المستخدم ← MikroTik WireGuard VPN ← الخادم الداخلي ← منظومة إدارة التكليفات
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              يعمل النظام حصراً ضمن الشبكة الداخلية للجهة، ولا يقبل اتصالاً من خارج بوابة VPN المعتمدة.
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}