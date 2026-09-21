import type { AppState } from "../v2/model";
import type { OrgState } from "../v8/orgModel";

function fmt(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ar-SY", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type Notice = AppState["notices"][number];

export default function NotificationsPanel({ notices, org, onOpen, onReadAll }: { notices: AppState["notices"]; org: OrgState; onOpen: (notice: Notice) => void; onReadAll: () => void }) {
  const ordered = [...notices].sort((a, b) => b.at.localeCompare(a.at));
  const senderName = (notice: Notice) => notice.fromUserId === "__system-administrator__" ? "Administrator" : org.users.find((u) => u.id === notice.fromUserId)?.name ?? "النظام";

  return (
    <div className="absolute left-0 top-12 z-[60] w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-[22px] border border-white/10 bg-[#0a1625]/98 shadow-2xl backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-white/8 p-4">
        <div>
          <div className="text-sm font-black">الإشعارات</div>
          <div className="mt-1 text-[9px] text-slate-600">سجل الإشعارات بالترتيب الزمني.</div>
        </div>
        <button type="button" onClick={onReadAll} className="text-[10px] font-black text-cyan-300">تعليم الكل كمقروء</button>
      </div>
      <div className="max-h-[520px] overflow-y-auto">
        {ordered.length ? ordered.map((notice) => (
          <button key={notice.id} type="button" onClick={() => onOpen(notice)} className={`block w-full border-b border-white/6 px-4 py-3.5 text-right transition hover:bg-white/5 ${notice.read ? "text-slate-500" : "text-slate-200"}`}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-[9px] font-black text-cyan-300/70">من: {senderName(notice)}</span>
              <span className="text-[9px] text-slate-600">{fmt(notice.at)}</span>
            </div>
            <div className={`text-xs leading-6 ${notice.read ? "font-medium" : "font-bold"}`}>{notice.text}</div>
          </button>
        )) : <div className="p-8 text-center text-xs text-slate-600">لا توجد إشعارات حالياً.</div>}
      </div>
    </div>
  );
}
