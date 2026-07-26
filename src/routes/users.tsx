import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAppStore, useSession } from "@/lib/store";
import { UserAvatar } from "@/components/user-avatar";
import { ROLE_LABELS, PERMISSION_LABELS, ALL_PERMISSIONS, type Role, type Permission, type User } from "@/lib/types";
import { getUser } from "@/services/userService";
import { getDepartment } from "@/services/departmentService";
import { hasPermission } from "@/lib/authz";
import { AccessDenied } from "@/components/access-denied";
import { KeyRound, Plus, Shield, Pencil, Archive } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "المستخدمون والصلاحيات — منظومة التكليفات" }] }),
  component: UsersPage,
});

function UsersPage() {
  const currentUser = getUser(useSession((s) => s.currentUserId));
  const users = useAppStore((s) => s.users);
  const depts = useAppStore((s) => s.departments);
  const rolePerms = useAppStore((s) => s.rolePermissions);
  const createUser = useAppStore((s) => s.createUser);
  const updateUser = useAppStore((s) => s.updateUser);
  const archiveUser = useAppStore((s) => s.archiveUser);
  const setUserActive = useAppStore((s) => s.setUserActive);
  const setRolePermissions = useAppStore((s) => s.setRolePermissions);
  const resetPermissionsToDefaults = useAppStore((s) => s.resetPermissionsToDefaults);
  const requestPasswordChange = useAppStore((s) => s.requestPasswordChange);

  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);

  if (!currentUser || !hasPermission(currentUser, "manage_users")) return <AccessDenied />;
  const canManagePerms = hasPermission(currentUser, "manage_permissions");

  const ROLES: Role[] = ["boss","associate","office","dept_head","employee","diwan","admin"];

  return (
    <AppShell>
      <PageHeader
        title="المستخدمون والصلاحيات"
        subtitle="إدارة الحسابات والأدوار وطلبات تغيير كلمة المرور"
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 me-1" /> مستخدم جديد</Button>}
      />

      <Card className="mb-6">
        <CardContent className="p-0 overflow-x-auto">
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
                <tr key={u.id} className={"border-t hover:bg-muted/30 " + (u.archived ? "opacity-50" : "")}>
                  <td className="p-3"><div className="flex items-center gap-2"><UserAvatar user={u} size={30} /><span className="font-medium">{u.name}</span></div></td>
                  <td className="p-3 font-mono text-xs">{u.username}</td>
                  <td className="p-3">{ROLE_LABELS[u.role]}</td>
                  <td className="p-3">{u.departmentId ? getDepartment(u.departmentId)?.short : "—"}</td>
                  <td className="p-3">
                    {u.archived ? <Badge variant="outline">مؤرشف</Badge>
                    : u.active === false ? <Badge variant="outline" className="bg-warning/15 text-warning-foreground">معطّل</Badge>
                    : <Badge variant="outline" className="bg-success/15 text-success border-success/30">نشط</Badge>}
                  </td>
                  <td className="p-3 flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(u)}><Pencil className="h-3.5 w-3.5 me-1" /> تعديل</Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (!confirm(`طلب تغيير كلمة المرور للمستخدم ${u.name}؟`)) return;
                      requestPasswordChange(u.id, currentUser.id);
                      toast.success("تم إرسال طلب تغيير كلمة المرور للمستخدم");
                    }}><KeyRound className="h-3.5 w-3.5 me-1" /> طلب تغيير كلمة المرور</Button>
                    <Button size="sm" variant="ghost" onClick={() => setUserActive(u.id, !(u.active !== false))}>
                      {u.active === false ? "تفعيل" : "تعطيل"}
                    </Button>
                    {!u.archived && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("أرشفة الحساب؟")) archiveUser(u.id); }}>
                        <Archive className="h-3.5 w-3.5 me-1" /> أرشفة
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> مصفوفة الصلاحيات</CardTitle>
          {canManagePerms && (
            <Button variant="outline" size="sm" onClick={() => {
              if (confirm("استعادة الصلاحيات إلى الإعدادات الافتراضية؟")) { resetPermissionsToDefaults(); toast.success("تمت الاستعادة"); }
            }}>استعادة الافتراضي</Button>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-right text-xs text-muted-foreground">
              <tr><th className="p-3">الصلاحية</th>{ROLES.map((r) => <th key={r} className="p-3 text-center">{ROLE_LABELS[r]}</th>)}</tr>
            </thead>
            <tbody>
              {ALL_PERMISSIONS.map((perm) => (
                <tr key={perm} className="border-t">
                  <td className="p-3 font-medium">{PERMISSION_LABELS[perm]}</td>
                  {ROLES.map((r) => {
                    const enabled = (rolePerms[r] || []).includes(perm);
                    const isAdminPermsGuard = r === "admin" && perm === "manage_permissions";
                    return (
                      <td key={r} className="p-2 text-center">
                        <Switch
                          checked={enabled}
                          disabled={!canManagePerms || isAdminPermsGuard}
                          onCheckedChange={(v) => {
                            const cur = rolePerms[r] || [];
                            const next = v ? Array.from(new Set([...cur, perm])) : cur.filter((p) => p !== perm);
                            setRolePermissions(r, next as Permission[]);
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <UserDialog
        open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }}
        initial={editing || undefined}
        depts={depts}
        onSave={(u) => {
          if (editing) { updateUser(editing.id, u); toast.success("تم حفظ التعديلات"); }
          else { createUser({ ...u, active: true, avatarColor: "bg-primary" } as any); toast.success("تم إنشاء الحساب"); }
        }}
      />
    </AppShell>
  );
}

function UserDialog({ open, onClose, initial, depts, onSave }: {
  open: boolean; onClose: () => void; initial?: User;
  depts: { id: string; name: string }[];
  onSave: (u: Partial<User>) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [username, setUsername] = useState(initial?.username || "");
  const [role, setRole] = useState<Role>(initial?.role || "employee");
  const [rank, setRank] = useState(initial?.rank || "");
  const [departmentId, setDepartmentId] = useState(initial?.departmentId || "");

  function submit() {
    if (!name.trim() || !username.trim()) return toast.error("الاسم واسم المستخدم مطلوبان");
    onSave({ name: name.trim(), username: username.trim(), role, rank, departmentId: departmentId || undefined });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "تعديل المستخدم" : "مستخدم جديد"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>الاسم الكامل</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>اسم المستخدم</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>الدور</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>القسم</Label>
              <Select value={departmentId || "__none"} onValueChange={(v) => setDepartmentId(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="لا يوجد" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">لا يوجد</SelectItem>
                  {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>الرتبة</Label><Input value={rank} onChange={(e) => setRank(e.target.value)} placeholder="اختياري" /></div>
        </div>
        <DialogFooter><Button onClick={submit}>حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
