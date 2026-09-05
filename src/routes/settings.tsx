import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, RotateCcw } from "lucide-react";
import { useAppStore, useSession } from "@/lib/store";
import { getUser } from "@/services/userService";
import { hasPermission } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — منظومة التكليفات" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const user = getUser(useSession((s) => s.currentUserId));
  const resetDemo = useAppStore((s) => s.resetDemo);
  if (!user || !hasPermission(user, "manage_permissions")) return <AccessDenied />;

  return (
    <AppShell>
      <PageHeader title="إعدادات النموذج" subtitle="خيارات تجريبية للواجهة — لا تمثل إعدادات أمان إنتاجية" />

      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6">
        <ShieldCheck className="inline h-4 w-4 me-1" />
        هذه نسخة عرض عامة. إعدادات كلمات المرور والجلسة والنسخ الاحتياطي أدناه محاكاة للواجهة فقط، ولا توفر حماية حقيقية دون Backend ومصادقة من جهة الخادم.
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">الجلسة وكلمات المرور — تجريبي</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between"><Label>مهلة انتهاء الجلسة (دقيقة)</Label><Input type="number" defaultValue={30} className="w-24" /></div>
            <div className="flex items-center justify-between"><Label>الحد الأدنى لكلمة المرور</Label><Input type="number" defaultValue={10} className="w-24" /></div>
            <div className="flex items-center justify-between"><Label>تفعيل المصادقة الثنائية (تصور واجهة)</Label><Switch /></div>
            <div className="flex items-center justify-between"><Label>سياسة تغيير كلمة المرور</Label>
              <Select defaultValue="90"><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30">30 يوم</SelectItem><SelectItem value="60">60 يوم</SelectItem><SelectItem value="90">90 يوم</SelectItem></SelectContent></Select>
            </div>
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-base">المرفقات — تجريبي</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between"><Label>الحجم الأقصى للمرفق (MB)</Label><Input type="number" defaultValue={25} className="w-24" /></div>
            <div className="space-y-2"><Label>الأنواع المسموحة</Label>
              <div className="flex flex-wrap gap-2 text-xs">
                {["PDF","Word","Excel","صور","رسومات هندسية"].map((t) => <span key={t} className="rounded-full border px-2 py-0.5">{t}</span>)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-base">التدقيق والنسخ الاحتياطي — تصور مستقبلي</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">التخزين الحالي محلي في المتصفح. النسخة الإنتاجية ستحتاج تخزيناً خاصاً وسياسة نسخ احتياطي فعلية.</p>
            <div className="flex items-center justify-between"><Label>الاحتفاظ بسجل التدقيق</Label>
              <Select defaultValue="1825"><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="365">سنة</SelectItem><SelectItem value="1825">5 سنوات</SelectItem></SelectContent></Select>
            </div>
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-base">حدود النسخة العامة</CardTitle></CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            لا تحفظ بيانات حقيقية أو كلمات مرور أو عناوين شبكية أو وثائق داخلية في هذا النموذج العام. جميع بيانات الاختبار يجب أن تبقى افتراضية.
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-destructive/30">
          <CardHeader><CardTitle className="text-base text-destructive">إعادة تعيين البيانات التجريبية</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">يمسح هذا الإجراء البيانات المخزنة محلياً في المتصفح ويعيد بيانات العرض الافتراضية.</p>
            <Button variant="destructive" onClick={() => {
              if (!confirm("سيتم مسح جميع التغييرات المحلية. متابعة؟")) return;
              resetDemo(); toast.success("تمت إعادة التهيئة");
            }}><RotateCcw className="h-4 w-4 me-1" /> إعادة التهيئة</Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
