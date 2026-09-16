import { useEffect, useMemo } from "react";
import type { Assignment } from "../v2/model";
import { SYSTEM_ADMIN_ID, SYSTEM_ADMIN_USER, hasPermission, roleOf, teamUserIds, type OrgState, type OrgUser } from "./orgModel";
import { useLiveAppState, useLiveOrgState } from "./liveState";

const SESSION_KEY = "command-center-demo-session";
const BADGE_CLASS = "work-unread-badge";
const ROW_CLASS = "work-unread-row";

function isDiwanUser(org: OrgState, user: OrgUser) {
  const role = roleOf(org, user);
  return role?.key === "diwan" || role?.name?.trim().includes("ديوان") === true;
}

function visibleItems(org: OrgState, user: OrgUser, items: Assignment[]) {
  if (hasPermission(org, user, "view_all_tree")) return items;
  const role = roleOf(org, user);
  if (role?.key === "department_head" && user.departmentId) return items.filter((i) => i.departmentId === user.departmentId);
  if (role?.key === "office_responsible" && user.departmentId) {
    const ids = teamUserIds(org, user);
    return items.filter((i) => (i.kind === "project" && i.departmentId === user.departmentId) || ids.has(i.assigneeId ?? "") || i.ownerId === user.id || i.issuedById === user.id);
  }
  if (hasPermission(org, user, "view_team_tree")) {
    const ids = teamUserIds(org, user);
    return items.filter((i) => ids.has(i.assigneeId ?? "") || i.ownerId === user.id || i.issuedById === user.id);
  }
  if (isDiwanUser(org, user)) return items.filter((i) => i.assigneeId === user.id || i.ownerId === user.id);
  return items.filter((i) => i.assigneeId === user.id || i.ownerId === user.id);
}

function makeBadge(count: number, kind: "nav" | "row") {
  const badge = document.createElement("span");
  badge.className = BADGE_CLASS;
  badge.textContent = count > 99 ? "99+" : String(count);
  badge.setAttribute("aria-label", `${count} تحديثات غير مقروءة`);
  Object.assign(badge.style, {
    display: "inline-grid",
    placeItems: "center",
    minWidth: kind === "nav" ? "22px" : "24px",
    height: kind === "nav" ? "22px" : "24px",
    padding: "0 6px",
    marginInlineStart: "auto",
    borderRadius: "999px",
    background: "rgb(103 232 249)",
    color: "rgb(2 6 23)",
    fontSize: "10px",
    fontWeight: "900",
    lineHeight: "1",
    boxShadow: "0 0 0 3px rgba(34,211,238,.08), 0 0 18px rgba(34,211,238,.24)",
    pointerEvents: "none",
    flexShrink: "0",
  } as Partial<CSSStyleDeclaration>);
  return badge;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export default function WorkUnreadIndicators() {
  const [app, setApp] = useLiveAppState();
  const [org] = useLiveOrgState();
  const sessionUserId = typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null;
  const currentUser = sessionUserId === SYSTEM_ADMIN_ID ? SYSTEM_ADMIN_USER : sessionUserId ? org.users.find((u) => u.id === sessionUserId && u.active) : undefined;
  const items = useMemo(() => currentUser ? visibleItems(org, currentUser, app.tasks) : [], [org, currentUser, app.tasks]);

  const unreadByItem = useMemo(() => {
    const visibleIds = new Set(items.map((item) => item.id));
    const counts = new Map<string, number>();
    if (!currentUser) return counts;
    for (const notice of app.notices) {
      if (notice.userId !== currentUser.id || notice.read || !notice.taskId || !visibleIds.has(notice.taskId)) continue;
      counts.set(notice.taskId, (counts.get(notice.taskId) ?? 0) + 1);
    }
    return counts;
  }, [app.notices, currentUser, items]);

  useEffect(() => {
    if (!currentUser) return;
    let frame = 0;
    let observer: MutationObserver | null = null;

    const clean = () => {
      document.querySelectorAll(`.${BADGE_CLASS}`).forEach((node) => node.remove());
      document.querySelectorAll(`.${ROW_CLASS}`).forEach((node) => {
        node.classList.remove(ROW_CLASS);
        (node as HTMLElement).style.boxShadow = "";
        (node as HTMLElement).style.background = "";
        delete (node as HTMLElement).dataset.unreadWorkId;
      });
    };

    const apply = () => {
      observer?.disconnect();
      clean();

      const projects = items.filter((item) => (item.kind ?? "task") === "project");
      const tasks = items.filter((item) => (item.kind ?? "task") !== "project");
      const projectUnread = projects.reduce((sum, item) => sum + (unreadByItem.get(item.id) ?? 0), 0);
      const taskUnread = tasks.reduce((sum, item) => sum + (unreadByItem.get(item.id) ?? 0), 0);

      const addNavBadge = (label: string, count: number) => {
        if (!count) return;
        document.querySelectorAll("aside button, .fixed.inset-0 button").forEach((button) => {
          const element = button as HTMLButtonElement;
          if (normalizeText(element.textContent) !== label) return;
          element.appendChild(makeBadge(count, "nav"));
        });
      };
      addNavBadge("المشاريع", projectUnread);
      addNavBadge("المهام", taskUnread);

      const main = document.querySelector("main");
      const pageTitle = normalizeText(main?.querySelector("h1")?.textContent);
      const pageKind = pageTitle === "المشاريع" ? "project" : pageTitle === "المهام" ? "task" : null;
      if (main && pageKind) {
        const buttons = [...main.querySelectorAll("button")];
        const pageItems = items.filter((item) => ((item.kind ?? "task") === "project" ? "project" : "task") === pageKind);
        for (const item of pageItems) {
          const count = unreadByItem.get(item.id) ?? 0;
          if (!count) continue;
          const title = normalizeText(item.title);
          const row = buttons.find((button) => normalizeText(button.textContent).includes(title) && button.querySelector("div.min-w-0.flex-1")) as HTMLButtonElement | undefined;
          if (!row) continue;
          row.dataset.unreadWorkId = item.id;
          row.classList.add(ROW_CLASS);
          row.style.background = "rgba(34,211,238,.045)";
          row.style.boxShadow = "inset -3px 0 0 rgba(103,232,249,.82)";
          row.appendChild(makeBadge(count, "row"));
        }
      }

      if (observer) observer.observe(document.body, { childList: true, subtree: true });
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };

    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    window.addEventListener("resize", schedule);

    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button[data-unread-work-id]");
      const workId = button?.dataset.unreadWorkId;
      if (!workId) return;
      setApp((state) => ({
        ...state,
        notices: state.notices.map((notice) => notice.userId === currentUser.id && notice.taskId === workId ? { ...notice, read: true } : notice),
      }));
    };
    document.addEventListener("click", onClick, true);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("click", onClick, true);
      clean();
    };
  }, [currentUser, items, unreadByItem, setApp]);

  return null;
}
