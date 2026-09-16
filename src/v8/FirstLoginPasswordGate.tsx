import { useEffect, useMemo, useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { SYSTEM_ADMIN_ID } from "./orgModel";
import { useLiveOrgState } from "./liveState";

const SESSION_KEY = "command-center-demo-session";

export default function FirstLoginPasswordGate() {
  const [org, setOrg] = useLiveOrgState();
  const [sessionUserId, setSessionUserId] = useState<string | null>(() => typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null);
  const user = useMemo(() => sessionUserId && sessionUserId !== SYSTEM_ADMIN_ID ? org.users.find((item) => item.id === sessionUserId && item.active) : undefined, [org.users, sessionUserId]);
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const syncSession = () => setSessionUserId(sessionStorage.getItem(SESSION_KEY));
    syncSession();
    const timer = window.setInterval(syncSession, 250);
    window.addEventListener("focus", syncSession);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", syncSession); };
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const activeUser = user;
    if (!activeUser || activeUser.mustChangePassword === false) return;
    if (nextPassword.length < 8) { setError("كلمة المرور الجديدة يجب أن تكون 8 محارف على الأقل."); return; }
    if (nextPassword === activeUser.password) { setError("يرجى اختيار كلمة مرور مختلفة عن كلمة المرور المؤقتة."); return; }
    if (nextPassword !== confirmPassword) { setError("تأكيد كلمة المرور غير مطابق."); return; }
    const at = new Date().toISOString();
    setOrg((state) => ({
      ...state,
      users: state.users.map((item) => item.id === activeUser.id ? {
        ...item,
        password: nextPassword,
        mustChangePassword: false,
        passwordChangedAt: at,
        updatedAt: at,
      } : item),
    }));
    setError("");
    setNextPassword("");
    setConfirmPassword("");
  }

  if (!user || user.mustChangePassword === false) return null;

  return <div className="fixed inset-0 z-[200] grid place-items-center bg-[#020611]/95 p-4 backdrop-blur-xl">
    <form onSubmit={submit} className="tech-panel w-full max-w-md p-6 sm:p-8">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/8 text-amber-300"><KeyRound size={24} /></div>
      <h2 className="mt-6 text-2xl font-black">تغيير كلمة المرور</h2>
      <p className="mt-2 text-xs leading-6 text-slate-500">مرحباً {user.name}. عند أول تسجيل دخول يجب اختيار كلمة مرور جديدة قبل استخدام النظام.</p>
      <div className="mt-7 space-y-4">
        <label className="block"><span className="mb-2 block text-[10px] font-black text-slate-500">كلمة المرور الجديدة</span><input className="tech-field" type="password" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} autoComplete="new-password" autoFocus /></label>
        <label className="block"><span className="mb-2 block text-[10px] font-black text-slate-500">تأكيد كلمة المرور</span><input className="tech-field" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" /></label>
      </div>
      {error && <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/7 p-3 text-[11px] font-bold text-rose-300">{error}</div>}
      <button type="submit" className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-amber-300 to-cyan-300 text-sm font-black text-slate-950"><ShieldCheck size={17} />حفظ والمتابعة</button>
    </form>
  </div>;
}
