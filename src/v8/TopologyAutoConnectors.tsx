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

function showLegacyConnectors() {
  legacyConnectorSvgs().forEach((svg) => {
    svg.style.opacity = "";
    svg.style.visibility = "";
  });
}

function hideLegacyConnectors() {
  legacyConnectorSvgs().forEach((svg) => {
    svg.style.opacity = "0";
    svg.style.visibility = "hidden";
  });
}

function hasActiveBelow(userId: string, users: OrgUser[], activeAssignees: Set<string>, seen = new Set<string>()): boolean {
  if (seen.has(userId)) return false;
  seen.add(userId);
  if (activeAssignees.has(userId)) return true;
  return users
    .filter((user) => user.active && user.managerId === userId)
    .some((child) => hasActiveBelow(child.id, users, activeAssignees, seen));
}

export default function TopologyAutoConnectors() {
  const [org] = useLiveOrgState();
  const [app] = useLiveAppState();

  useEffect(() => {
    let frame = 0;
    let observer: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let interval = 0;

    const cleanupOverlay = () => {
      document.getElementById(OVERLAY_ID)?.remove();
      showLegacyConnectors();
    };

    const render = () => {
      observer?.disconnect();
      resizeObserver?.disconnect();
      document.getElementById(OVERLAY_ID)?.remove();

      const viewport = document.querySelector<HTMLElement>(".topology-scroll");
      const content = viewport?.firstElementChild as HTMLElement | null;
      if (!viewport || !content) {
        showLegacyConnectors();
        observer?.observe(document.body, { childList: true, subtree: true });
        return;
      }

      if (getComputedStyle(content).position === "static") content.style.position = "relative";

      const sessionId = sessionStorage.getItem(SESSION_KEY);
      const current = sessionId === SYSTEM_ADMIN_ID
        ? SYSTEM_ADMIN_USER
        : sessionId
          ? org.users.find((user) => user.id === sessionId && user.active)
          : undefined;
      if (!current) {
        showLegacyConnectors();
        observer?.observe(document.body, { childList: true, subtree: true });
        return;
      }

      const currentRole = roleOf(org, current);
      const branchHead = org.users.find((user) => user.active && roleOf(org, user)?.key === "branch_head");
      const root = currentRole?.key === "branch_head" ? branchHead ?? current : current;
      const visibleUsers = [root, ...descendants(org, root.id)].filter((user) => user.active);
      const visibleIds = new Set(visibleUsers.map((user) => user.id));
      const expectedEdges = visibleUsers.filter((user) => !!user.managerId && visibleIds.has(user.managerId)).length;

      // TeamTree renders cards in the same preorder as descendants(). Mapping by DOM order is
      // deterministic and avoids Arabic-name substring collisions that previously attached a
      // manager to the wrong card or caused a whole active path to disappear.
      const cards = [...content.querySelectorAll<HTMLElement>(".topology-person-node")];
      if (!cards.length || cards.length !== visibleUsers.length) {
        showLegacyConnectors();
        observer?.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
        return;
      }

      const cardMap = new Map<string, HTMLElement>();
      visibleUsers.forEach((user, index) => cardMap.set(user.id, cards[index]));

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
        zIndex: "4",
      } as Partial<CSSStyleDeclaration>);

      const activeAssignees = new Set(
        app.tasks
          .filter((item) => !item.archivedAt && item.status === "active")
          .map((item) => item.assigneeId ?? item.ownerId)
          .filter(Boolean) as string[],
      );

      let drawnEdges = 0;
      for (const child of visibleUsers) {
        if (!child.managerId || !visibleIds.has(child.managerId)) continue;
        const parentCard = cardMap.get(child.managerId);
        const childCard = cardMap.get(child.id);
        if (!parentCard || !childCard) continue;

        const p = parentCard.getBoundingClientRect();
        const c = childCard.getBoundingClientRect();
        const sx = scaleX || 1;
        const sy = scaleY || sx;
        const startX = (p.left + p.width / 2 - contentRect.left) / sx;
        const startY = (p.bottom - contentRect.top) / sy;
        const endX = (c.left + c.width / 2 - contentRect.left) / sx;
        const endY = (c.top - contentRect.top) / sy;
        if (!Number.isFinite(startX + startY + endX + endY) || endY <= startY + 2) continue;

        const distanceY = endY - startY;
        const horizontalDistance = Math.abs(endX - startX);
        const firstControlY = startY + Math.max(34, Math.min(distanceY * 0.38, 100));
        const secondControlY = endY - Math.max(30, Math.min(distanceY * 0.32, 92));
        const horizontalBias = Math.min(horizontalDistance * 0.12, 56);
        const control1X = startX + (endX > startX ? horizontalBias : -horizontalBias);
        const control2X = endX - (endX > startX ? horizontalBias : -horizontalBias);
        const d = `M ${startX} ${startY} C ${control1X} ${firstControlY}, ${control2X} ${secondControlY}, ${endX} ${endY}`;
        const active = hasActiveBelow(child.id, visibleUsers, activeAssignees);

        const base = svgEl("path");
        base.setAttribute("d", d);
        base.setAttribute("fill", "none");
        base.setAttribute("stroke", active ? "rgba(103,232,249,.48)" : "rgba(103,232,249,.20)");
        base.setAttribute("stroke-width", active ? "1.8" : "1.15");
        base.setAttribute("stroke-linecap", "round");
        base.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(base);

        if (active) {
          const glow = svgEl("path");
          glow.setAttribute("d", d);
          glow.setAttribute("fill", "none");
          glow.setAttribute("stroke", "rgba(199,178,122,.26)");
          glow.setAttribute("stroke-width", "6");
          glow.setAttribute("stroke-linecap", "round");
          glow.setAttribute("vector-effect", "non-scaling-stroke");
          glow.setAttribute("filter", "blur(2.4px)");
          svg.insertBefore(glow, base);

          // A bright travelling wave remains visible even on browsers where SVG animateMotion
          // can be throttled. The dash offset moves from the manager toward the active person.
          const wave = svgEl("path");
          wave.setAttribute("d", d);
          wave.setAttribute("fill", "none");
          wave.setAttribute("stroke", "rgba(216,200,148,.98)");
          wave.setAttribute("stroke-width", "2.7");
          wave.setAttribute("stroke-linecap", "round");
          wave.setAttribute("vector-effect", "non-scaling-stroke");
          wave.setAttribute("filter", "drop-shadow(0 0 5px rgba(188,168,117,.9))");
          wave.setAttribute("class", "topology-auto-wave");
          svg.appendChild(wave);

          [0, 1].forEach((index) => {
            const dot = svgEl("circle");
            dot.setAttribute("r", index === 0 ? "3" : "2");
            dot.setAttribute("fill", index === 0 ? "rgba(224,205,153,.98)" : "rgba(52,211,153,.96)");
            dot.setAttribute("filter", "drop-shadow(0 0 6px rgba(199,178,122,.95))");
            const motion = svgEl("animateMotion");
            motion.setAttribute("path", d);
            motion.setAttribute("dur", "4.8s");
            motion.setAttribute("begin", index === 0 ? "0s" : "-2.4s");
            motion.setAttribute("repeatCount", "indefinite");
            motion.setAttribute("rotate", "auto");
            dot.appendChild(motion);
            svg.appendChild(dot);
          });
        }

        drawnEdges += 1;
      }

      // Never leave the tree without connectors. If measurement is incomplete for any reason,
      // discard the overlay and immediately fall back to TeamTree's built-in curves.
      if (drawnEdges !== expectedEdges) {
        svg.remove();
        showLegacyConnectors();
      } else {
        content.prepend(svg);
        hideLegacyConnectors();
      }

      resizeObserver = new ResizeObserver(() => schedule());
      resizeObserver.observe(content);
      cards.forEach((card) => resizeObserver?.observe(card));
      observer?.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };

    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    window.addEventListener("fullscreenchange", schedule);
    interval = window.setInterval(schedule, 1200);
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      observer?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.removeEventListener("fullscreenchange", schedule);
      cleanupOverlay();
    };
  }, [org, app.tasks]);

  return null;
}
