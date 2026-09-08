import { useState } from "react";
import { Database, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import App from "./App";
import { WORKSPACE_SYNC_KEY_STORAGE, isWorkspaceSyncConfigured, verifyWorkspaceSyncKey } from "./liveState";

export default function SyncGate() {
  const [configured, setConfigured] = useState(() => isWorkspaceSyncConfigured());
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (configured) return <App />;

  async function connect() {
    const value = key.trim();
    if (!value) return;
    setBusy(true);
    setError("");
    const ok = await verifyWorkspaceSyncKey(value);
    if (!ok) {
      setBusy(false);
      setError("رمز ربط قاعدة البيانات غير صحيح أو أن خدمة المزامنة غير متاحة حالياً.");
      return;
    }
    localStorage.setItem(WORKSPACE_SYNC_KEY_STORAGE, value);
    setConfigured(true);
  }

  return (
    <div dir="rtl" className="tech-shell min-h-screen text-slate-100">
      <div className="pointer-events-none fixed inset-0 tech-grid opacity-35" />
      <div className="relative z-10 grid min-h-screen place-items-center p-5">
        <div className="tech-panel w-full max-w-lg p-6 md:p-8">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/5 text-cyan-300">
            <Database size={28} />
          </div>
          <div className="mt-5 text-center">
            <h1 className="text-xl font-black">ربط الجهاز بقاعدة البيانات المشتركة</h1>
            <p className="mt-2 text-xs leading-6 text-slate-500">يتم إدخال هذا الرمز مرة واحدة فقط على كل هاتف أو كمبيوتر. بعد الربط ستصبح المشاريع والمهام والإشعارات وحالات الاستلام موحّدة بين جميع الأجهزة.</p>
          </div>

          <label className="mt-6 block text-[10px] font-bold text-slate-500">رمز المزامنة</label>
          <div className="relative mt-2">
            <KeyRound size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void connect(); }}
              className="tech-field pr-11 font-mono tracking-wider"
              placeholder="RIF-XXXXXX-XXXXXX-XXXXXX"
              autoComplete="off"
              autoFocus
            />
          </div>

          {error && <div className="mt-3 rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 py-2 text-[11px] font-bold leading-5 text-rose-300">{error}</div>}

          <button
            onClick={() => void connect()}
            disabled={busy || !key.trim()}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-black text-slate-950 disabled:opacity-40"
          >
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {busy ? "جاري التحقق والربط..." : "ربط هذا الجهاز"}
          </button>

          <p className="mt-4 text-center text-[9px] leading-5 text-slate-600">لا يتم حفظ رمز قاعدة البيانات أو كلمة مرور قاعدة البيانات داخل GitHub. رمز الربط محفوظ محلياً على هذا الجهاز فقط.</p>
        </div>
      </div>
    </div>
  );
}
