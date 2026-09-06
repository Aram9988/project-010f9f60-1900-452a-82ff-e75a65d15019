import type { AppState } from "../v2/model";

function fmt(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ar-SY", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function NotificationsPanel({ notices, onOpen, onReadAll }: { notices: AppState["notices"]; onOpen: (notice: AppState["notices"][number]) => void; onReadAll: () => void }) {
  return (
    <div className="absolute left-0 top-12 z-[60] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-[22px] border border-white/10 bg-[#0a1625]/98 shadow-2xl backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-white/8 p-4">
        <div>
          <div className="text-sm font-black">الإشعارات</div>
          <div className="mt-1 text-[9px] text-slate-600">آخر التنبيهات المتعلقة بالتكليفات</div>
        </div>
        <button type="button" onClick={onReadAll} className="text-[10px] font-black text-cyan-300">تعليم الكل كمقروء</button>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {notices.length ? notices.slice(0, 12).map((n) => (
          <button key={n.id} type="button" onClick={() => onOpen(n)} className={`block w-full border-b border-white/6 p-4 text-right transition hover:bg-white/5 ${!n.read ? "bg-cyan-300/[0.045]" : ""}`}>
            <div className="flex gap-3">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-700" : "bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,.7)]"}`} />
              <div>
                <div className="text-xs font-bold leading-6 text-slate-200">{n.text}</div>
                <div className="mt-1 text-[9px] text-slate-600">{fmt(n.at)}</div>
              </div>
            </div>
          </button>
        )) : <div className="p-8 text-center text-xs text-slate-600">لا توجد إشعارات حالياً.</div>}
      </div>
    </div>
  );
}
