import { useState, type FormEvent } from "react";
import { Activity, LockKeyhole, Radar, ShieldCheck } from "lucide-react";

export const DEMO_ACCOUNTS: Record<string, string> = {
  boss: "boss",
  studies: "head-studies",
  networks: "head-networks",
  support: "head-support",
  systems: "head-systems",
  engineer: "employee-studies",
};

export default function LoginScreen({ onLogin }: { onLogin: (username: string, password: string) => boolean }) {
  const [username, setUsername] = useState("boss");
  const [password, setPassword] = useState("demo");
  const [error, setError] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(!onLogin(username, password));
  }

  return (
    <div className="tech-shell relative grid min-h-screen place-items-center overflow-hidden p-4 text-slate-100">
      <div className="pointer-events-none absolute inset-0 tech-grid opacity-50" />
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-cyan-400/7 blur-3xl" />
      <div className="absolute -bottom-32 -left-20 h-[30rem] w-[30rem] rounded-full bg-indigo-500/9 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/10 bg-[#081321]/80 shadow-2xl shadow-black/40 backdrop-blur-2xl lg:grid-cols-[1.15fr_.85fr]">
        <section className="hidden min-h-[620px] border-l border-white/8 p-10 lg:flex lg:flex-col lg:justify-between">
          <Brand />
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/7 px-3 py-1 text-[9px] font-black tracking-[.18em] text-cyan-300">
              <Activity size={12} /> SECURE OPERATIONS ACCESS
            </div>
            <h1 className="mt-5 max-w-lg text-4xl font-black leading-[1.35]">مركز موحد لإصدار التكليفات ومتابعة التنفيذ والاعتماد</h1>
            <p className="mt-5 max-w-xl text-sm leading-8 text-slate-400">واجهة تشغيلية عربية: الإدارة تصدر التكليف، القسم ينفذ ويحدّث، والإدارة تراجع وتعتمد وتنهي.</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />
            DEMO ENVIRONMENT · LOCAL DATA ONLY
          </div>
        </section>

        <section className="flex min-h-[620px] items-center p-6 sm:p-10">
          <form onSubmit={submit} className="w-full">
            <div className="mb-8 lg:hidden"><Brand /></div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/8 text-cyan-300"><LockKeyhole size={24} /></div>
            <h2 className="mt-6 text-2xl font-black">تسجيل الدخول</h2>
            <p className="mt-2 text-xs leading-6 text-slate-500">أدخل بيانات حسابك للوصول إلى مركز التكليفات.</p>

            <div className="mt-7 space-y-4">
              <label className="block"><span className="mb-2 block text-[10px] font-black text-slate-500">اسم المستخدم</span><input value={username} onChange={(e) => setUsername(e.target.value)} className="tech-field" autoComplete="username" /></label>
              <label className="block"><span className="mb-2 block text-[10px] font-black text-slate-500">كلمة المرور</span><input value={password} onChange={(e) => setPassword(e.target.value)} className="tech-field" type="password" autoComplete="current-password" /></label>
            </div>

            {error && <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/7 p-3 text-[11px] font-bold text-rose-300">اسم المستخدم أو كلمة المرور غير صحيحة.</div>}

            <button type="submit" className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-cyan-300 to-indigo-400 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30"><ShieldCheck size={17} />دخول آمن</button>

            <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <div className="text-[10px] font-black text-slate-400">بيانات التجربة</div>
              <div className="mt-2 font-mono text-[11px] leading-6 text-cyan-300/75">boss / demo</div>
              <div className="text-[10px] leading-5 text-slate-600">حسابات إضافية: studies / networks / support / systems — وكلمة المرور demo</div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function Brand() {
  return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-[14px] border border-cyan-300/30 bg-cyan-300/10 text-cyan-300"><Radar size={20} /></div><div><div className="text-sm font-black">مركز التكليفات</div><div className="mt-0.5 text-[9px] font-bold tracking-[0.24em] text-cyan-300/60">OPERATIONS COMMAND</div></div></div>;
}
