import type { AppState } from "../v2/model";

function fmt(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ar-SY", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type Notice = AppState["notices"][number];
type NoticeGroup = { key: string; taskId?: string; notices: Notice[]; latest: Notice; unread: number };

function groupedNotices(notices: Notice[]): NoticeGroup[] {
  const groups = new Map<string, Notice[]>();
  for (const notice of notices) {
    const key = notice.taskId ? `work:${notice.taskId}` : `notice:${notice.id}`;
    const current = groups.get(key) ?? [];
    current.push(notice);
    groups.set(key, current);
  }
  return [...groups.entries()].map(([key, group]) => {
    const ordered = [...group].sort((a, b) => b.at.localeCompare(a.at));
    return { key, taskId: ordered[0]?.taskId, notices: ordered, latest: ordered[0], unread: ordered.filter((notice) => !notice.read).length };
  }).sort((a, b) => b.latest.at.localeCompare(a.latest.at));
}

export default function NotificationsPanel({ notices, onOpen, onReadAll }: { notices: AppState["notices"]; onOpen: (notice: Notice) => void; onReadAll: () => void }) {
  const groups = groupedNotices(notices);
  const totalUnread = notices.filter((notice) => !notice.read).length;

  function openGroup(group: NoticeGroup) {
    if (group.unread > 0) group.notices.filter((notice) => !notice.read).forEach((notice) => onOpen(notice));
    else onOpen(group.latest);
  }

  return (
    <div className="absolute left-0 top-12 z-[60] w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-[22px] border border-white/10 bg-[#0a1625]/98 shadow-2xl backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-white/8 p-4">
        <div>
          <div className="flex items-center gap-2"><div className="text-sm font-black">الإشعارات</div>{totalUnread > 0 && <span className="grid min-w-6 place-items-center rounded-full bg-cyan-300 px-1.5 py-0.5 text-[9px] font-black text-slate-950">{totalUnread}</span>}</div>
          <div className="mt-1 text-[9px] text-slate-600">مجمعة حسب المشروع أو المهمة — مثل المحادثات</div>
        </div>
        <button type="button" onClick={onReadAll} className="text-[10px] font-black text-cyan-300">تعليم الكل كمقروء</button>
      </div>
      <div className="max-h-[520px] overflow-y-auto">
        {groups.length ? groups.map((group) => {
          const hasUnread = group.unread > 0;
          return <button key={group.key} type="button" onClick={() => openGroup(group)} className={`block w-full border-b border-white/6 p-4 text-right transition hover:bg-white/5 ${hasUnread ? "bg-cyan-300/[0.055]" : ""}`}>
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${hasUnread ? "bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.85)]" : "bg-slate-700"}`} />
              <div className="min-w-0 flex-1">
                <div className={`line-clamp-2 text-xs leading-6 ${hasUnread ? "font-black text-slate-100" : "font-bold text-slate-400"}`}>{group.latest.text}</div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <div className="text-[9px] text-slate-600">{fmt(group.latest.at)}</div>
                  <div className="flex items-center gap-2">{group.notices.length > 1 && <span className="text-[9px] text-slate-600">{group.notices.length} تحديثات</span>}{hasUnread && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-cyan-300 px-1 text-[9px] font-black text-slate-950">{group.unread}</span>}</div>
                </div>
              </div>
            </div>
          </button>;
        }) : <div className="p-8 text-center text-xs text-slate-600">لا توجد إشعارات حالياً.</div>}
      </div>
    </div>
  );
}
