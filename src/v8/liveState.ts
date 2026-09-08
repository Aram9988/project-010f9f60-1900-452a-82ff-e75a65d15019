import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { STORAGE_KEY, makeSeedState, type AppState, type Assignment, type CallRequest, type Notice } from "../v2/model";
import { ORG_STORAGE_KEY, loadOrgState, saveOrgState, type OrgState } from "./orgModel";

const APP_CHANNEL = "rif-dimashq-command-center-app-v1";
const ORG_CHANNEL = "rif-dimashq-command-center-org-v1";
export const WORKSPACE_SYNC_KEY_STORAGE = "rif-dimashq-workspace-sync-key-v1";
const SYNC_ENDPOINT = "https://fxpnnmtlopuunptiaval.supabase.co/functions/v1/workspace-sync";
const POLL_MS = 2000;

type RemotePayload = { app?: AppState; org?: OrgState };
type RemoteSnapshot = { payload?: RemotePayload; revision?: number; updated_at?: string; error?: string };

function byTime(a: string | undefined, b: string | undefined) { return (a ?? "").localeCompare(b ?? ""); }

function repairAssignment(input: Assignment): Assignment {
  const updates = Array.isArray(input.updates) ? [...input.updates] : [];
  const assigneeId = input.assigneeId ?? input.ownerId;
  let status = input.status;
  const statusUpdates = updates.filter((u) => Boolean(u.status)).sort((a, b) => byTime(a.at, b.at));
  const latestStatusUpdate = statusUpdates.length ? statusUpdates[statusUpdates.length - 1] : undefined;
  if (status === "new" && latestStatusUpdate?.status && latestStatusUpdate.status !== "new") status = latestStatusUpdate.status;

  const acceptedUpdate = [...statusUpdates].reverse().find((u) => u.status === "active");
  const acceptedForCurrentAssignee = input.acceptedAssigneeId === assigneeId;
  if (status === "new" && acceptedForCurrentAssignee) status = "active";

  const acceptanceRequired = status === "new" || status === "returned";
  const accepted = !acceptanceRequired;
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
    callRequests: Array.isArray(value.callRequests) ? value.callRequests : [],
  };
}

function mergeNotices(remote: Notice[] = [], local: Notice[] = []) {
  const byId = new Map<string, Notice>();
  [...remote, ...local].forEach((notice) => {
    const previous = byId.get(notice.id);
    if (!previous || byTime(previous.at, notice.at) <= 0) byId.set(notice.id, notice);
  });
  return [...byId.values()].sort((a, b) => byTime(b.at, a.at));
}

function mergeCallRequests(remote: CallRequest[] = [], local: CallRequest[] = []) {
  const byId = new Map<string, CallRequest>();
  [...remote, ...local].forEach((request) => {
    const previous = byId.get(request.id);
    if (!previous) {
      byId.set(request.id, request);
      return;
    }
    const previousResolved = Boolean(previous.resolvedAt) || previous.active === false;
    const requestResolved = Boolean(request.resolvedAt) || request.active === false;
    if (requestResolved && !previousResolved) {
      byId.set(request.id, request);
      return;
    }
    if (requestResolved === previousResolved && byTime(previous.resolvedAt ?? previous.createdAt, request.resolvedAt ?? request.createdAt) <= 0) {
      byId.set(request.id, request);
    }
  });
  return [...byId.values()].sort((a, b) => byTime(b.createdAt, a.createdAt));
}

function mergeAppForSync(remoteValue: Partial<AppState> | AppState, localValue: Partial<AppState> | AppState): AppState {
  const remote = normalizeAppState(remoteValue);
  const local = normalizeAppState(localValue);
  return {
    ...remote,
    currentUserId: local.currentUserId || remote.currentUserId,
    notices: mergeNotices(remote.notices, local.notices),
    callRequests: mergeCallRequests(remote.callRequests ?? [], local.callRequests ?? []),
  };
}

function readStoredAppState(): AppState | null {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? normalizeAppState(JSON.parse(raw) as Partial<AppState>) : null; } catch { return null; }
}
function writeStoredAppState(state: AppState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function syncKey() { return typeof window === "undefined" ? "" : localStorage.getItem(WORKSPACE_SYNC_KEY_STORAGE) ?? ""; }

async function pullRemote(): Promise<RemoteSnapshot | null> {
  const key = syncKey(); if (!key) return null;
  try { const res = await fetch(SYNC_ENDPOINT, { headers: { "x-workspace-key": key } }); if (!res.ok) return null; return await res.json() as RemoteSnapshot; } catch { return null; }
}

async function pushRemotePart(part: "app" | "org", value: AppState | OrgState) {
  const key = syncKey(); if (!key) return;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await pullRemote(); if (!current) return;
    let nextValue: AppState | OrgState = value;
    if (part === "app") {
      const remoteApp = current.payload?.app;
      nextValue = remoteApp ? mergeAppForSync(remoteApp, value as AppState) : normalizeAppState(value as AppState);
    }
    const payload: RemotePayload = { ...(current.payload ?? {}), [part]: nextValue };
    try {
      const res = await fetch(SYNC_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "x-workspace-key": key }, body: JSON.stringify({ payload, revision: current.revision ?? 0 }) });
      if (res.ok) return;
      if (res.status !== 409) return;
    } catch { return; }
  }
}

export async function verifyWorkspaceSyncKey(key: string) {
  try { const res = await fetch(SYNC_ENDPOINT, { headers: { "x-workspace-key": key.trim() } }); return res.ok; } catch { return false; }
}
export function isWorkspaceSyncConfigured() { return Boolean(syncKey()); }

export function useLiveAppState(): [AppState, Dispatch<SetStateAction<AppState>>] {
  const [state, setState] = useState<AppState>(() => readStoredAppState() ?? normalizeAppState(makeSeedState()));
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    const initial = readStoredAppState() ?? state; writeStoredAppState(initial); setState(initial);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(APP_CHANNEL) : null; channelRef.current = channel;
    if (channel) channel.onmessage = (event) => setState(normalizeAppState(event.data as AppState));
    const onStorage = (event: StorageEvent) => { if (event.key !== STORAGE_KEY || !event.newValue) return; try { setState(normalizeAppState(JSON.parse(event.newValue) as Partial<AppState>)); } catch { /* ignore */ } };
    window.addEventListener("storage", onStorage);
    let disposed = false;
    const sync = async () => {
      const remote = await pullRemote();
      if (disposed || !remote) return;
      if (remote.payload?.app) {
        const local = readStoredAppState() ?? initial;
        const next = mergeAppForSync(remote.payload.app, local);
        writeStoredAppState(next);
        setState(next);
        const remoteCalls = remote.payload.app.callRequests ?? [];
        const remoteNotices = remote.payload.app.notices ?? [];
        if (next.callRequests?.length !== remoteCalls.length || next.notices.length !== remoteNotices.length) {
          void pushRemotePart("app", next);
        }
      } else {
        await pushRemotePart("app", initial);
      }
    };
    void sync(); const timer = window.setInterval(() => void sync(), POLL_MS);
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener("storage", onStorage); channel?.close(); channelRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setLiveState = useCallback<Dispatch<SetStateAction<AppState>>>((action) => {
    setState((current) => {
      const base = readStoredAppState() ?? current;
      const proposed = typeof action === "function" ? action(base) : action;
      const next = normalizeAppState(proposed);
      writeStoredAppState(next);
      channelRef.current?.postMessage(next);
      void pushRemotePart("app", next);
      return next;
    });
  }, []);
  return [state, setLiveState];
}

export function useLiveOrgState(): [OrgState, Dispatch<SetStateAction<OrgState>>] {
  const [state, setState] = useState<OrgState>(() => loadOrgState());
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    const initial = loadOrgState();
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(ORG_CHANNEL) : null; channelRef.current = channel;
    if (channel) channel.onmessage = (event) => setState(event.data as OrgState);
    const onStorage = (event: StorageEvent) => { if (event.key !== ORG_STORAGE_KEY || !event.newValue) return; try { setState(JSON.parse(event.newValue) as OrgState); } catch { /* ignore */ } };
    window.addEventListener("storage", onStorage);
    let disposed = false;
    const sync = async () => { const remote = await pullRemote(); if (disposed || !remote) return; if (remote.payload?.org) { saveOrgState(remote.payload.org); setState(remote.payload.org); } else { await pushRemotePart("org", initial); } };
    void sync(); const timer = window.setInterval(() => void sync(), POLL_MS);
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener("storage", onStorage); channel?.close(); channelRef.current = null; };
  }, []);
  const setLiveState = useCallback<Dispatch<SetStateAction<OrgState>>>((action) => {
    setState((current) => { const latest = loadOrgState() ?? current; const next = typeof action === "function" ? action(latest) : action; saveOrgState(next); channelRef.current?.postMessage(next); void pushRemotePart("org", next); return next; });
  }, []);
  return [state, setLiveState];
}
