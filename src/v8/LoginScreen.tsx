import { useState, type FormEvent } from "react";
import { LockKeyhole, Radar, ShieldCheck } from "lucide-react";
import type { OrgState } from "./orgModel";

export default function LoginScreen({ org, onLogin }: { org: OrgState; onLogin: (userId: string) => void }) {
  const [username, setUsername] = useState("boss");
  const [password, setPassword] = useState("demo");
  const [error, setError] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const user = org.users.find((u) => u.active && u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password);
    if (!user) { setError(true); return; }
    setError(false);
    onLogin(user.id);
  }

  return <div className="tech-shell relative grid min-h-screen place-items-center overflow-hidden p-4 text-slate-100"><div className="pointer-events-none absolute inset-0 tech-grid opacity-50" /><div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/10 bg-[#081321]/85 shadow-2xl backdrop-blur-2xl lg:grid-cols-[1.1fr_.9fr]"><section className="hidden min-h-[620px] border-l border-white/8 p-10 lg:flex lg:flex-col lg:justify-between"><Brand /><div><div className="text-[10px] font-black tracking-[.2em] text-cyan-300/60">RIF DIMASHQ COMMUNICATIONS</div><h1 className="mt-5 text-4xl font-black leading-[1.4]">مركز المشاريع والمهام والهيكل التنظيمي المباشر</h1><p className="mt-5 max-w-xl text-sm leading-8 text-slate-400">إدارة المشاريع والمهام ومتابعة الأقسام والمكاتب والفريق من شجرة تنظيمية واحدة.</p></div><div className="text-[10px] text-slate-600">DEMO · LOCAL BROWSER DATA</div></section><section className="flex min-h-[620px] items-center p-6 sm:p-10"><form onSubmit={submit} className="w-full"><div className="mb-8 lg:hidden"><Brand /></div><div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/8 text-cyan-300"><LockKeyhole size={24} /></div><h2 className="mt-6 text-2xl font-black">تسجيل الدخول</h2><p className="mt-2 text-xs leading-6 text-slate-500">الحسابات التي تنشئها من الإدارة تصبح قابلة للدخول مباشرة في هذه النسخة التجريبية.</p><div className="mt-7 space-y-4"><Field label="اسم المستخدم"><input className="tech-field" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></Field><Field label="كلمة المرور"><input className="tech-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field></div>{error && <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/7 p-3 text-[11px] font-bold text-rose-300">بيانات الدخول غير صحيحة أو الحساب موقوف.</div>}<button type="submit" className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-cyan-300 to-indigo-400 text-sm font-black text-slate-950"><ShieldCheck size={17} />دخول</button><div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-[10px] leading-6 text-slate-600">للتجربة: <span className="font-mono text-cyan-300">boss / demo</span><br />كما يمكنك إنشاء مستخدم جديد من لوحة الإدارة وتحديد اسم المستخدم وكلمة المرور.</div></form></section></div></div>;
}

function Brand() { return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-[14px] border border-cyan-300/30 bg-cyan-300/10 text-cyan-300"><Radar size={20} /></div><div><div className="text-sm font-black">{`فرع اتصالات ريف دمشق`}</div><div className="mt-0.5 text-[9px] font-bold tracking-[.2em] text-cyan-300/60">OPERATIONS COMMAND</div></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-[10px] font-black text-slate-500">{label}</span>{children}</label>; }
