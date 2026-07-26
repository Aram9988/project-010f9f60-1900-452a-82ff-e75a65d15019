import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { userService } from "@/services/userService";
import { departmentService, getDepartment } from "@/services/departmentService";
import { UserAvatar } from "@/components/user-avatar";
import { ROLE_LABELS } from "@/lib/types";
import { KeyRound, Plus, Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "المستخدمون والصلاحيات — منظومة التكليفات" }] }),
  component: UsersPage,
});

function UsersPage() {
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });
  const { data: depts = [] } = useQuery({ queryKey: ["depts"], queryFn: () => departmentService.list() });

  return (
    <AppShell>
      <PageHeader title="المستخدمون والصلاحيات" subtitle="إدارة الحسابات والأدوار داخل النظام"
        actions={
          <Dialog>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-1" /> مستخدم جديد</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>إضافة مستخدم</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-1"><Label>الاسم الكامل</Label><Input /></div>
                <div className="space-y-1"><Label>اسم المستخدم</Label><Input /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>الدور</Label>
                    <Select><SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger><SelectContent>{Object.entries(ROLE_LABELS).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div className="space-y-1"><Label>القسم</Label>
                    <Select><SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger><SelectContent>{depts.map(d=><SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
                  </div>
                </div>
                <Button onClick={() => toast.success("سيتم إنشاء الحساب في النسخة النهائية")}>حفظ</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-right text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">الاسم</th><th className="p-3 font-medium">اسم المستخدم</th>
                <th className="p-3 font-medium">الدور</th><th className="p-3 font-medium">القسم</th>
                <th className="p-3 font-medium">الحالة</th><th className="p-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-muted/30">
                  <td className="p-3"><div className="flex items-center gap-2"><UserAvatar user={u} size={30} /><span className="font-medium">{u.name}</span></div></td>
                  <td className="p-3 font-mono text-xs">{u.username}</td>
                  <td className="p-3">{ROLE_LABELS[u.role]}</td>
                  <td className="p-3">{u.departmentId ? getDepartment(u.departmentId)?.short : "—"}</td>
                  <td className="p-3"><Badge variant="outline" className="bg-success/10 text-success-foreground border-success/30">نشط</Badge></td>
                  <td className="p-3"><Button size="sm" variant="ghost" onClick={() => toast.success("تم إرسال رابط إعادة التعيين (تجريبي)")}><KeyRound className="h-3.5 w-3.5 me-1" /> إعادة كلمة المرور</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-bold flex items-center gap-2"><Shield className="h-5 w-5" /> مصفوفة الصلاحيات</h2>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-right text-xs text-muted-foreground">
            <tr><th className="p-3">الصلاحية</th>{Object.values(ROLE_LABELS).map((r) => <th key={r} className="p-3 text-center">{r}</th>)}</tr>
          </thead>
          <tbody>
            {[
              { p: "إنشاء تكليف", r: [true, true, true, true, false, false] },
              { p: "اعتماد التكليف", r: [true, true, false, false, false, false] },
              { p: "إسناد للأقسام", r: [true, true, true, false, false, false] },
              { p: "إصدار توجيه رسمي", r: [true, true, false, false, false, false] },
              { p: "تأكيد استلام توجيه", r: [false, false, false, true, false, false] },
              { p: "رفع المرفقات", r: [true, true, true, true, true, false] },
              { p: "إدارة المستخدمين", r: [false, false, false, false, false, true] },
              { p: "الاطلاع على التكليفات السرية", r: [true, true, false, true, false, false] },
            ].map((row) => (
              <tr key={row.p} className="border-t"><td className="p-3 font-medium">{row.p}</td>
                {row.r.map((v, i) => <td key={i} className="p-3 text-center">{v ? "✓" : "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </AppShell>
  );
}