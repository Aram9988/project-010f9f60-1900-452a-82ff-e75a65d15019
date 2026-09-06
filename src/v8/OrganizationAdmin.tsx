import { useMemo, useState } from "react";
import { Building2, ImagePlus, Pencil, Plus, Save, ShieldCheck, Trash2, UserRound, UsersRound, X } from "lucide-react";
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

function imageToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("not-image")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("invalid-image"));
      img.onload = () => {
        const size = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = Math.max(0, (img.naturalWidth - size) / 2);
        const sy = Math.max(0, (img.naturalHeight - size) / 2);
        const canvas = document.createElement("canvas");
        canvas.width = 420;
        canvas.height = 420;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas")); return; }
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 420, 420);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function OrganizationAdmin({ state, onChange }: { state: OrgState; onChange: (next: OrgState) => void }) {
  const [tab, setTab] = useState<"users" | "roles" | "departments" | "offices">("users");
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null);
  const [editingRole, setEditingRole] = useState<OrgRole | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<OrgDepartment | null>(null);
  const [editingOffice, setEditingOffice] = useState<OrgOffice | null>(null);

  function saveUser(user: OrgUser) {
    const exists = state.users.some((u) => u.id === user.id);
    onChange({ ...state, users: exists ? state.users.map((u) => u.id === user.id ? user : u) : [...state.users, user] });
    setEditingUser(null);
  }
  function saveRole(role: OrgRole) {
    const exists = state.roles.some((r) => r.id === role.id);
    onChange({ ...state, roles: exists ? state.roles.map((r) => r.id === role.id ? role : r) : [...state.roles, role] });
    setEditingRole(null);
  }
  function saveDepartment(department: OrgDepartment) {
    const exists = state.departments.some((d) => d.id === department.id);
    const branchHead = state.users.find((u) => state.roles.find((r) => r.id === u.roleId)?.key === "branch_head");
    const users = department.headUserId ? state.users.map((u) => u.id === department.headUserId ? { ...u, departmentId: department.id, managerId: branchHead?.id } : u) : state.users;
    onChange({ ...state, departments: exists ? state.departments.map((d) => d.id === department.id ? department : d) : [...state.departments, department], users });
    setEditingDepartment(null);
  }
  function saveOffice(office: OrgOffice) {
    const exists = state.offices.some((o) => o.id === office.id);
    const dept = state.departments.find((d) => d.id === office.departmentId);
    const users = office.responsibleUserId ? state.users.map((u) => u.id === office.responsibleUserId ? { ...u, departmentId: office.departmentId, officeId: office.id, managerId: dept?.headUserId } : u) : state.users;
    onChange({ ...state, offices: exists ? state.offices.map((o) => o.id === office.id ? office : o) : [...state.offices, office], users });
    setEditingOffice(null);
  }

  return <div className="mx-auto max-w-7xl space-y-6">
    <div><div className="text-[10px] tracking-[.2em] text-cyan-300/50">ORGANIZATION ADMIN</div><h1 className="mt-2 text-2xl font-black">إدارة الهيكل والصلاحيات</h1><p className="mt-1 max-w-3xl text-xs leading-6 text-slate-500">إدارة المستخدمين والأدوار والأقسام والمكاتب. أي تعديل يظهر مباشرة في شجرة الفرع.</p></div>
    <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.02] p-1.5"><Tab active={tab === "users"} onClick={() => setTab("users")} label="المستخدمون" /><Tab active={tab === "roles"} onClick={() => setTab("roles")} label="الأدوار" /><Tab active={tab === "departments"} onClick={() => setTab("departments")} label="الأقسام" /><Tab active={tab === "offices"} onClick={() => setTab("offices")} label="المكاتب" /></div>

    {tab === "users" && <Section title="المستخدمون" icon={<UsersRound size={17} />} action="إضافة مستخدم" onAction={() => setEditingUser({ id: uid("user"), name: "", username: "", password: "demo", roleId: state.roles[0]?.id ?? "", active: true })}>{state.users.map((u) => <Row key={u.id} avatar={u.avatarDataUrl} title={u.name || "مستخدم بدون اسم"} subtitle={`${state.roles.find((r) => r.id === u.roleId)?.name ?? "بدون دور"}${u.departmentId ? ` · ${state.departments.find((d) => d.id === u.departmentId)?.name ?? ""}` : ""}${u.officeId ? ` · ${state.offices.find((o) => o.id === u.officeId)?.name ?? ""}` : ""}`} onEdit={() => setEditingUser(u)} onDelete={() => onChange({ ...state, users: state.users.filter((x) => x.id !== u.id), departments: state.departments.map((d) => d.headUserId === u.id ? { ...d, headUserId: undefined } : d), offices: state.offices.map((o) => o.responsibleUserId === u.id ? { ...o, responsibleUserId: undefined } : o) })} />)}</Section>}

    {tab === "roles" && <Section title="الأدوار والصلاحيات" icon={<ShieldCheck size={17} />} action="إضافة دور" onAction={() => setEditingRole({ id: uid("role"), key: uid("custom"), name: "", permissions: [] })}>{state.roles.map((r) => <Row key={r.id} title={r.name} subtitle={`${r.permissions.length} صلاحية`} onEdit={() => setEditingRole(r)} onDelete={!r.system ? () => onChange({ ...state, roles: state.roles.filter((x) => x.id !== r.id) }) : undefined} />)}</Section>}

    {tab === "departments" && <Section title="الأقسام" icon={<Building2 size={17} />} action="إضافة قسم" onAction={() => setEditingDepartment({ id: uid("dept"), name: "" })}>{state.departments.map((d) => <Row key={d.id} title={d.name} subtitle={`رئيس القسم: ${state.users.find((u) => u.id === d.headUserId)?.name ?? "غير محدد"}`} onEdit={() => setEditingDepartment(d)} onDelete={() => onChange({ ...state, departments: state.departments.filter((x) => x.id !== d.id), offices: state.offices.filter((o) => o.departmentId !== d.id), users: state.users.map((u) => u.departmentId === d.id ? { ...u, departmentId: undefined, officeId: undefined } : u) })} />)}</Section>}

    {tab === "offices" && <Section title="المكاتب" icon={<Building2 size={17} />} action="إضافة مكتب" onAction={() => setEditingOffice({ id: uid("office"), name: "", departmentId: state.departments[0]?.id ?? "" })}>{state.offices.map((o) => <Row key={o.id} title={o.name} subtitle={`${state.departments.find((d) => d.id === o.departmentId)?.name ?? "بدون قسم"} · المسؤول: ${state.users.find((u) => u.id === o.responsibleUserId)?.name ?? "غير محدد"}`} onEdit={() => setEditingOffice(o)} onDelete={() => onChange({ ...state, offices: state.offices.filter((x) => x.id !== o.id), users: state.users.map((u) => u.officeId === o.id ? { ...u, officeId: undefined } : u) })} />)}</Section>}

    {editingUser && <UserDialog state={state} user={editingUser} onClose={() => setEditingUser(null)} onSave={saveUser} />}
    {editingRole && <RoleDialog role={editingRole} onClose={() => setEditingRole(null)} onSave={saveRole} />}
    {editingDepartment && <DepartmentDialog state={state} department={editingDepartment} onClose={() => setEditingDepartment(null)} onSave={saveDepartment} />}
    {editingOffice && <OfficeDialog state={state} office={editingOffice} onClose={() => setEditingOffice(null)} onSave={saveOffice} />}
  </div>;
}

function UserDialog({ state, user, onClose, onSave }: { state: OrgState; user: OrgUser; onClose: () => void; onSave: (u: OrgUser) => void }) {
  const [draft, setDraft] = useState(user);
  const [imageError, setImageError] = useState("");
  const managers = useMemo(() => state.users.filter((u) => u.id !== draft.id && u.active), [state.users, draft.id]);

  async function chooseImage(file?: File) {
    if (!file) return;
    setImageError("");
    try {
      const avatarDataUrl = await imageToAvatar(file);
      setDraft((current) => ({ ...current, avatarDataUrl }));
    } catch {
      setImageError("تعذر قراءة الصورة. اختر ملف صورة صالحاً.");
    }
  }

  return <Modal title="المستخدم" onClose={onClose}>
    <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.025] p-4 sm:flex-row sm:items-center">
      <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black/20 text-slate-500">
        {draft.avatarDataUrl ? <img src={draft.avatarDataUrl} alt={draft.name || "صورة المستخدم"} className="h-full w-full object-cover" /> : <UserRound size={32} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-black text-slate-200">صورة المستخدم</div>
        <div className="mt-1 text-[10px] leading-5 text-slate-600">اختر صورة للشخص. سيتم قصّها تلقائياً بشكل مربع وضغطها للاستخدام داخل شجرة الفريق.</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-[10px] font-black text-slate-950"><ImagePlus size={13} />اختيار صورة<input type="file" accept="image/*" className="hidden" onChange={(e) => { void chooseImage(e.target.files?.[0]); e.currentTarget.value = ""; }} /></label>
          {draft.avatarDataUrl && <button type="button" onClick={() => setDraft({ ...draft, avatarDataUrl: undefined })} className="rounded-xl border border-rose-300/15 px-3 py-2 text-[10px] font-bold text-rose-300">إزالة الصورة</button>}
        </div>
        {imageError && <div className="mt-2 text-[9px] font-bold text-rose-300">{imageError}</div>}
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="الاسم"><input className="tech-field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field><Field label="اسم المستخدم"><input className="tech-field" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} /></Field><Field label="كلمة المرور التجريبية"><input className="tech-field" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} /></Field><Field label="الدور"><select className="tech-field" value={draft.roleId} onChange={(e) => setDraft({ ...draft, roleId: e.target.value })}>{state.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field><Field label="القسم"><select className="tech-field" value={draft.departmentId ?? ""} onChange={(e) => setDraft({ ...draft, departmentId: e.target.value || undefined, officeId: undefined })}><option value="">بدون قسم</option>{state.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Field label="المكتب"><select className="tech-field" value={draft.officeId ?? ""} onChange={(e) => setDraft({ ...draft, officeId: e.target.value || undefined })}><option value="">بدون مكتب</option>{state.offices.filter((o) => !draft.departmentId || o.departmentId === draft.departmentId).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field><Field label="المسؤول المباشر"><select className="tech-field" value={draft.managerId ?? ""} onChange={(e) => setDraft({ ...draft, managerId: e.target.value || undefined })}><option value="">بدون مسؤول مباشر</option>{managers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field><Field label="الحالة"><select className="tech-field" value={draft.active ? "1" : "0"} onChange={(e) => setDraft({ ...draft, active: e.target.value === "1" })}><option value="1">فعال</option><option value="0">موقوف</option></select></Field></div><SaveBar disabled={!draft.name.trim() || !draft.username.trim() || !draft.roleId} onClose={onClose} onSave={() => onSave(draft)} />
  </Modal>;
}

function RoleDialog({ role, onClose, onSave }: { role: OrgRole; onClose: () => void; onSave: (r: OrgRole) => void }) {
  const [draft, setDraft] = useState(role);
  function toggle(p: PermissionKey) { setDraft({ ...draft, permissions: draft.permissions.includes(p) ? draft.permissions.filter((x) => x !== p) : [...draft.permissions, p] }); }
  return <Modal title="الدور والصلاحيات" onClose={onClose}><Field label="اسم الدور"><input className="tech-field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field><div className="mt-5 grid gap-2 sm:grid-cols-2">{allPermissions.map((p) => <label key={p} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-[11px] ${draft.permissions.includes(p) ? "border-cyan-300/25 bg-cyan-300/[0.05] text-cyan-200" : "border-white/7 text-slate-500"}`}><input type="checkbox" checked={draft.permissions.includes(p)} onChange={() => toggle(p)} />{permissionLabels[p]}</label>)}</div><SaveBar disabled={!draft.name.trim()} onClose={onClose} onSave={() => onSave(draft)} /></Modal>;
}

function DepartmentDialog({ state, department, onClose, onSave }: { state: OrgState; department: OrgDepartment; onClose: () => void; onSave: (d: OrgDepartment) => void }) {
  const [draft, setDraft] = useState(department);
  const heads = state.users.filter((u) => state.roles.find((r) => r.id === u.roleId)?.key === "department_head");
  return <Modal title="القسم" onClose={onClose}><Field label="اسم القسم"><input className="tech-field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field><div className="mt-3"><Field label="رئيس القسم"><select className="tech-field" value={draft.headUserId ?? ""} onChange={(e) => setDraft({ ...draft, headUserId: e.target.value || undefined })}><option value="">غير محدد</option>{heads.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field></div><SaveBar disabled={!draft.name.trim()} onClose={onClose} onSave={() => onSave(draft)} /></Modal>;
}

function OfficeDialog({ state, office, onClose, onSave }: { state: OrgState; office: OrgOffice; onClose: () => void; onSave: (o: OrgOffice) => void }) {
  const [draft, setDraft] = useState(office);
  const responsibles = state.users.filter((u) => state.roles.find((r) => r.id === u.roleId)?.key === "office_responsible");
  return <Modal title="إنشاء / تعديل مكتب" onClose={onClose}>
    <div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.03] p-4">
      <Field label="اسم المكتب — اكتب الاسم هنا"><input autoFocus className="tech-field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="مثال: مكتب الدراسات والتصميم" /></Field>
      <p className="mt-2 text-[10px] leading-5 text-slate-600">اسم المكتب حر بالكامل، ويمكنك كتابة أي اسم تريده. ليس اختياراً من قائمة.</p>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Field label="القسم التابع له"><select className="tech-field" value={draft.departmentId} onChange={(e) => setDraft({ ...draft, departmentId: e.target.value })}><option value="">اختر القسم</option>{state.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
      <Field label="مسؤول المكتب"><select className="tech-field" value={draft.responsibleUserId ?? ""} onChange={(e) => setDraft({ ...draft, responsibleUserId: e.target.value || undefined })}><option value="">غير محدد</option>{responsibles.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
    </div>
    <SaveBar disabled={!draft.name.trim() || !draft.departmentId} onClose={onClose} onSave={() => onSave({ ...draft, name: draft.name.trim() })} />
  </Modal>;
}

function Section({ title, icon, action, onAction, children }: { title: string; icon: React.ReactNode; action: string; onAction: () => void; children: React.ReactNode }) { return <section className="tech-panel overflow-hidden"><div className="flex items-center justify-between border-b border-white/7 px-5 py-4"><div className="flex items-center gap-2 text-sm font-black">{icon}{title}</div><button onClick={onAction} className="flex h-9 items-center gap-2 rounded-xl bg-cyan-300 px-3 text-[10px] font-black text-slate-950"><Plus size={13} />{action}</button></div><div className="divide-y divide-white/7">{children}</div></section>; }
function Row({ title, subtitle, avatar, onEdit, onDelete }: { title: string; subtitle: string; avatar?: string; onEdit: () => void; onDelete?: () => void }) { return <div className="flex items-center gap-3 px-5 py-4">{avatar && <img src={avatar} alt="" className="h-10 w-10 shrink-0 rounded-xl border border-white/10 object-cover" />}<div className="min-w-0 flex-1"><div className="text-sm font-bold text-slate-100">{title}</div><div className="mt-1 text-[10px] text-slate-600">{subtitle}</div></div><button onClick={onEdit} className="icon-btn"><Pencil size={14} /></button>{onDelete && <button onClick={onDelete} className="icon-btn text-rose-300"><Trash2 size={14} /></button>}</div>; }
function Tab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button onClick={onClick} className={`shrink-0 rounded-xl px-4 py-2 text-[11px] font-bold ${active ? "bg-white text-slate-950" : "text-slate-500 hover:bg-white/5"}`}>{label}</button>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-[#020611]/80 p-4 backdrop-blur-sm"><div className="tech-panel my-6 w-full max-w-2xl p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-black">{title}</h2><button onClick={onClose} className="icon-btn"><X size={16} /></button></div>{children}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-[9px] font-bold text-slate-500">{label}</span>{children}</label>; }
function SaveBar({ disabled, onClose, onSave }: { disabled: boolean; onClose: () => void; onSave: () => void }) { return <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="px-4 text-xs text-slate-500">إلغاء</button><button disabled={disabled} onClick={onSave} className="flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-[11px] font-black text-slate-950 disabled:opacity-30"><Save size={13} />حفظ</button></div>; }
