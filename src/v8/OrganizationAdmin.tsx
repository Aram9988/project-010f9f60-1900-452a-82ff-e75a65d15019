import { useMemo, useState } from "react";
import { Building2, Pencil, Plus, Save, ShieldCheck, Trash2, UserPlus, UsersRound, X } from "lucide-react";
import type { OrgDepartment, OrgOffice, OrgRole, OrgState, OrgUser, PermissionKey } from "./orgModel";

const permissionLabels: Record<PermissionKey, string> = {
  manage_structure: "إدارة الهيكل",
  manage_users: "إدارة المستخدمين",
  manage_roles: "إدارة الأدوار",
  view_all_tree: "عرض كامل الشجرة",
  view_team_tree: "عرض شجرة الفريق",
  create_projects: "إنشاء مشاريع",
  create_tasks: "إنشاء مهام",
  assign_department_tasks: "إسناد مهام للأقسام",
  assign_team_tasks: "إسناد مهام للفريق",
  approve_work: "اعتماد وإنهاء الأعمال",
  view_reports: "عرض التقارير",
};

const allPermissions = Object.keys(permissionLabels) as PermissionKey[];
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export default function OrganizationAdmin({ state, onChange }: { state: OrgState; onChange: (next: OrgState) => void }) {
  const [tab, setTab] = useState<"users" | "roles" | "departments" | "offices">("users");
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null);
  const [editingRole, setEditingRole] = useState<OrgRole | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<OrgDepartment | null>(null);
  const [editingOffice, setEditingOffice] = useState<OrgOffice | null>(null);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] tracking-[.2em] text-cyan-300/50">ORGANIZATION ADMIN</div>
          <h1 className="mt-2 text-2xl font-black">إدارة الهيكل والصلاحيات</h1>
          <p className="mt-1 max-w-3xl text-xs leading-6 text-slate-500">إدارة كاملة للأدوار والمستخدمين والأقسام والمكاتب. التغييرات تظهر مباشرة في شجرة الفرع.</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.02] p-1.5">
        <Tab active={tab === "users"} onClick={() => setTab("users")} label="المستخدمون" />
        <Tab active={tab === "roles"} onClick={() => setTab("roles")} label="الأدوار" />
        <Tab active={tab === "departments"} onClick={() => setTab("departments")} label="الأقسام" />
        <Tab active={tab === "offices"} onClick={() => setTab("offices")} label="المكاتب" />
      </div>

      {tab === "users" && <UsersSection state={state} onEdit={setEditingUser} onAdd={() => setEditingUser({ id: uid("user"), name: "", username: "", password: "demo", roleId: state.roles[0]?.id ?? "", active: true })} onDelete={(id) => onChange({ ...state, users: state.users.filter((u) => u.id !== id), departments: state.departments.map((d) => d.headUserId === id ? { ...d, headUserId: undefined } : d), offices: state.offices.map((o) => o.responsibleUserId === id ? { ...o, responsibleUserId: undefined } : o) })} />}
      {tab === "roles" && <RolesSection state={state} onEdit={setEditingRole} onAdd={() => setEditingRole({ id: uid("role"), key: uid("custom"), name: "", permissions: [] })} onDelete={(id) => onChange({ ...state, roles: state.roles.filter((r) => r.id !== id) })} />}
      {tab === "departments" && <DepartmentsSection state={state} onEdit={setEditingDepartment} onAdd={() => setEditingDepartment({ id: uid("dept"), name: "" })} onDelete={(id) => onChange({ ...state, departments: state.departments.filter((d) => d.id !== id), offices: state.offices.filter((o) => o.departmentId !== id), users: state.users.map((u) => u.departmentId === id ? { ...u, departmentId: undefined, officeId: undefined } : u) })} />}
      {tab === "offices" && <OfficesSection state={state} onEdit={setEditingOffice} onAdd={() => setEditingOffice({ id: uid("office"), name: "", departmentId: state.departments[0]?.id ?? "" })} onDelete={(id) => onChange({ ...state, offices: state.offices.filter((o) => o.id !== id), users: state.users.map((u) => u.officeId === id ? { ...u, officeId: undefined } : u) })} />}

      {editingUser && <UserDialog state={state} user={editingUser} onClose={() => setEditingUser(null)} onSave={(user) => { const exists = state.users.some((u) => u.id === user.id); onChange({ ...state, users: exists ? state.users.map((u) => u.id === user.id ? user : u) : [...state.users, user] }); setEditingUser(null); }} />}
      {editingRole && <RoleDialog role={editingRole} onClose={() => setEditingRole(null)} onSave={(role) => { const exists = state.roles.some((r) => r.id === role.id); onChange({ ...state, roles: exists ? state.roles.map((r) => r.id === role.id ? role : r) : [...state.roles, role] }); setEditingRole(null); }} />}
      {editingDepartment && <DepartmentDialog state={state} department={editingDepartment} onClose={() => setEditingDepartment(null)} onSave={(department) => { const exists = state.departments.some((d) => d.id === department.id); const users = department.headUserId ? state.users.map((u) => u.id === department.headUserId ? { ...u, departmentId: department.id, managerId: state.users.find((x) => state.roles.find((r) => r.id === x.roleId)?.key === "branch_head")?.id } : u) : state.users; onChange({ ...state, departments: exists ? state.departments.map((d) => d.id === department.id ? department : d) : [...state.departments, department], users }); setEditingDepartment(null); }} />}
      {editingOffice && <OfficeDialog state={state} office={editingOffice} onClose={() => setEditingOffice(null)} onSave={(office) => { const exists = state.offices.some((o) => o.id === office.id); const dept = state.departments.find((d) => d.id === office.departmentId); const users = office.responsibleUserId ? state.users.map((u) => u.id === office.responsibleUserId ? { ...u, departmentId: office.departmentId, officeId: office.id, managerId: dept?.headUserId } : u) : state.users; onChange({ ...state, offices: exists ? state.offices.map((o) => o.id === office.id ? office : o) : [...state.offices, office], users }); setEditingOffice(null); }} />}
    </div>
  );
}

function UsersSection({ state, onEdit, onAdd, onDelete }: { state: OrgState; onEdit: (u: OrgUser) => void; onAdd: () => void; onDelete: (id: string) => void }) {
  return <section className="tech-panel overflow-hidden"><SectionHeader icon={<UsersRound size={17} />} title="المستخدمون" action="إضافة مستخدم" onAction={onAdd} /><div className="divide-y divide-white/7">{state.users.map((u) => { const role = state.roles.find((r) => r.id === u.roleId); const dept = state.departments.find((d) => d.id === u.departmentId); const office = state.offices.find((o) => o.id === u.officeId); return <div key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-4"><div className="min-w-0 flex-1"><div className="text-sm font-bold text-slate-100">{u.name || "مستخدم بدون اسم"}</div><div className="mt-1 text-[10px] text-slate-600">{role?.name ?? "بدون دور"}{dept ? ` · ${dept.name}` : ""}{office ? ` · ${office.name}` : ""}</div></div><span className={`rounded-lg px-2 py-1 text-[9px] font-bold ${u.active ? "bg-emerald-400/8 text-emerald-300" : "bg-slate-500/10 text-slate-500"}`}>{u.active ? "فعال" : "موقوف"}</span><button onClick={() => onEdit(u)} className="icon-btn"><Pencil size={14} /></button><button onClick={() => onDelete(u.id)} className="icon-btn text-rose-300"><Trash2 size={14} /></button></div>; })}</div></section>;
}

function RolesSection({ state, onEdit, onAdd, onDelete }: { state: OrgState; onEdit: (r: OrgRole) => void; onAdd: () => void; onDelete: (id: string) => void }) {
  return <section className="tech-panel overflow-hidden"><SectionHeader icon={<ShieldCheck size={17} />} title="الأدوار والصلاحيات" action="إضافة دور" onAction={onAdd} /><div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">{state.roles.map((r) => <div key={r.id} className="rounded-2xl border border-white/7 bg-white/[0.02] p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black">{r.name}</div><div className="mt-1 text-[9px] text-slate-600">{r.permissions.length} صلاحية</div></div><div className="flex gap-1"><button onClick={() => onEdit(r)} className="icon-btn"><Pencil size={13} /></button>{!r.system && <button onClick={() => onDelete(r.id)} className="icon-btn text-rose-300"><Trash2 size={13} /></button>}</div></div><div className="mt-3 flex flex-wrap gap-1.5">{r.permissions.slice(0, 4).map((p) => <span key={p} className="rounded-lg border border-white/7 px-2 py-1 text-[9px] text-slate-500">{permissionLabels[p]}</span>)}{r.permissions.length > 4 && <span className="text-[9px] text-slate-600">+{r.permissions.length - 4}</span>}</div></div>)}</div></section>;
}

function DepartmentsSection({ state, onEdit, onAdd, onDelete }: { state: OrgState; onEdit: (d: OrgDepartment) => void; onAdd: () => void; onDelete: (id: string) => void }) {
  return <section className="tech-panel overflow-hidden"><SectionHeader icon={<Building2 size={17} />} title="الأقسام" action="إضافة قسم" onAction={onAdd} /><div className="divide-y divide-white/7">{state.departments.map((d) => <div key={d.id} className="flex items-center gap-3 px-5 py-4"><div className="min-w-0 flex-1"><div className="text-sm font-bold">{d.name}</div><div className="mt-1 text-[10px] text-slate-600">رئيس القسم: {state.users.find((u) => u.id === d.headUserId)?.name ?? "غير محدد"}</div></div><button onClick={() => onEdit(d)} className="icon-btn"><Pencil size={14} /></button><button onClick={() => onDelete(d.id)} className="icon-btn text-rose-300"><Trash2 size={14} /></button></div>)}</div></section>;
}

function OfficesSection({ state, onEdit, onAdd, onDelete }: { state: OrgState; onEdit: (o: OrgOffice) => void; onAdd: () => void; onDelete: (id: string) => void }) {
  return <section className="tech-panel overflow-hidden"><SectionHeader icon={<Building2 size={17} />} title="المكاتب" action="إضافة مكتب" onAction={onAdd} /><div className="divide-y divide-white/7">{state.offices.map((o) => <div key={o.id} className="flex items-center gap-3 px-5 py-4"><div className="min-w-0 flex-1"><div className="text-sm font-bold">{o.name}</div><div className="mt-1 text-[10px] text-slate-600">{state.departments.find((d) => d.id === o.departmentId)?.name ?? "بدون قسم"} · المسؤول: {state.users.find((u) => u.id === o.responsibleUserId)?.name ?? "غير محدد"}</div></div><button onClick={() => onEdit(o)} className="icon-btn"><Pencil size={14} /></button><button onClick={() => onDelete(o.id)} className="icon-btn text-rose-300"><Trash2 size={14} /></button></div>)}</div></section>;
}

function UserDialog({ state, user, onClose, onSave }: { state: OrgState; user: OrgUser; onClose: () => void; onSave: (u: OrgUser) => void }) {
  const [draft, setDraft] = useState(user);
  const managers = useMemo(() => state.users.filter((u) => u.id !== draft.id && u.active), [state.users, draft.id]);
  return <Modal title="المستخدم" onClose={onClose}><div className="grid gap-3 sm:grid-cols-2"><Field label="الاسم"><input className="tech-field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field><Field label="اسم المستخدم"><input className="tech-field" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} /></Field><Field label="كلمة المرور التجريبية"><input className="tech-field" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} /></Field><Field label="الدور"><select className="tech-field" value={draft.roleId} onChange={(e) => setDraft({ ...draft, roleId: e.target.value })}>{state.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field><Field label="القسم"><select className="tech-field" value={draft.departmentId ?? ""} onChange={(e) => setDraft({ ...draft, departmentId: e.target.value || undefined, officeId: undefined })}><option value="">بدون قسم</option>{state.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Field label="المكتب"><select className="tech-field" value={draft.officeId ?? ""} onChange={(e) => setDraft({ ...draft, officeId: e.target.value || undefined })}><option value="">بدون مكتب</option>{state.offices.filter((o) => !draft.departmentId || o.departmentId === draft.departmentId).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field><Field label="المسؤول المباشر"><select className="tech-field" value={draft.managerId ?? ""} onChange={(e) => setDraft({ ...draft, managerId: e.target.value || undefined })}><option value="">بدون مسؤول مباشر</option>{managers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field><Field label="الحالة"><select className="tech-field" value={draft.active ? "1" : "0"} onChange={(e) => setDraft({ ...draft, active: e.target.value === "1" })}><option value="1">فعال</option><option value="0">موقوف</option></select></Field></div><SaveBar disabled={!draft.name.trim() || !draft.username.trim() || !draft.roleId} onClose={onClose} onSave={() => onSave(draft)} /></Modal>;
}

function RoleDialog({ role, onClose, onSave }: { role: OrgRole; onClose: () => void; onSave: (r: OrgRole) => void }) {
  const [draft, setDraft] = useState(role);
  function toggle(p: PermissionKey) { setDraft({ ...draft, permissions: draft.permissions.includes(p) ? draft.permissions.filter((x) => x !== p) : [...draft.permissions, p] }); }
  return <Modal title="الدور والصلاحيات" onClose={onClose}><Field label="اسم الدور"><input className="tech-field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field><div className="mt-5"><div className="mb-3 text-[10px] font-bold text-slate-500">الصلاحيات</div><div className="grid gap-2 sm:grid-cols-2">{allPermissions.map((p) => <label key={p} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-[11px] ${draft.permissions.includes(p) ? "border-cyan-300/25 bg-cyan-300/[0.05] text-cyan-200" : "border-white/7 text-slate-500"}`}><input type="checkbox" checked={draft.permissions.includes(p)} onChange={() => toggle(p)} />{permissionLabels[p]}</label>)}</div></div><SaveBar disabled={!draft.name.trim()} onClose={onClose} onSave={() => onSave(draft)} /></Modal>;
}

function DepartmentDialog({ state, department, onClose, onSave }: { state: OrgState; department: OrgDepartment; onClose: () => void; onSave: (d: OrgDepartment) => void }) { const [draft, setDraft] = useState(department); const heads = state.users.filter((u) => state.roles.find((r) => r.id === u.roleId)?.key === "department_head"); return <Modal title="القسم" onClose={onClose}><Field label="اسم القسم"><input className="tech-field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field><div className="mt-3"><Field label="رئيس القسم"><select className="tech-field" value={draft.headUserId ?? ""} onChange={(e) => setDraft({ ...draft, headUserId: e.target.value || undefined })}><option value="">غير محدد</option>{heads.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field></div><SaveBar disabled={!draft.name.trim()} onClose={onClose} onSave={() => onSave(draft)} /></Modal>; }
function OfficeDialog({ state, office, onClose, onSave }: { state: OrgState; office: OrgOffice; onClose: () => void; onSave: (o: OrgOffice) => void }) { const [draft, setDraft] = useState(office); const responsibles = state.users.filter((u) => state.roles.find((r) => r.id === u.roleId)?.key === "office_responsible"); return <Modal title="المكتب" onClose={onClose}><div className="grid gap-3 sm:grid-cols-2"><Field label="اسم المكتب"><input className="tech-field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field><Field label="القسم"><select className="tech-field" value={draft.departmentId} onChange={(e) => setDraft({ ...draft, departmentId: e.target.value })}>{state.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field></div><div className="mt-3"><Field label="مسؤول المكتب"><select className="tech-field" value={draft.responsibleUserId ?? ""} onChange={(e) => setDraft({ ...draft, responsibleUserId: e.target.value || undefined })}><option value="">غير محدد</option>{responsibles.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field></div><SaveBar disabled={!draft.name.trim() || !draft.departmentId} onClose={onClose} onSave={() => onSave(draft)} /></Modal>; }

function SectionHeader({ icon, title, action, onAction }: { icon: React.ReactNode; title: string; action: string; onAction: () => void }) { return <div className="flex items-center justify-between border-b border-white/7 px-5 py-4"><div className="flex items-center gap-2 text-sm font-black">{icon}{title}</div><button onClick={onAction} className="flex h-9 items-center gap-2 rounded-xl bg-cyan-300 px-3 text-[10px] font-black text-slate-950"><Plus size={13} />{action}</button></div>; }
function Tab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button onClick={onClick} className={`shrink-0 rounded-xl px-4 py-2 text-[11px] font-bold ${active ? "bg-white text-slate-950" : "text-slate-500 hover:bg-white/5"}`}>{label}</button>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-[#020611]/80 p-4 backdrop-blur-sm"><div className="tech-panel my-6 w-full max-w-2xl p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-black">{title}</h2><button onClick={onClose} className="icon-btn"><X size={16} /></button></div>{children}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-[9px] font-bold text-slate-500">{label}</span>{children}</label>; }
function SaveBar({ disabled, onClose, onSave }: { disabled: boolean; onClose: () => void; onSave: () => void }) { return <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="px-4 text-xs text-slate-500">إلغاء</button><button disabled={disabled} onClick={onSave} className="flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-[11px] font-black text-slate-950 disabled:opacity-30"><Save size={13} />حفظ</button></div>; }
