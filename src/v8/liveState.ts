import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { STORAGE_KEY, makeSeedState, type AppState, type Assignment } from "../v2/model";
import { ORG_STORAGE_KEY, loadOrgState, saveOrgState, type OrgState } from "./orgModel";

const APP_CHANNEL = "rif-dimashq-command-center-app-v1";
const ORG_CHANNEL = "rif-dimashq-command-center-org-v1";

function byTime(a: string | undefined, b: string | undefined) {
  return (a ?? "").localeCompare(b ?? "");
}

function repairAssignment(input: Assignment): Assignment {
  const updates = Array.isArray(input.updates) ? [...input.updates] : [];
  const assigneeId = input.assigneeId ?? input.ownerId;
  let status = input.status;

  // The latest explicit workflow update is authoritative when an old browser tab
  // wrote a stale "new" snapshot after the work had already been accepted.
  const statusUpdates = updates
    .filter((u) => Boolean(u.status))
    .sort((a, b) => byTime(a.at, b.at));
  const latestStatusUpdate = statusUpdates.length ? statusUpdates[statusUpdates.length - 1] : undefined;
  if (status === "new" && latestStatusUpdate?.status && latestStatusUpdate.status !== "new") {
    status = latestStatusUpdate.status;
  }

  const acceptedUpdate = [...statusUpdates].reverse().find((u) => u.status === "active");
  const acceptedForCurrentAssignee = input.acceptedAssigneeId === assigneeId;
  if (status === "new" && acceptedForCurrentAssignee) status = "active";

  const accepted = status !== "new";
  return {
    ...input,
    kind: input.kind ?? "task",
    assigneeId,
    status,
    updates,
    updatedAt: input.updatedAt ?? input.createdAt ?? new Date().toISOString(),
    acceptedAssigneeId: accepted ? (acceptedForCurrentAssignee ? input.acceptedAssigneeId : assigneeId) : undefined,
    acceptedById: accepted ? (acceptedForCurrentAssignee ? input.acceptedById : acceptedUpdate?.authorId ?? assigneeId) : undefined,
    acceptedAt: accepted ? (acceptedForCurrentAssignee ? input.acceptedAt : acceptedUpdate?.at ?? input.updatedAt ?? input.createdAt) : undefined,
  };
}

function normalizeAppState(value: Partial<AppState> | AppState): AppState {
  const seed = makeSeedState();
  return {
    currentUserId: value.currentUserId || seed.currentUserId,
    tasks: Array.isArray(value.tasks) ? value.tasks.map(repairAssignment) : seed.tasks.map(repairAssignment),
    notices: Array.isArray(value.notices) ? value.notices : seed.notices,
  };
}

function readStoredAppState(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeAppState(JSON.parse(raw) as Partial<AppState>) : null;
  } catch {
    return null;
  }
}

function writeStoredAppState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useLiveAppState(): [AppState, Dispatch<SetStateAction<AppState>>] {
  const [state, setState] = useState<AppState>(() => readStoredAppState() ?? normalizeAppState(makeSeedState()));
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const initial = readStoredAppState() ?? state;
    writeStoredAppState(initial);
    setState(initial);

    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(APP_CHANNEL) : null;
    channelRef.current = channel;
    if (channel) channel.onmessage = (event) => setState(normalizeAppState(event.data as AppState));

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try { setState(normalizeAppState(JSON.parse(event.newValue) as Partial<AppState>)); } catch { /* ignore malformed external data */ }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close();
      channelRef.current = null;
    };
    // Initial state is intentionally captured once; all later synchronization is event-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLiveState = useCallback<Dispatch<SetStateAction<AppState>>>((action) => {
    setState((current) => {
      // Always mutate the most recent persisted snapshot, not a stale tab snapshot.
      // This prevents creating a new project from reverting an older accepted project.
      const base = readStoredAppState() ?? current;
      const proposed = typeof action === "function" ? action(base) : action;
      const next = normalizeAppState(proposed);
      writeStoredAppState(next);
      channelRef.current?.postMessage(next);
      return next;
    });
  }, []);

  return [state, setLiveState];
}

export function useLiveOrgState(): [OrgState, Dispatch<SetStateAction<OrgState>>] {
  const [state, setState] = useState<OrgState>(() => loadOrgState());
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(ORG_CHANNEL) : null;
    channelRef.current = channel;
    if (channel) channel.onmessage = (event) => setState(event.data as OrgState);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== ORG_STORAGE_KEY || !event.newValue) return;
      try { setState(JSON.parse(event.newValue) as OrgState); } catch { /* ignore malformed external data */ }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close();
      channelRef.current = null;
    };
  }, []);

  const setLiveState = useCallback<Dispatch<SetStateAction<OrgState>>>((action) => {
    setState(() => {
      const latest = loadOrgState();
      const next = typeof action === "function" ? action(latest) : action;
      saveOrgState(next);
      channelRef.current?.postMessage(next);
      return next;
    });
  }, []);

  return [state, setLiveState];
}
