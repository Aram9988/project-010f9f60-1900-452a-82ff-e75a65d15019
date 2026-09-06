import { Building2, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { departments, users } from "../v2/model";

export default function AdminPanel() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <div className="text-[10px] tracking-[.2em] text-cyan-300/50">ADMINISTRATION</div>
        <h1 className="mt-2 text-2xl font-black">الإدارة</h1>
        <p className="mt-1 text-xs leading-6 text-slate-500">واجهة تنظيم المستخدمين والأقسام والصلاحيات. الحفظ المركزي والربط بقاعدة البيانات سيتم عند بناء الـBackend.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={<Building2 size={18} />} label="الأقسام" value={departments.length} />
        <Stat icon={<UsersRound size={18} />} label="المستخدمون" value={users.length} />
        <Stat icon={<ShieldCheck size={18} />} label="الأدوار" value={3} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="tech-panel overflow-hidden">
          <div className="border-b border-white/7 px-5 py-4"><h2 className="text-sm font-black">الأقسام</h2><p className="mt-1 text-[10px] text-slate-600">الهيكل التنظيمي المستخدم في إسناد المشاريع والمهام.</p></div>
          <div className="divide-y divide-white/7">{departments.map((d) => <div key={d.id} className="flex items-center gap-3 px-5 py-4"><span className="grid h-9 w-9 place-items-center rounded-xl border border-white/8 bg-white/[0.025] text-cyan-300"><Building2 size={15} /></span><div className="min-w-0 flex-1"><div className="text-sm font-bold">{d.name}</div><div className="mt-1 text-[10px] text-slate-600">{users.filter((u) => u.departmentId === d.id).length} مستخدم</div></div></div>)}</div>
        </section>

        <section className="tech-panel overflow-hidden">
          <div className="border-b border-white/7 px-5 py-4"><h2 className="text-sm font-black">المستخدمون والأدوار</h2><p className="mt-1 text-[10px] text-slate-600">عرض مبسط للأشخاص وصلاحياتهم الحالية.</p></div>
          <div className="divide-y divide-white/7">{users.map((u) => <div key={u.id} className="flex items-center gap-3 px-5 py-4"><span className="grid h-9 w-9 place-items-center rounded-xl border border-white/8 bg-white/[0.025] text-slate-400"><UserRound size={15} /></span><div className="min-w-0 flex-1"><div className="text-sm font-bold">{u.name}</div><div className="mt-1 text-[10px] text-slate-600">{u.departmentId ? departments.find((d) => d.id === u.departmentId)?.name : "الإدارة"}</div></div><Role role={u.role} /></div>)}</div>
        </section>
      </div>

      <section className="tech-panel p-5 md:p-6">
        <h2 className="text-sm font-black">نموذج الصلاحيات</h2>
        <p className="mt-1 text-[10px] text-slate-600">هذه الواجهة توضّح السلوك المطلوب عند بناء النظام الحقيقي.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Permission title="المدير" text="يرى جميع المشاريع والمهام، ينشئ العمل، يراجع، يعتمد، ينهي ويطلع على التقارير والإدارة." />
          <Permission title="رئيس القسم" text="يرى مشاريع ومهام قسمه فقط، يستلم العمل، يحدّثه، يرفق الملفات ويرسله للاعتماد." />
          <Permission title="الموظف" text="يرى الأعمال المسموحة ضمن قسمه ويضيف التحديثات والمرفقات حسب الصلاحيات المحددة لاحقاً." />
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="tech-panel p-5"><div className="flex items-start justify-between"><div><div className="font-mono text-3xl font-black">{String(value).padStart(2, "0")}</div><div className="mt-1 text-[11px] font-bold text-slate-500">{label}</div></div><span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/12 bg-cyan-300/[0.04] text-cyan-300">{icon}</span></div></div>; }
function Role({ role }: { role: "boss" | "head" | "employee" }) { return <span className="rounded-lg border border-white/8 bg-white/[0.025] px-2 py-1 text-[9px] font-bold text-slate-500">{role === "boss" ? "مدير" : role === "head" ? "رئيس قسم" : "موظف"}</span>; }
function Permission({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4"><div className="text-xs font-black text-slate-200">{title}</div><p className="mt-2 text-[11px] leading-6 text-slate-500">{text}</p></div>; }
