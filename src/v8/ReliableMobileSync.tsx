import { useEffect, useRef } from "react";
import type { AppState, Assignment, Notice } from "../v2/model";
import { useLiveAppState, WORKSPACE_SYNC_KEY_STORAGE } from "./liveState";

const SYNC_ENDPOINT = "https://fxpnnmtlopuunptiaval.supabase.co/functions/v1/workspace-sync";

type Snapshot = { tasks: Map<string, string>; notices: Set<string> };

function taskSignature(task: Assignment) {
  const last = task.updates[task.updates.length - 1];
  return `${task.updatedAt}|${task.status}|${task.updates.length}|${last?.id ?? ""}|${last?.editedAt ?? last?.at ?? ""}`;
}

function makeSnapshot(state: AppState): Snapshot {
  return {
    tasks: new Map(state.tasks.map((task) => [task.id, taskSignature(task)])),
    notices: new Set(state.notices.map((notice) => notice.id)),
  };
}

async function pushDelta(tasks: Assignment[], notices: Notice[]) {
  if (typeof window === "undefined" || (!tasks.length && !notices.length)) return;
  const key = localStorage.getItem(WORKSPACE_SYNC_KEY_STORAGE) ?? "";
  if (!key) return;
  const body = JSON.stringify({ tasks, notices });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(`${SYNC_ENDPOINT}?merge-app-delta=1&_=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        keepalive: body.length < 60_000,
        headers: { "Content-Type": "application/json", "x-workspace-key": key },
        body,
      });
      if (response.ok) return;
    } catch { /* retry below */ }
    await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1)));
  }
}

export default function ReliableMobileSync() {
  const [app] = useLiveAppState();
  const previous = useRef<Snapshot | null>(null);
  const pendingTasks = useRef(new Map<string, Assignment>());
  const pendingNotices = useRef(new Map<string, Notice>());
  const flushing = useRef(false);

  useEffect(() => {
    const before = previous.current;
    const current = makeSnapshot(app);
    if (!before) { previous.current = current; return; }

    for (const task of app.tasks) {
      if (before.tasks.get(task.id) !== taskSignature(task)) pendingTasks.current.set(task.id, task);
    }
    for (const notice of app.notices) {
      if (!before.notices.has(notice.id)) pendingNotices.current.set(notice.id, notice);
    }
    previous.current = current;

    const flush = async () => {
      if (flushing.current || (!pendingTasks.current.size && !pendingNotices.current.size)) return;
      flushing.current = true;
      const tasks = [...pendingTasks.current.values()];
      const notices = [...pendingNotices.current.values()];
      try {
        await pushDelta(tasks, notices);
        tasks.forEach((task) => pendingTasks.current.delete(task.id));
        notices.forEach((notice) => pendingNotices.current.delete(notice.id));
      } finally { flushing.current = false; }
    };

    void flush();
    const retry = window.setTimeout(() => void flush(), 1800);
    return () => window.clearTimeout(retry);
  }, [app.tasks, app.notices]);

  useEffect(() => {
    const flushPending = () => {
      if (!pendingTasks.current.size && !pendingNotices.current.size) return;
      void pushDelta([...pendingTasks.current.values()], [...pendingNotices.current.values()]);
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flushPending(); };
    window.addEventListener("pagehide", flushPending);
    window.addEventListener("online", flushPending);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushPending);
      window.removeEventListener("online", flushPending);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
