import { useEffect } from "react";
import { roleOf, SYSTEM_ADMIN_ID, SYSTEM_ADMIN_USER, descendants, type OrgUser } from "./orgModel";
import { useLiveAppState, useLiveOrgState } from "./liveState";

const SESSION_KEY = "command-center-demo-session";
const OVERLAY_ID = "topology-auto-connectors";

function svgEl<T extends keyof SVGElementTagNameMap>(name: T) {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}

function legacyConnectorSvgs() {
  return document.querySelectorAll<SVGElement>(".topology-scroll div.h-24 > svg[aria-hidden='true']");
}

function hasActiveBelow(userId: string, users: OrgUser[], activeAssignees: Set<string>): boolean {
  if (activeAssignees.has(userId)) return true;
  return users.filter((user) => user.active && user.managerId === userId).some((child) => hasActiveBelow(child.id, users, activeAssignees));
}

export default function TopologyAutoConnectors() {
  const [org] = useLiveOrgState();
  const [app] = useLiveAppState();

  useEffect(() => {
    let frame = 0;
    let observer: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const cleanupOverlay = () => {
      document.getElementById(OVERLAY_ID)?.remove();
      legacyConnectorSvgs().forEach((svg) => { svg.style.opacity = ""; });
    };

    const render = () => {
      observer?.disconnect();
      resizeObserver?.disconnect();
      document.getElementById(OVERLAY_ID)?.remove();

      const viewport = document.querySelector<HTMLElement>(".topology-scroll");
      const content = viewport?.firstElementChild as HTMLElement | null;
      if (!viewport || !content) {
        if (observer) observer.observe(document.body, { childList: true, subtree: true });
        return;
      }

      // The built-in connector fan reserves vertical spacing, but the lines themselves are
      // hidden. We draw one measured overlay instead, based on the actual card positions.
      // This avoids RTL ordering mismatches and stays correct when subtrees grow or shrink.
      legacyConnectorSvgs().forEach((svg) => { svg.style.opacity = "0"; });
      if (getComputedStyle(content).position === "static") content.style.position = "relative";

      const sessionId = sessionStorage.getItem(SESSION_KEY);
      const current = sessionId === SYSTEM_ADMIN_ID ? SYSTEM_ADMIN_USER : sessionId ? org.users.find((user) => user.id === sessionId && user.active) : undefined;
      if (!current) return;
      const currentRole = roleOf(org, current);
      const branchHead = org.users.find((user) => user.active && roleOf(org, user)?.key === "branch_head");
      const root = currentRole?.key === "branch_head" ? branchHead ?? current : current;
      const visibleUsers = [root, ...descendants(org, root.id)].filter((user) => user.active);
      const visibleIds = new Set(visibleUsers.map((user) => user.id));

      const cards = [...content.querySelectorAll<HTMLElement>(".topology-person-node")];
      if (!cards.length) return;
      const cardMap = new Map<string, HTMLElement>();
      const unused = new Set(cards);
      const byNameLength = [...visibleUsers].sort((a, b) => b.name.length - a.name.length);
      for (const user of byNameLength) {
        const card = [...unused].find((candidate) => (candidate.textContent ?? "").includes(user.name));
        if (!card) continue;
        cardMap.set(user.id, card);
        unused.delete(card);
      }

      const contentRect = content.getBoundingClientRect();
      const scaleX = content.offsetWidth ? contentRect.width / content.offsetWidth : 1;
      const scaleY = content.offsetHeight ? contentRect.height / content.offsetHeight : scaleX;
      const width = Math.max(content.scrollWidth, content.offsetWidth, 1);
      const height = Math.max(content.scrollHeight, content.offsetHeight, 1);

      const svg = svgEl("svg");
      svg.id = OVERLAY_ID;
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svg.setAttribute("aria-hidden", "true");
      Object.assign(svg.style, {
        position: "absolute",
        inset: "0",
        width: `${width}px`,
        height: `${height}px`,
        overflow: "visible",
        pointerEvents: "none",
        zIndex: "1",
      } as Partial<CSSStyleDeclaration>);

      const activeAssignees = new Set(app.tasks.filter((item) => !item.archivedAt && item.status === "active").map((item) => item.assigneeId ?? item.ownerId).filter(Boolean) as string[]);

      for (const child of visibleUsers) {
        if (!child.managerId || !visibleIds.has(child.managerId)) continue;
        const parentCard = cardMap.get(child.managerId);
        const childCard = cardMap.get(child.id);
        if (!parentCard || !childCard) continue;
        const p = parentCard.getBoundingClientRect();
        const c = childCard.getBoundingClientRect();
        const startX = (p.left + p.width / 2 - contentRect.left) / (scaleX || 1);
        const startY = (p.bottom - contentRect.top) / (scaleY || 1);
        const endX = (c.left + c.width / 2 - contentRect.left) / (scaleX || 1);
        const endY = (c.top - contentRect.top) / (scaleY || 1);
        if (!Number.isFinite(startX + startY + endX + endY) || endY <= startY + 4) continue;

        const distanceY = endY - startY;
        const controlY = startY + Math.max(36, Math.min(distanceY * 0.48, 105));
        const d = `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`;
        const active = hasActiveBelow(child.id, visibleUsers, activeAssignees);

        const base = svgEl("path");
        base.setAttribute("d", d);
        base.setAttribute("fill", "none");
        base.setAttribute("stroke", active ? "rgba(103,232,249,.34)" : "rgba(103,232,249,.18)");
        base.setAttribute("stroke-width", active ? "1.55" : "1.1");
        base.setAttribute("stroke-linecap", "round");
        base.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(base);

        if (active) {
          [0, 1].forEach((index) => {
            const dot = svgEl("circle");
            dot.setAttribute("r", index === 0 ? "2.2" : "1.5");
            dot.setAttribute("fill", index === 0 ? "rgba(103,232,249,.98)" : "rgba(52,211,153,.9)");
            dot.setAttribute("filter", "drop-shadow(0 0 4px rgba(103,232,249,.85))");
            const motion = svgEl("animateMotion");
            // The path is always built from parent -> child, so the pulse is guaranteed
            // to travel from the manager downward to the active member.
            motion.setAttribute("path", d);
            motion.setAttribute("dur", "4.8s");
            motion.setAttribute("begin", index === 0 ? "0s" : "-2.4s");
            motion.setAttribute("repeatCount", "indefinite");
            motion.setAttribute("rotate", "auto");
            dot.appendChild(motion);
            svg.appendChild(dot);
          });
        }
      }

      content.prepend(svg);
      resizeObserver = new ResizeObserver(() => schedule());
      resizeObserver.observe(content);
      cards.forEach((card) => resizeObserver?.observe(card));
      if (observer) observer.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };

    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    const interval = window.setInterval(schedule, 1400);
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      observer?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      cleanupOverlay();
    };
  }, [org, app.tasks]);

  return null;
}
