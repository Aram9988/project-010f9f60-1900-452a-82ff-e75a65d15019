/**
 * IndexedDB blob store for task/comment attachments.
 * Metadata lives in the Zustand store; the actual File/Blob lives here
 * keyed by attachment id. Falls back gracefully in non-browser contexts.
 */
const DB_NAME = "tk-attachments";
const STORE = "blobs";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function isBrowser() { return typeof window !== "undefined" && typeof indexedDB !== "undefined"; }

function openDb(): Promise<IDBDatabase> {
  if (!isBrowser()) return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const attachmentRepo = {
  async put(id: string, blob: Blob): Promise<void> {
    if (!isBrowser()) return;
    await tx("readwrite", (s) => s.put(blob, id) as unknown as IDBRequest<IDBValidKey>);
  },
  async get(id: string): Promise<Blob | undefined> {
    if (!isBrowser()) return undefined;
    try { return (await tx<Blob | undefined>("readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>)) ?? undefined; }
    catch { return undefined; }
  },
  async delete(id: string): Promise<void> {
    if (!isBrowser()) return;
    try { await tx("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>); } catch { /* ignore */ }
  },
};

/** Cache of created object URLs so we can revoke on unmount. */
const urlCache = new Map<string, string>();

export async function getAttachmentUrl(id: string, fallbackDataUrl?: string): Promise<string | undefined> {
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await attachmentRepo.get(id);
  if (blob) {
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  }
  return fallbackDataUrl;
}

export function revokeAttachmentUrl(id: string) {
  const url = urlCache.get(id);
  if (url) { URL.revokeObjectURL(url); urlCache.delete(id); }
}

export async function downloadAttachment(id: string, name: string, fallbackDataUrl?: string) {
  const url = await getAttachmentUrl(id, fallbackDataUrl);
  if (!url) return;
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}