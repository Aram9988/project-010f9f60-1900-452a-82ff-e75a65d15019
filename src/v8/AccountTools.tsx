import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, KeyRound, Link2, RefreshCcw, Send, Unlink, UserRound, X } from "lucide-react";
import { SYSTEM_ADMIN_ID, roleOf } from "./orgModel";
import { useLiveOrgState, WORKSPACE_SYNC_KEY_STORAGE } from "./liveState";
import { IS_LOCAL_DEPLOYMENT } from "./syncConfig";

const SESSION_KEY = "command-center-demo-session";

type TelegramStatus = {
  configured: boolean;
  linked: boolean;
  botUsername?: string;
  telegramUsername?: string;
  linkedAt?: string;
};

async function resizeAvatar(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const max = 512;
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function csvCell(value: string) {
  return '"' + value.replace(/"/g, '""') + '"';
}

export default function AccountTools() {
  const [org, setOrg] = useLiveOrgState();
  const [sessionUserId, setSessionUserId] = useState<string | null>(() => typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null);
  const [open, setOpen] = useState(false);
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [telegramLinkCode, setTelegramLinkCode] = useState("");
  const [telegramBusy, setTelegramBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const sync = () => setSessionUserId(sessionStorage.getItem(SESSION_KEY));
    const openTools = () => setOpen(true);
    const timer = window.setInterval(sync, 500);
    window.addEventListener("focus", sync);
    window.addEventListener("open-account-tools", openTools);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
      window.removeEventListener("open-account-tools", openTools);
    };
  }, []);

  useEffect(() => {
    if (!IS_LOCAL_DEPLOYMENT || !open || !sessionUserId) return;
    void loadTelegramStatus();
    const timer = telegramLinkCode ? window.setInterval(() => void loadTelegramStatus(), 2500) : 0;
    return () => { if (timer) window.clearInterval(timer); };
  }, [open, sessionUserId, telegramLinkCode]);

  const user = useMemo(() => sessionUserId && sessionUserId !== SYSTEM_ADMIN_ID ? org.users.find((item) => item.id === sessionUserId && item.active) : undefined, [org.users, sessionUserId]);
  const isAdmin = sessionUserId === SYSTEM_ADMIN_ID;
  if (!sessionUserId) return null;

  function telegramHeaders(json = false): Record<string, string> {
    const key = localStorage.getItem(WORKSPACE_SYNC_KEY_STORAGE) ?? "";
    const headers: Record<string, string> = { "x-workspace-key": key };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  async function loadTelegramStatus() {
    if (!IS_LOCAL_DEPLOYMENT || !sessionUserId) return;
    try {
      const res = await fetch(`/api/telegram/status?userId=${encodeURIComponent(sessionUserId)}`, { cache: "no-store", headers: telegramHeaders() });
      if (!res.ok) return;
      const status = await res.json() as TelegramStatus;
      setTelegramStatus(status);
      if (status.linked) setTelegramLinkCode("");
    } catch { /* Local notification service may be restarting. */ }
  }

  async function linkTelegram() {
    if (!sessionUserId) return;
    setTelegramBusy(true);
    try {
      const res = await fetch("/api/telegram/link", {
        method: "POST",
        headers: telegramHeaders(true),
        body: JSON.stringify({ userId: sessionUserId }),
      });
      const data = await res.json() as { configured?: boolean; url?: string; code?: string; error?: string };
      if (!res.ok || !data.url || !data.code) {
        setMessage(data.configured === false ? "خدمة تيليغرام جاهزة في الموقع ولكن يجب إعداد البوت من قبل المدير أولاً." : "تعذر إنشاء رابط تيليغرام حالياً.");
        return;
      }
      setTelegramLinkCode(data.code);
      window.open(data.url, "_blank", "noopener,noreferrer");
      setMessage("تم فتح البوت. اضغط Start في تيليغرام لإكمال الربط، وسيتم التحقق تلقائياً.");
    } finally { setTelegramBusy(false); }
  }

  async function unlinkTelegram() {
    if (!sessionUserId || !window.confirm("إلغاء ربط تيليغرام لهذا الحساب؟")) return;
    setTelegramBusy(true);
    try {
      const res = await fetch(`/api/telegram/link?userId=${encodeURIComponent(sessionUserId)}`, { method: "DELETE", headers: telegramHeaders() });
      if (res.ok) {
        setTelegramStatus((value) => value ? { ...value, linked: false, telegramUsername: undefined, linkedAt: undefined } : value);
        setTelegramLinkCode("");
        setMessage("تم إلغاء ربط تيليغرام.");
      }
    } finally { setTelegramBusy(false); }
  }

  async function testTelegram() {
    if (!sessionUserId) return;
    setTelegramBusy(true);
    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: telegramHeaders(true),
        body: JSON.stringify({ userId: sessionUserId }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setMessage("تم إرسال إشعار تجريبي إلى تيليغرام بنجاح.");
      } else if (data.error === "telegram_not_linked") {
        setMessage("حساب تيليغرام غير مرتبط بعد.");
      } else {
        setMessage("تعذر إرسال الإشعار التجريبي حالياً.");
      }
    } catch {
      setMessage("تعذر الاتصال بخدمة تيليغرام حالياً.");
    } finally {
      setTelegramBusy(false);
    }
  }

  async function chooseAvatar(file?: File) {
    if (!user || !file) return;
    if (!file.type.startsWith("image/")) { setMessage("يرجى اختيار صورة فقط."); return; }
    try {
      const avatarDataUrl = await resizeAvatar(file);
      const at = new Date().toISOString();
      setOrg((state) => ({ ...state, users: state.users.map((item) => item.id === user.id ? { ...item, avatarDataUrl, updatedAt: at } : item) }));
      setMessage("تم تحديث الصورة الشخصية.");
    } catch {
      setMessage("تعذر معالجة الصورة. جرّب صورة أخرى.");
    }
  }

  function changePassword() {
    if (!user) return;
    if (nextPassword.length < 8) { setMessage("كلمة المرور يجب أن تكون 8 محارف على الأقل."); return; }
    if (nextPassword !== confirmPassword) { setMessage("تأكيد كلمة المرور غير مطابق."); return; }
    const at = new Date().toISOString();
    setOrg((state) => ({ ...state, users: state.users.map((item) => item.id === user.id ? { ...item, password: nextPassword, mustChangePassword: false, passwordChangedAt: at, updatedAt: at } : item) }));
    setNextPassword(""); setConfirmPassword(""); setMessage("تم تغيير كلمة المرور وحفظها.");
  }

  function exportCredentials() {
    if (!isAdmin) return;
    const header = ["الاسم","اسم المستخدم","كلمة المرور","الدور","القسم","المكتب","المسؤول المباشر"];
    const rows = org.users.map((u) => [
      u.name,
      u.username,
      u.password,
      roleOf(org, u)?.name ?? "",
      org.departments.find((d) => d.id === u.departmentId)?.name ?? "",
      org.offices.find((o) => o.id === u.officeId)?.name ?? "",
      org.users.find((m) => m.id === u.managerId)?.name ?? "",
    ]);
    const csv = "﻿" + [header, ...rows].map((row) => row.map((value) => csvCell(String(value ?? ""))).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rif-dimashq-users-${new Date().toISOString().slice(0,10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const telegramPanel = IS_LOCAL_DEPLOYMENT ? <div className="mt-7 border-t border-white/8 pt-6">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs font-black"><Send size={15} className="text-[#c7b27a]" />إشعارات تيليغرام</div>
      {telegramStatus?.linked && <span className="rounded-full border border-emerald-300/15 bg-emerald-300/5 px-2 py-1 text-[9px] font-black text-emerald-300">مرتبط</span>}
    </div>
    {telegramStatus?.configured === false ? <p className="text-[10px] leading-5 text-slate-500">البوت غير مفعّل على الخادم بعد. بعد إدخال Bot Token سيصبح الربط متاحاً مباشرة.</p> : telegramStatus?.linked ? <>
      <p className="text-[10px] leading-5 text-slate-400">سيتم إرسال إشعارات المهام والمشاريع وطلبات الاتصال إلى تيليغرام تلقائياً{telegramStatus.telegramUsername ? ` — @${telegramStatus.telegramUsername}` : ""}.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={telegramBusy} onClick={() => void testTelegram()} className="gold-action inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[10px] font-black disabled:opacity-40"><Send size={13} />إرسال إشعار تجريبي</button>
        <button type="button" disabled={telegramBusy} onClick={() => void unlinkTelegram()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-300/15 px-3 text-[10px] font-black text-rose-300 disabled:opacity-40"><Unlink size={13} />إلغاء الربط</button>
      </div>
    </> : <>
      <p className="text-[10px] leading-5 text-slate-500">اربط حسابك مرة واحدة فقط. لا يحتاج الخادم إلى اتصال وارد من الإنترنت؛ يتصل هو بواجهة Telegram Bot API فقط.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={telegramBusy || telegramStatus?.configured !== true} onClick={() => void linkTelegram()} className="gold-action flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[10px] font-black disabled:opacity-35"><Link2 size={13} />ربط تيليغرام</button>
        <button type="button" disabled={telegramBusy} onClick={() => void loadTelegramStatus()} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-slate-400"><RefreshCcw size={13} /></button>
      </div>
      {telegramLinkCode && <div className="mt-3 rounded-xl border border-[#c7b27a]/15 bg-[#c7b27a]/5 p-3 text-center"><div className="text-[9px] text-slate-500">رمز الربط المؤقت</div><div className="mt-1 font-mono text-base font-black tracking-[0.2em] text-[#e0cd99]">{telegramLinkCode}</div></div>}
    </>}
  </div> : null;

  return <>
    {open && <div className="fixed inset-0 z-[180] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-lg">
      <div className="tech-panel relative my-8 w-full max-w-lg p-6">
        <button type="button" onClick={() => setOpen(false)} className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-white/10"><X size={15} /></button>
        {isAdmin ? <>
          <div className="gold-kicker">ADMINISTRATOR TOOLS</div>
          <h2 className="mt-2 text-xl font-black">تصدير بيانات المستخدمين</h2>
          <p className="mt-2 text-xs leading-6 text-slate-400">تنزيل ملف CSV يحتوي أسماء المستخدمين، أسماء الدخول، كلمات المرور الحالية، الدور والقسم والمكتب والمسؤول المباشر. هذه الأداة متاحة للمدير فقط.</p>
          <button type="button" onClick={exportCredentials} className="gold-action mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl font-black"><Download size={16} />تصدير بيانات المستخدمين</button>
          {telegramPanel}
        </> : user ? <>
          <div className="gold-kicker">MY PROFILE</div>
          <h2 className="mt-2 text-xl font-black">الملف الشخصي</h2>
          <div className="mt-6 flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border border-[#c7b27a]/25 bg-[#c7b27a]/8">{user.avatarDataUrl ? <img src={user.avatarDataUrl} alt={user.name} className="h-full w-full object-cover" /> : <UserRound size={28} className="text-[#c7b27a]" />}</div>
            <div><div className="font-black">{user.name}</div><div className="mt-1 text-[10px] text-slate-500">{roleOf(org, user)?.name}</div><button type="button" onClick={() => fileRef.current?.click()} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#c7b27a]/20 bg-[#c7b27a]/8 px-3 py-2 text-[10px] font-black text-[#e0cd99]"><Camera size={13} />تغيير الصورة</button><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void chooseAvatar(e.target.files?.[0]); e.currentTarget.value=""; }} /></div>
          </div>
          <div className="mt-7 border-t border-white/8 pt-6">
            <div className="mb-3 flex items-center gap-2 text-xs font-black"><KeyRound size={15} className="text-[#c7b27a]" />تغيير كلمة المرور</div>
            <div className="space-y-3"><input className="tech-field" type="password" placeholder="كلمة المرور الجديدة" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} /><input className="tech-field" type="password" placeholder="تأكيد كلمة المرور" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
            <button type="button" onClick={changePassword} className="gold-action mt-4 h-11 w-full rounded-xl font-black">حفظ كلمة المرور</button>
          </div>
          {telegramPanel}
          {message && <div className="mt-4 rounded-xl border border-[#c7b27a]/15 bg-[#c7b27a]/6 p-3 text-[10px] font-bold text-[#e0cd99]">{message}</div>}
        </> : null}
      </div>
    </div>}
  </>;
}
