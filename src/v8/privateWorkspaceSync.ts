export type SyncedReminder = {
  id: string;
  text: string;
  forWhom: string;
  dueAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  completed: boolean;
  completedAt?: string;
};

export type SyncedNote = {
  id: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type PrivateWorkspaceState = {
  reminders: SyncedReminder[];
  notes: SyncedNote[];
  deletedReminderIds: string[];
  deletedNoteIds: string[];
};

type RemotePayload = {
  app?: unknown;
  org?: unknown;
  privateWorkspaces?: Record<string, PrivateWorkspaceState>;
  [key: string]: unknown;
};

type RemoteSnapshot = {
  payload?: RemotePayload;
  revision?: number;
};

const SYNC_ENDPOINT = "https://fxpnnmtlopuunptiaval.supabase.co/functions/v1/workspace-sync";
const WORKSPACE_SYNC_KEY_STORAGE = "rif-dimashq-workspace-sync-key-v1";

export const emptyPrivateWorkspace = (): PrivateWorkspaceState => ({
  reminders: [],
  notes: [],
  deletedReminderIds: [],
  deletedNoteIds: [],
});

function syncKey() {
  return typeof window === "undefined" ? "" : localStorage.getItem(WORKSPACE_SYNC_KEY_STORAGE) ?? "";
}

function unique(values: string[] = []) {
  return [...new Set(values.filter(Boolean))];
}

function reminderTime(item: SyncedReminder) {
  return item.updatedAt ?? item.completedAt ?? item.createdAt ?? "";
}

function mergeById<T extends { id: string }>(remote: T[], local: T[], timeOf: (item: T) => string) {
  const byId = new Map<string, T>();
  [...remote, ...local].forEach((item) => {
    const previous = byId.get(item.id);
    if (!previous || timeOf(previous).localeCompare(timeOf(item)) <= 0) byId.set(item.id, item);
  });
  return [...byId.values()];
}

export function normalizePrivateWorkspace(value: Partial<PrivateWorkspaceState> | undefined, userId: string): PrivateWorkspaceState {
  const deletedReminderIds = unique(value?.deletedReminderIds);
  const deletedNoteIds = unique(value?.deletedNoteIds);
  const deletedReminders = new Set(deletedReminderIds);
  const deletedNotes = new Set(deletedNoteIds);
  return {
    reminders: (Array.isArray(value?.reminders) ? value!.reminders : []).filter((item) => item?.createdBy === userId && !deletedReminders.has(item.id)),
    notes: (Array.isArray(value?.notes) ? value!.notes : []).filter((item) => item?.createdBy === userId && !deletedNotes.has(item.id)),
    deletedReminderIds,
    deletedNoteIds,
  };
}

export function mergePrivateWorkspace(remoteValue: Partial<PrivateWorkspaceState> | undefined, localValue: Partial<PrivateWorkspaceState> | undefined, userId: string): PrivateWorkspaceState {
  const remote = normalizePrivateWorkspace(remoteValue, userId);
  const local = normalizePrivateWorkspace(localValue, userId);
  const deletedReminderIds = unique([...remote.deletedReminderIds, ...local.deletedReminderIds]);
  const deletedNoteIds = unique([...remote.deletedNoteIds, ...local.deletedNoteIds]);
  const deletedReminders = new Set(deletedReminderIds);
  const deletedNotes = new Set(deletedNoteIds);
  return {
    reminders: mergeById(remote.reminders, local.reminders, reminderTime).filter((item) => !deletedReminders.has(item.id)),
    notes: mergeById(remote.notes, local.notes, (item) => item.updatedAt ?? item.createdAt).filter((item) => !deletedNotes.has(item.id)),
    deletedReminderIds,
    deletedNoteIds,
  };
}

async function pullRemote(): Promise<RemoteSnapshot | null> {
  const key = syncKey();
  if (!key) return null;
  try {
    const response = await fetch(`${SYNC_ENDPOINT}?private-workspace=1&_=${Date.now()}`, {
      cache: "no-store",
      headers: { "x-workspace-key": key },
    });
    if (!response.ok) return null;
    return await response.json() as RemoteSnapshot;
  } catch {
    return null;
  }
}

export async function syncPrivateWorkspace(userId: string, localValue: PrivateWorkspaceState): Promise<PrivateWorkspaceState> {
  const key = syncKey();
  if (!key) return normalizePrivateWorkspace(localValue, userId);

  let local = normalizePrivateWorkspace(localValue, userId);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await pullRemote();
    if (!current) return local;
    const remote = current.payload?.privateWorkspaces?.[userId];
    const merged = mergePrivateWorkspace(remote, local, userId);
    const remoteNormalized = normalizePrivateWorkspace(remote, userId);
    if (JSON.stringify(merged) === JSON.stringify(remoteNormalized)) return merged;

    const payload: RemotePayload = {
      ...(current.payload ?? {}),
      privateWorkspaces: {
        ...(current.payload?.privateWorkspaces ?? {}),
        [userId]: merged,
      },
    };

    try {
      const response = await fetch(SYNC_ENDPOINT, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "x-workspace-key": key },
        body: JSON.stringify({ payload, revision: current.revision ?? 0 }),
      });
      if (response.ok) return merged;
      if (response.status !== 409) return merged;
      local = merged;
    } catch {
      return merged;
    }
  }
  return local;
}
