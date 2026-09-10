import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { STORAGE_KEY, makeSeedState, type AppState, type Assignment, type CallRequest, type Notice, type UpdateEntry } from "../v2/model";
import { ORG_STORAGE_KEY, loadOrgState, normalizeOrgState, saveOrgState, type OrgDepartment, type OrgOffice, type OrgRole, type OrgState, type OrgUser } from "./orgModel";

const APP_CHANNEL = "rif-dimashq-command-center-app-v1";
const ORG_CHANNEL = "rif-dimashq-command-center-org-v1";
const CALL_STORAGE_KEY = "rif-dimashq-call-requests-v1";
export const WORKSPACE_SYNC_KEY_STORAGE = "rif-dimashq-workspace-sync-key-v1";
const SYNC_ENDPOINT = "https://fxpnnmtlopuunptiaval.supabase.co/functions/v1/workspace-sync";
const POLL_MS = 1500;

// These IDs existed only in the original public demo. They are permanently tombstoned.
const LEGACY_DEMO_WORK_IDS = new Set(["a-1", "a-2", "a-3", "a-4", "a-5"]);
const LEGACY_DEMO_USER_IDS = new Set(["admin-1", "diwan-1", "employee-studies", "head-networks", "head-support", "head-systems", "office-networks", "office-studies", "vehicles-1"]);
const LEGACY_DEMO_DEPARTMENT_IDS = new Set(["networks", "support", "systems"]);
const LEGACY_DEMO_OFFICE_IDS = new Set(["office-networks-1", "office-studies-1"]);

type RemotePayload = { app?: AppState; org?: OrgState };
type RemoteSnapshot = { payload?: RemotePayload; revision?: number; updated_at?: string; error?: string };
type VersionedEntity = { id: string; updatedAt?: string };

function byTime(a: string | undefined, b: string | undefined) { return (a ?? "").localeCompare(b ?? ""); }
function unique(values: string[] = []) { return [...new Set(values.filter(Boolean))]; }
function unionIds(...lists: (string[] | undefined)[]) { return unique(lists.flatMap((list) => list ?? [])); }

function repairAssignment(input: Assignment, deletedUpdateIds = new Set<string>()): Assignment {
  const updates = Array.isArray(input.updates) ? input.updates.filter((u) => !deletedUpdateIds.has(u.id)) : [];
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
  const deletedTaskIds = unionIds(value.deletedTaskIds, [...LEGACY_DEMO_WORK_IDS]);
  const deletedUpdateIds = unique(value.deletedUpdateIds);
  const deletedTasks = new Set(deletedTaskIds);
  const deletedUpdates = new Set(deletedUpdateIds);
  const sourceTasks = Array.isArray(value.tasks) ? value.tasks : seed.tasks;
  const sourceNotices = Array.isArray(value.notices) ? value.notices : seed.notices;
  return {
    currentUserId: value.currentUserId || seed.currentUserId,
    tasks: sourceTasks.filter((item) => !deletedTasks.has(item.id)).map((item) => repairAssignment(item, deletedUpdates)),
    notices: sourceNotices.filter((notice) => !notice.taskId || !deletedTasks.has(notice.taskId)),
    callRequests: Array.isArray(value.callRequests) ? value.callRequests : [],
    deletedTaskIds,
    deletedUpdateIds,
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
    if (!previous) { byId.set(request.id, request); return; }
    const previousResolved = Boolean(previous.resolvedAt) || previous.active === false;
    const requestResolved = Boolean(request.resolvedAt) || request.active === false;
    if (requestResolved && !previousResolved) { byId.set(request.id, request); return; }
    if (requestResolved === previousResolved && byTime(previous.resolvedAt ?? previous.createdAt, request.resolvedAt ?? request.createdAt) <= 0) byId.set(request.id, request);
  });
  return [...byId.values()].sort((a, b) => byTime(b.createdAt, a.createdAt));
}

function updateVersion(update: UpdateEntry) { return update.editedAt ?? update.at; }

function mergeUpdates(remote: UpdateEntry[] = [], local: UpdateEntry[] = [], deleted = new Set<string>()) {
  const byId = new Map<string, UpdateEntry>();
  [...remote, ...local].forEach((update) => {
    if (deleted.has(update.id)) return;
    const previous = byId.get(update.id);
    if (!previous || byTime(updateVersion(previous), updateVersion(update)) <= 0) byId.set(update.id, update);
  });
  return [...byId.values()].sort((a, b) => byTime(a.at, b.at));
}

function mergeAssignments(remote: Assignment[] = [], local: Assignment[] = [], deletedTasks = new Set<string>(), deletedUpdates = new Set<string>()) {
  const remoteById = new Map(remote.filter((item) => !deletedTasks.has(item.id)).map((item) => [item.id, repairAssignment(item, deletedUpdates)]));
  const localById = new Map(local.filter((item) => !deletedTasks.has(item.id)).map((item) => [item.id, repairAssignment(item, deletedUpdates)]));
  const ids = new Set([...remoteById.keys(), ...localById.keys()]);
  const merged: Assignment[] = [];

  ids.forEach((id) => {
    if (deletedTasks.has(id)) return;
    const remoteItem = remoteById.get(id);
    const localItem = localById.get(id);
    if (!remoteItem) { if (localItem) merged.push(localItem); return; }
    if (!localItem) { merged.push(remoteItem); return; }

    const localIsNewer = byTime(remoteItem.updatedAt, localItem.updatedAt) <= 0;
    const newer = localIsNewer ? localItem : remoteItem;
    const older = localIsNewer ? remoteItem : localItem;
    const updates = mergeUpdates(remoteItem.updates, localItem.updates, deletedUpdates);
    const latestUpdateAt = updates.length ? updates[updates.length - 1].editedAt ?? updates[updates.length - 1].at : undefined;
    const updatedAt = [newer.updatedAt, older.updatedAt, latestUpdateAt].filter(Boolean).sort().at(-1) ?? newer.updatedAt;
    merged.push(repairAssignment({ ...older, ...newer, updates, updatedAt }, deletedUpdates));
  });

  return merged.sort((a, b) => byTime(b.updatedAt, a.updatedAt));
}

function mergeAppForSync(remoteValue: Partial<AppState> | AppState, localValue: Partial<AppState> | AppState): AppState {
  const remote = normalizeAppState(remoteValue);
  const local = normalizeAppState(localValue);
  const deletedTaskIds = unionIds(remote.deletedTaskIds, local.deletedTaskIds, [...LEGACY_DEMO_WORK_IDS]);
  const deletedUpdateIds = unionIds(remote.deletedUpdateIds, local.deletedUpdateIds);
  const deletedTasks = new Set(deletedTaskIds);
  const deletedUpdates = new Set(deletedUpdateIds);
  return {
    ...remote,
    currentUserId: local.currentUserId || remote.currentUserId,
    tasks: mergeAssignments(remote.tasks, local.tasks, deletedTasks, deletedUpdates),
    notices: mergeNotices(remote.notices, local.notices).filter((notice) => !notice.taskId || !deletedTasks.has(notice.taskId)),
    callRequests: mergeCallRequests(remote.callRequests ?? [], local.callRequests ?? []),
    deletedTaskIds,
    deletedUpdateIds,
  };
}

function mergeEntityById<T extends VersionedEntity>(remote: T[] = [], local: T[] = [], deleted = new Set<string>()) {
  const byId = new Map<string, T>();
  remote.forEach((item) => { if (!deleted.has(item.id)) byId.set(item.id, item); });
  local.forEach((item) => {
    if (deleted.has(item.id)) return;
    const previous = byId.get(item.id);
    if (!previous || byTime(previous.updatedAt, item.updatedAt) < 0) byId.set(item.id, item);
  });
  return [...byId.values()];
}

function cleanLegacyOrg(value: OrgState): OrgState {
  return normalizeOrgState({
    ...value,
    deletedUserIds: unionIds(value.deletedUserIds, [...LEGACY_DEMO_USER_IDS]),
    deletedDepartmentIds: unionIds(value.deletedDepartmentIds, [...LEGACY_DEMO_DEPARTMENT_IDS]),
    deletedOfficeIds: unionIds(value.deletedOfficeIds, [...LEGACY_DEMO_OFFICE_IDS]),
  });
}

function mergeOrgForSync(remoteValue: OrgState, localValue: OrgState): OrgState {
  const remote = cleanLegacyOrg(normalizeOrgState(remoteValue));
  const local = cleanLegacyOrg(normalizeOrgState(localValue));
  const deletedUserIds = unionIds(remote.deletedUserIds, local.deletedUserIds, [...LEGACY_DEMO_USER_IDS]);
  const deletedRoleIds = unionIds(remote.deletedRoleIds, local.deletedRoleIds);
  const deletedDepartmentIds = unionIds(remote.deletedDepartmentIds, local.deletedDepartmentIds, [...LEGACY_DEMO_DEPARTMENT_IDS]);
  const deletedOfficeIds = unionIds(remote.deletedOfficeIds, local.deletedOfficeIds, [...LEGACY_DEMO_OFFICE_IDS]);
  const deletedUsers = new Set(deletedUserIds);
  const deletedRoles = new Set(deletedRoleIds);
  const deletedDepartments = new Set(deletedDepartmentIds);
  const deletedOffices = new Set(deletedOfficeIds);

  return normalizeOrgState({
    ...remote,
    branchName: local.branchName || remote.branchName,
    roles: mergeEntityById<OrgRole>(remote.roles, local.roles, deletedRoles),
    departments: mergeEntityById<OrgDepartment>(remote.departments, local.departments, deletedDepartments),
    offices: mergeEntityById<OrgOffice>(remote.offices, local.offices, deletedOffices).filter((o) => !deletedDepartments.has(o.departmentId)),
    users: mergeEntityById<OrgUser>(remote.users, local.users, deletedUsers),
    deletedUserIds,
    deletedRoleIds,
    deletedDepartmentIds,
    deletedOfficeIds,
  });
}

function readCallStorage(): CallRequest[] {
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(CALL_STORAGE_KEY); return raw ? JSON.parse(raw) as CallRequest[] : []; } catch { return []; }
}

function writeCallStorage(calls: CallRequest[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CALL_STORAGE_KEY, JSON.stringify(calls));
  window.dispatchEvent(new Event("workspace-call-sync"));
}

function mergeTreeCallsIntoApp(appValue: AppState): AppState {
  const treeCalls = readCallStorage();
  if (!treeCalls.length) return appValue;
  const existingById = new Map((appValue.callRequests ?? []).map((call) => [call.id, call]));
  const newNotices: Notice[] = [];
  treeCalls.forEach((call) => {
    const existing = existingById.get(call.id);
    if (!existing) newNotices.push({ id: `notice-${call.id}`, userId: call.toUserId, text: "لديك طلب اتصال جديد.", at: call.createdAt, read: false });
    else if (existing.active && call.active === false) newNotices.push({ id: `notice-resolved-${call.id}`, userId: call.fromUserId, text: "تم إنهاء طلب الاتصال.", at: new Date().toISOString(), read: false });
  });
  return { ...appValue, callRequests: mergeCallRequests(appValue.callRequests ?? [], treeCalls), notices: mergeNotices(appValue.notices, newNotices) };
}

function readStoredAppState(): AppState | null {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? normalizeAppState(JSON.parse(raw) as Partial<AppState>) : null; } catch { return null; }
}
function writeStoredAppState(state: AppState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAppState(state))); }
function syncKey() { return typeof window === "undefined" ? "" : localStorage.getItem(WORKSPACE_SYNC_KEY_STORAGE) ?? ""; }

async function pullRemote(): Promise<RemoteSnapshot | null> {
  const key = syncKey(); if (!key) return null;
  try {
    const url = `${SYNC_ENDPOINT}?state=1&_=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store", headers: { "x-workspace-key": key } });
    if (!res.ok) return null;
    return await res.json() as RemoteSnapshot;
  } catch { return null; }
}

async function pushRemotePart(part: "app" | "org", value: AppState | OrgState) {
  const key = syncKey(); if (!key) return;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await pullRemote(); if (!current) return;
    let nextValue: AppState | OrgState = value;
    if (part === "app") {
      const localApp = mergeTreeCallsIntoApp(value as AppState);
      const remoteApp = current.payload?.app;
      nextValue = remoteApp ? mergeAppForSync(remoteApp, localApp) : normalizeAppState(localApp);
    } else {
      const remoteOrg = current.payload?.org;
      nextValue = remoteOrg ? mergeOrgForSync(remoteOrg, value as OrgState) : cleanLegacyOrg(normalizeOrgState(value as OrgState));
    }
    const payload: RemotePayload = { ...(current.payload ?? {}), [part]: nextValue };
    try {
      const res = await fetch(SYNC_ENDPOINT, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", "x-workspace-key": key }, body: JSON.stringify({ payload, revision: current.revision ?? 0 }) });
      if (res.ok) return;
      if (res.status !== 409) return;
    } catch { return; }
  }
}

export async function verifyWorkspaceSyncKey(key: string) {
  try {
    const res = await fetch(`${SYNC_ENDPOINT}?verify=1&_=${Date.now()}`, { cache: "no-store", headers: { "x-workspace-key": key.trim() } });
    return res.ok;
  } catch { return false; }
}
export function isWorkspaceSyncConfigured() { return Boolean(syncKey()); }

function detectAppDeletions(before: AppState, after: AppState): AppState {
  const removedTasks = before.tasks.filter((item) => !after.tasks.some((candidate) => candidate.id === item.id)).map((item) => item.id);
  const removedUpdates: string[] = [];
  before.tasks.forEach((item) => {
    const nextItem = after.tasks.find((candidate) => candidate.id === item.id);
    if (!nextItem) return;
    item.updates.forEach((update) => { if (!nextItem.updates.some((candidate) => candidate.id === update.id)) removedUpdates.push(update.id); });
  });
  return normalizeAppState({
    ...after,
    deletedTaskIds: unionIds(before.deletedTaskIds, after.deletedTaskIds, removedTasks),
    deletedUpdateIds: unionIds(before.deletedUpdateIds, after.deletedUpdateIds, removedUpdates),
  });
}

function stampChangedEntities<T extends VersionedEntity>(before: T[], after: T[], at: string): T[] {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  return after.map((item) => {
    const previous = beforeById.get(item.id);
    if (!previous) return { ...item, updatedAt: at };
    const previousComparable = { ...previous, updatedAt: undefined };
    const nextComparable = { ...item, updatedAt: undefined };
    return JSON.stringify(previousComparable) === JSON.stringify(nextComparable) ? item : { ...item, updatedAt: at };
  });
}

function detectOrgChanges(beforeValue: OrgState, afterValue: OrgState): OrgState {
  const before = cleanLegacyOrg(normalizeOrgState(beforeValue));
  const after = cleanLegacyOrg(normalizeOrgState(afterValue));
  const at = new Date().toISOString();
  const removedUsers = before.users.filter((item) => !after.users.some((candidate) => candidate.id === item.id)).map((item) => item.id);
  const removedRoles = before.roles.filter((item) => !after.roles.some((candidate) => candidate.id === item.id)).map((item) => item.id);
  const removedDepartments = before.departments.filter((item) => !after.departments.some((candidate) => candidate.id === item.id)).map((item) => item.id);
  const removedOffices = before.offices.filter((item) => !after.offices.some((candidate) => candidate.id === item.id)).map((item) => item.id);

  return cleanLegacyOrg(normalizeOrgState({
    ...after,
    roles: stampChangedEntities(before.roles, after.roles, at),
    departments: stampChangedEntities(before.departments, after.departments, at),
    offices: stampChangedEntities(before.offices, after.offices, at),
    users: stampChangedEntities(before.users, after.users, at),
    deletedUserIds: unionIds(before.deletedUserIds, after.deletedUserIds, removedUsers),
    deletedRoleIds: unionIds(before.deletedRoleIds, after.deletedRoleIds, removedRoles),
    deletedDepartmentIds: unionIds(before.deletedDepartmentIds, after.deletedDepartmentIds, removedDepartments),
    deletedOfficeIds: unionIds(before.deletedOfficeIds, after.deletedOfficeIds, removedOffices),
  }));
}

export function useLiveAppState(): [AppState, Dispatch<SetStateAction<AppState>>] {
  const [state, setState] = useState<AppState>(() => mergeTreeCallsIntoApp(readStoredAppState() ?? normalizeAppState(makeSeedState())));
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    const initial = mergeTreeCallsIntoApp(readStoredAppState() ?? state);
    writeStoredAppState(initial);
    writeCallStorage(initial.callRequests ?? []);
    setState(initial);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(APP_CHANNEL) : null; channelRef.current = channel;
    if (channel) channel.onmessage = (event) => {
      const incoming = normalizeAppState(event.data as AppState);
      const next = mergeAppForSync(incoming, readStoredAppState() ?? initial);
      writeStoredAppState(next);
      writeCallStorage(next.callRequests ?? []);
      setState(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const incoming = normalizeAppState(JSON.parse(event.newValue) as Partial<AppState>);
          const next = mergeAppForSync(incoming, readStoredAppState() ?? initial);
          writeCallStorage(next.callRequests ?? []);
          setState(next);
        } catch { /* ignore */ }
      }
      if (event.key === CALL_STORAGE_KEY) {
        const base = readStoredAppState() ?? initial;
        const next = mergeTreeCallsIntoApp(base);
        writeStoredAppState(next);
        setState(next);
        void pushRemotePart("app", next);
      }
    };
    window.addEventListener("storage", onStorage);
    let disposed = false;
    let syncing = false;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        const remote = await pullRemote();
        if (disposed || !remote) return;
        if (remote.payload?.app) {
          const local = mergeTreeCallsIntoApp(readStoredAppState() ?? initial);
          const next = mergeAppForSync(remote.payload.app, local);
          writeStoredAppState(next);
          writeCallStorage(next.callRequests ?? []);
          setState(next);
          const remoteNormalized = normalizeAppState(remote.payload.app);
          if (JSON.stringify(next) !== JSON.stringify(remoteNormalized)) void pushRemotePart("app", next);
        } else {
          await pushRemotePart("app", initial);
        }
      } finally { syncing = false; }
    };
    const syncWhenVisible = () => { if (document.visibilityState === "visible") void sync(); };
    const syncWhenOnline = () => void sync();
    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("online", syncWhenOnline);
    window.addEventListener("focus", syncWhenOnline);
    void sync(); const timer = window.setInterval(() => void sync(), POLL_MS);
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener("storage", onStorage); document.removeEventListener("visibilitychange", syncWhenVisible); window.removeEventListener("online", syncWhenOnline); window.removeEventListener("focus", syncWhenOnline); channel?.close(); channelRef.current = null; };
  }, []);
  const setLiveState = useCallback<Dispatch<SetStateAction<AppState>>>((action) => {
    setState((current) => {
      const base = mergeTreeCallsIntoApp(readStoredAppState() ?? current);
      const proposed = typeof action === "function" ? action(base) : action;
      const next = mergeTreeCallsIntoApp(detectAppDeletions(base, normalizeAppState(proposed)));
      writeStoredAppState(next);
      writeCallStorage(next.callRequests ?? []);
      channelRef.current?.postMessage(next);
      void pushRemotePart("app", next);
      return next;
    });
  }, []);
  return [state, setLiveState];
}

export function useLiveOrgState(): [OrgState, Dispatch<SetStateAction<OrgState>>] {
  const [state, setState] = useState<OrgState>(() => cleanLegacyOrg(loadOrgState()));
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    const initial = cleanLegacyOrg(loadOrgState());
    saveOrgState(initial);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(ORG_CHANNEL) : null; channelRef.current = channel;
    if (channel) channel.onmessage = (event) => {
      const incoming = cleanLegacyOrg(normalizeOrgState(event.data as OrgState));
      const next = mergeOrgForSync(incoming, cleanLegacyOrg(loadOrgState()));
      saveOrgState(next);
      setState(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== ORG_STORAGE_KEY || !event.newValue) return;
      try {
        const incoming = cleanLegacyOrg(normalizeOrgState(JSON.parse(event.newValue) as OrgState));
        const next = mergeOrgForSync(incoming, cleanLegacyOrg(loadOrgState()));
        saveOrgState(next);
        setState(next);
      } catch { /* ignore */ }
    };
    window.addEventListener("storage", onStorage);
    let disposed = false;
    let syncing = false;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        const remote = await pullRemote();
        if (disposed || !remote) return;
        if (remote.payload?.org) {
          const local = cleanLegacyOrg(loadOrgState());
          const next = mergeOrgForSync(remote.payload.org, local);
          saveOrgState(next);
          setState(next);
          if (JSON.stringify(next) !== JSON.stringify(cleanLegacyOrg(normalizeOrgState(remote.payload.org)))) void pushRemotePart("org", next);
        } else {
          await pushRemotePart("org", initial);
        }
      } finally { syncing = false; }
    };
    const syncWhenVisible = () => { if (document.visibilityState === "visible") void sync(); };
    const syncWhenOnline = () => void sync();
    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("online", syncWhenOnline);
    window.addEventListener("focus", syncWhenOnline);
    void sync(); const timer = window.setInterval(() => void sync(), POLL_MS);
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener("storage", onStorage); document.removeEventListener("visibilitychange", syncWhenVisible); window.removeEventListener("online", syncWhenOnline); window.removeEventListener("focus", syncWhenOnline); channel?.close(); channelRef.current = null; };
  }, []);
  const setLiveState = useCallback<Dispatch<SetStateAction<OrgState>>>((action) => {
    setState((current) => {
      const latest = cleanLegacyOrg(loadOrgState() ?? current);
      const proposed = typeof action === "function" ? action(latest) : action;
      const next = detectOrgChanges(latest, proposed);
      saveOrgState(next);
      channelRef.current?.postMessage(next);
      void pushRemotePart("org", next);
      return next;
    });
  }, []);
  return [state, setLiveState];
}
